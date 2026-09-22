const { Query } = require('node-appwrite');
const { buildGroundingPreamble } = require('./grounding');

const DB_ID = 'personal_os';

// Self-contained copy of the built-in intervention catalog's id→title map
// (the authoritative list lives client-side in src/lib/interventions.ts) —
// this function can't import monorepo workspace code (see CLAUDE.md), and
// this is only ever used for display text, never for ranking logic itself.
const BUILTIN_TITLES = {
  'box-breathing': 'Box breathing',
  'physiological-sigh': 'Physiological sigh',
  'short-walk': 'Step outside for a bit',
  'stand-and-stretch': 'Stand and stretch',
  'cold-water': 'Cold water on your face or wrists',
  'grounding-54321': '5-4-3-2-1 grounding',
  'name-the-feeling': 'Name the feeling',
  'brain-dump': 'Brain dump',
  'message-someone': 'Message one person',
  'glass-of-water': 'Drink a glass of water',
};

const MIN_ATTEMPTS_PER_INTERVENTION = 2;
const MIN_TOTAL_FEEDBACK = 3;

/** Same ranking math as the client's computeAutopilotRanking — duplicated
 * deliberately (self-contained function code), not imported. */
function rankInterventions(results) {
  const withFeedback = results.filter((r) => r.userFeedback);
  if (withFeedback.length < MIN_TOTAL_FEEDBACK) return [];
  const byIntervention = new Map();
  for (const r of withFeedback) {
    const entry = byIntervention.get(r.interventionId) || { attempts: 0, helped: 0 };
    entry.attempts += 1;
    if (r.userFeedback === 'helped') entry.helped += 1;
    byIntervention.set(r.interventionId, entry);
  }
  return Array.from(byIntervention.entries())
    .filter(([, v]) => v.attempts >= MIN_ATTEMPTS_PER_INTERVENTION && v.helped > 0)
    .map(([interventionId, v]) => ({ interventionId, attempts: v.attempts, helped: v.helped, helpRate: v.helped / v.attempts }))
    .sort((a, b) => b.helpRate - a.helpRate || b.attempts - a.attempts);
}

/**
 * Spec section 24, "Intervention Compiler" — composes a tiny, time-boxed
 * routine from real ingredients only: the user's own top-helped
 * interventions and their current real state. The AI's job is limited to
 * sequencing and phrasing — it is explicitly told not to introduce any
 * technique beyond what's listed as evidence, so it can't invent a new
 * "wellness technique" that was never actually tried.
 */
async function compileIntervention(databases, userId, minutesAvailable, generateFast, env, log) {
  const budget = Math.max(1, Math.min(60, Number(minutesAvailable) || 10));

  const [resultsRes, customRes, stateRes] = await Promise.all([
    databases.listDocuments(DB_ID, 'intervention_results', [Query.equal('userId', userId), Query.limit(100)]),
    databases.listDocuments(DB_ID, 'interventions', [Query.equal('userId', userId), Query.limit(50)]),
    databases.listDocuments(DB_ID, 'state_estimates', [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ]),
  ]);

  const ranked = rankInterventions(resultsRes.documents);
  if (ranked.length === 0) {
    return {
      skipped: true,
      reason: 'not_enough_learned',
      message: 'Not enough real feedback on what helps yet — try a few things and rate how they went first.',
    };
  }

  const titleFor = (id) => BUILTIN_TITLES[id] || customRes.documents.find((d) => d.$id === id)?.title || 'a real intervention from your history';

  const top = ranked.slice(0, 3).map((r) => ({ title: titleFor(r.interventionId), helped: r.helped, attempts: r.attempts }));
  const evidence = top.map((t) => ({
    kind: 'observed',
    text: `"${t.title}" was rated "Helped" ${t.helped} of ${t.attempts} real times you tried it.`,
  }));

  const todayState = stateRes.documents[0];
  if (todayState) {
    const stateBits = ['energy', 'recovery', 'mentalLoad']
      .filter((k) => todayState[k])
      .map((k) => `${k}: ${todayState[k]}`)
      .join(', ');
    if (stateBits) evidence.push({ kind: 'observed', text: `Current estimated state — ${stateBits}.` });
  }

  const preamble =
    buildGroundingPreamble(evidence) +
    `\n\nCompose a tiny routine for the next ${budget} minutes using ONLY the interventions named in the evidence above — do not introduce any technique that isn't listed. ` +
    'Sequence 1-3 short steps that fit the time budget (e.g. "2 minutes: box breathing, then 5 minutes: step outside"). ' +
    'Return ONLY the routine as a short numbered list, no other commentary.';

  const routineText = await generateFast(
    [
      { role: 'system', content: preamble },
      { role: 'user', content: 'Compile it now.' },
    ],
    env,
    log
  );

  if (!routineText.trim()) throw new Error('AI provider returned an empty compiled routine');

  return {
    skipped: false,
    routine: { text: routineText.trim(), minutesAvailable: budget, basedOn: top.map((t) => t.title) },
  };
}

module.exports = { compileIntervention, rankInterventions };

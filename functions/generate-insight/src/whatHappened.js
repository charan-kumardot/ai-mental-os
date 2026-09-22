const { Query } = require('node-appwrite');
const { buildDayMap, DB_ID } = require('./dayMap');
const { computeBaselines, computeStateEstimate } = require('./baselineStats');
const { detectContextCollision } = require('./contextCollision');
const { buildGroundingPreamble } = require('./grounding');
const { fetchActiveContext } = require('./opportunityWindow');
const { communicationInstruction } = require('./communicationStyle');

const CATEGORY_LABEL = {
  action: 'Noted something to do',
  decision: 'Noted a decision to make',
  information: 'Noted something to remember',
  conversation: 'Noted a conversation to have',
  emotional: 'Wrote down something you felt',
};

const FEEDBACK_LABEL = {
  helped: 'helped',
  no_effect: 'no real effect',
  made_worse: 'made it worse',
  not_completed: "didn't finish",
};

// Duplicated from interventionCompiler.js per this function's established
// self-contained-module convention (Appwrite's isolated build environment
// can't resolve cross-module monorepo imports at deploy time).
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function truncate(text, max = 60) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Pure delta computation — today's real aggregate values vs. the user's own
 * short-term baseline, exported separately so it's unit-testable without
 * Appwrite. Only ever compares against a baseline this account actually
 * has (never a population average), and only reports a delta once it
 * clears a minimum-difference floor so normal day-to-day noise doesn't
 * get reported as a meaningful change.
 */
function computeDeltas(todayAgg, baselines) {
  const deltas = [];
  const sleepBaseline = baselines.sleepMinutes?.short;
  if (sleepBaseline && todayAgg.sleepMinutes != null) {
    const diff = todayAgg.sleepMinutes - sleepBaseline.mean;
    if (Math.abs(diff) >= 15) {
      deltas.push(`Sleep was ${Math.round(Math.abs(diff))} minutes ${diff < 0 ? 'below' : 'above'} your normal.`);
    }
  }
  const stepsBaseline = baselines.steps?.short;
  if (stepsBaseline && todayAgg.steps != null) {
    const diff = todayAgg.steps - stepsBaseline.mean;
    if (Math.abs(diff) >= 500) {
      deltas.push(`Steps were ${Math.round(Math.abs(diff))} ${diff < 0 ? 'below' : 'above'} your normal.`);
    }
  }
  const meetingBaseline = baselines.meetingCount?.short;
  if (meetingBaseline && todayAgg.meetingCount != null) {
    const diff = todayAgg.meetingCount - meetingBaseline.mean;
    if (Math.abs(diff) >= 1) {
      deltas.push(`You had ${Math.round(Math.abs(diff))} ${diff < 0 ? 'fewer' : 'more'} meetings than your normal.`);
    }
  }
  return deltas;
}

/**
 * "What Happened To Me?" (signature feature) — a real, timestamped
 * reconstruction of today built only from what was actually logged.
 * Deliberately does NOT invent specific clock times for things this app
 * only tracks as day-level aggregates (sleep totals, meeting counts) —
 * those appear as "compared to your normal" deltas instead. The discrete
 * timeline only ever contains events with a real timestamp: check-ins,
 * mental-inbox entries, and intervention attempts.
 */
async function buildWhatHappened(databases, userId, generateFast, env, log, communicationStyle) {
  const today = todayKey();
  const startIso = `${today}T00:00:00.000Z`;
  const endIso = `${today}T23:59:59.999Z`;
  const range = [Query.equal('userId', userId), Query.greaterThanEqual('$createdAt', startIso), Query.lessThanEqual('$createdAt', endIso), Query.orderAsc('$createdAt'), Query.limit(50)];

  const [dayMap, checkinsRes, inboxRes, interventionsRes, unresolvedInboxRes, activeContext] = await Promise.all([
    buildDayMap(databases, userId, { limit: 300 }),
    databases.listDocuments(DB_ID, 'checkins', range),
    databases.listDocuments(DB_ID, 'mental_inbox', range),
    databases.listDocuments(DB_ID, 'intervention_results', range),
    databases.listDocuments(DB_ID, 'mental_inbox', [Query.equal('userId', userId), Query.equal('resolved', false), Query.limit(100)]),
    fetchActiveContext(databases, userId),
  ]);

  const events = [];
  for (const c of checkinsRes.documents) {
    events.push({ time: c.$createdAt, label: `Checked in feeling "${c.mood}"` });
  }
  for (const i of inboxRes.documents) {
    const base = CATEGORY_LABEL[i.category] || 'Wrote something down';
    events.push({ time: i.$createdAt, label: i.content ? `${base}: "${truncate(i.content)}"` : base });
  }
  for (const r of interventionsRes.documents) {
    const title = BUILTIN_TITLES[r.interventionId] || 'a technique';
    const outcome = r.userFeedback ? ` — ${FEEDBACK_LABEL[r.userFeedback] || r.userFeedback}` : '';
    events.push({ time: r.startedAt || r.$createdAt, label: `Tried "${title}"${outcome}` });
  }
  events.sort((a, b) => a.time.localeCompare(b.time));

  if (events.length === 0) {
    return {
      skipped: true,
      reason: 'no_data',
      message: "Nothing logged today yet — check in, jot something down, or try a technique, and I'll be able to reconstruct today for you.",
    };
  }

  const baselines = computeBaselines(dayMap);
  const todayAgg = dayMap[today] || {};
  const { state, hasAnyEstimate } = computeStateEstimate(todayAgg, baselines, unresolvedInboxRes.total);
  const collision = detectContextCollision(hasAnyEstimate ? state : null);
  const deltas = computeDeltas(todayAgg, baselines);

  let closing = null;
  if (collision.collided || deltas.length >= 2 || activeContext) {
    const evidence = [
      ...deltas.map((d) => ({ kind: 'observed', text: d })),
      ...events.map((e) => ({ kind: 'observed', text: e.label })),
      ...(activeContext ? [{ kind: 'user_reported', text: `The user has told the app they're currently going through: ${activeContext}.` }] : []),
    ];
    const preamble =
      buildGroundingPreamble(evidence) +
      `\n\nWrite a note that several things stacked together today. ${communicationInstruction(communicationStyle)} If the user's current life context is given, you may reference it naturally, but never claim to know exactly why the user feels a certain way, and never diagnose.`;
    try {
      const text = await generateFast([{ role: 'system', content: preamble }, { role: 'user', content: 'Write the sentence now.' }], env, log);
      closing = text?.trim() || null;
    } catch (e) {
      if (log) log(`what_happened closing sentence generation failed, continuing without it: ${e.message}`);
      closing = null;
    }
  }

  return {
    skipped: false,
    events: events.map((e) => ({ time: e.time, label: e.label })),
    deltas,
    collided: collision.collided,
    closing,
    activeContext,
  };
}

module.exports = { buildWhatHappened, computeDeltas };

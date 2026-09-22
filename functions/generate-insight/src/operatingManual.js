const { Query } = require('node-appwrite');
const { buildGroundingPreamble } = require('./grounding');
const { computeHourBuckets, fetchUserTimezone } = require('./opportunityWindow');

const DB_ID = 'personal_os';

/**
 * "How I work" (spec section 39) — generated only from real records:
 * check-in mood by hour-of-day, concluded experiments, mental inbox
 * category distribution. Never invents a "best focus window" or similar
 * claim without evidence — if there isn't enough to say something
 * concrete, says so instead of generating generic advice.
 */
async function buildOperatingManual(databases, userId, generateFast, env, log) {
  const [checkinsRes, experimentsRes, inboxRes, timezone] = await Promise.all([
    databases.listDocuments(DB_ID, 'checkins', [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(100)]),
    databases.listDocuments(DB_ID, 'experiments', [
      Query.equal('userId', userId),
      Query.equal('status', 'completed'),
      Query.limit(50),
    ]),
    databases.listDocuments(DB_ID, 'mental_inbox', [Query.equal('userId', userId), Query.limit(100)]),
    fetchUserTimezone(databases, userId),
  ]);

  const checkins = checkinsRes.documents;
  const concludedExperiments = experimentsRes.documents;

  if (checkins.length < 10 && concludedExperiments.length === 0) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      message: `${checkins.length} check-in${checkins.length === 1 ? '' : 's'} and ${concludedExperiments.length} concluded experiment${concludedExperiments.length === 1 ? '' : 's'} so far — not enough to say anything concrete yet. This typically needs a couple of weeks.`,
    };
  }

  // Spec section 79 asks for named cards ("I focus best", "What's worked",
  // "What I've noticed") rather than one blended paragraph. Each section
  // below is built from its OWN distinct evidence and only appears if that
  // evidence is real — never force-filled to complete a fixed template.
  const sections = {}; // sectionKey -> evidence[]

  // Hour-of-day mood pattern — shared with the standalone Opportunity Window
  // feature (spec §35) so the two can never disagree. Only claims a "best
  // window" if there's a real, non-trivial gap between hours, not noise.
  const hourBuckets = computeHourBuckets(checkins, timezone);
  if (hourBuckets.length >= 2) {
    const best = hourBuckets[0];
    const worst = hourBuckets[hourBuckets.length - 1];
    if (best.avg - worst.avg >= 0.5) {
      sections.focus = [
        {
          kind: 'pattern',
          text: `Check-ins during the ${best.bucket} average ${best.avg.toFixed(1)}/5 mood (${best.n} check-ins), noticeably higher than ${worst.bucket} (${worst.avg.toFixed(1)}/5).`,
        },
      ];
    }
  }

  if (concludedExperiments.length > 0) {
    sections.whatsWorked = concludedExperiments.map((exp) => ({
      kind: 'observed',
      text: `Experiment "${exp.hypothesis}" concluded: ${exp.conclusion || 'no notes recorded'}.`,
    }));
  }

  const categoryCounts = {};
  for (const item of inboxRes.documents) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCategory && topCategory[1] >= 3) {
    sections.noticed = [
      {
        kind: 'observed',
        text: `Most common thing logged in the mental inbox: "${topCategory[0]}" (${topCategory[1]} times).`,
      },
    ];
  }

  const evidence = Object.values(sections).flat();
  if (evidence.length === 0) {
    return {
      skipped: true,
      reason: 'no_clear_pattern',
      message: "There's real data here, but no pattern clear enough yet to write down as \"how you work.\" Keep going — this fills in with more history.",
    };
  }

  const SECTION_LABEL = { focus: 'I focus best', whatsWorked: "What's worked", noticed: "What I've noticed" };
  const sectionKeys = Object.keys(sections);

  const preamble =
    buildGroundingPreamble(evidence) +
    `\n\nWrite a short "How I work" personal operating manual as JSON with exactly these keys: ${JSON.stringify(sectionKeys)}. ` +
    'Each value is ONE short sentence (max 25 words), grounded only in the evidence for that section above — never borrow evidence from a different section. ' +
    'Return ONLY the JSON object, no other text.';

  const raw = await generateFast(
    [
      { role: 'system', content: preamble },
      { role: 'user', content: 'Write it now.' },
    ],
    env,
    log
  );

  if (!raw.trim()) throw new Error('AI provider returned empty operating manual text');

  let parsedSections;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsedSections = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    // Fall back to a single combined section rather than failing the whole
    // card if the model didn't return clean JSON this time.
    parsedSections = { focus: raw.trim() };
  }

  const manualSections = sectionKeys
    .filter((key) => typeof parsedSections[key] === 'string' && parsedSections[key].trim())
    .map((key) => ({ key, label: SECTION_LABEL[key], text: parsedSections[key].trim() }));

  if (manualSections.length === 0) throw new Error('AI provider returned no usable operating manual sections');

  return { skipped: false, manual: { sections: manualSections, evidenceCount: evidence.length } };
}

module.exports = { buildOperatingManual };

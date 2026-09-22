const { Query, ID, Permission, Role } = require('node-appwrite');
const { MOOD_SCALE } = require('./stats');
const { buildGroundingPreamble } = require('./grounding');

const DB_ID = 'personal_os';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfWindow(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Pure aggregation for the weekly review's real trend chart — averages
 * multiple same-day check-ins into one point per real day, in chronological
 * order. Never fills in a day with no check-in (no interpolation), so a
 * sparse week correctly produces a shorter series rather than a smoothed
 * fake one. Exported separately so it's unit-testable without Appwrite.
 */
function computeDailyMoodSeries(checkins) {
  const byDay = {};
  for (const c of checkins) {
    const value = MOOD_SCALE[c.mood];
    if (value == null || !c.$createdAt) continue;
    const day = c.$createdAt.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(value);
  }
  return Object.entries(byDay)
    .map(([date, values]) => ({
      date,
      value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Real aggregation over the last 7 days vs the 7 days before that —
 * no invented history, no filled-in gaps. If there isn't enough of the
 * week covered, says so plainly instead of narrating a thin week as if
 * it were a full one (same honesty principle as the mood-trend gate in
 * main.js).
 */
async function buildWeeklyReview(databases, userId, generateFast, env, log) {
  const sevenDaysAgo = startOfWindow(7);
  const fourteenDaysAgo = startOfWindow(14);

  const thisWeekRes = await databases.listDocuments(DB_ID, 'checkins', [
    Query.equal('userId', userId),
    Query.greaterThanEqual('$createdAt', sevenDaysAgo),
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  const thisWeek = thisWeekRes.documents;

  if (thisWeek.length < 3) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      sampleSize: thisWeek.length,
      message: `Only ${thisWeek.length} check-in${thisWeek.length === 1 ? '' : 's'} this week — need at least 3 before a weekly review means anything.`,
    };
  }

  const priorWeekRes = await databases.listDocuments(DB_ID, 'checkins', [
    Query.equal('userId', userId),
    Query.greaterThanEqual('$createdAt', fourteenDaysAgo),
    Query.lessThan('$createdAt', sevenDaysAgo),
    Query.limit(100),
  ]);
  const priorWeek = priorWeekRes.documents;

  const thisWeekValues = thisWeek.map((c) => MOOD_SCALE[c.mood]).filter((v) => v != null);
  const thisWeekMean = thisWeekValues.reduce((a, b) => a + b, 0) / thisWeekValues.length;

  const moodCounts = {};
  for (const c of thisWeek) moodCounts[c.mood] = (moodCounts[c.mood] || 0) + 1;
  const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const evidence = [
    { kind: 'observed', text: `${thisWeek.length} check-ins recorded this week.` },
    { kind: 'observed', text: `Most common mood this week: "${mostCommonMood}".` },
    { kind: 'observed', text: `Average mood this week: ${thisWeekMean.toFixed(1)}/5.` },
  ];

  let comparisonNote = null;
  if (priorWeek.length >= 3) {
    const priorValues = priorWeek.map((c) => MOOD_SCALE[c.mood]).filter((v) => v != null);
    const priorMean = priorValues.reduce((a, b) => a + b, 0) / priorValues.length;
    const delta = thisWeekMean - priorMean;
    evidence.push({
      kind: 'observed',
      text: `Prior week average mood: ${priorMean.toFixed(1)}/5 (from ${priorWeek.length} check-ins) — ${
        Math.abs(delta) < 0.3 ? 'about the same' : delta > 0 ? 'this week trended higher' : 'this week trended lower'
      }.`,
    });
    comparisonNote = delta;
  } else {
    evidence.push({
      kind: 'inference',
      text: 'Not enough check-ins from the prior week to compare — this is likely one of the first weeks of real data.',
    });
  }

  const preamble = buildGroundingPreamble(evidence) + '\n\nWrite this as a short weekly review narrative (3-4 sentences), warm and specific, ending with one honest observation — not generic encouragement. Do not invent patterns, interventions, or causes not in the evidence.';

  const narrative = await generateFast(
    [
      { role: 'system', content: preamble },
      { role: 'user', content: 'Write the weekly review now.' },
    ],
    env,
    log
  );

  if (!narrative.trim()) {
    throw new Error('AI provider returned empty weekly review text');
  }

  return {
    skipped: false,
    review: {
      checkinCount: thisWeek.length,
      mostCommonMood,
      averageMood: Number(thisWeekMean.toFixed(2)),
      trendVsPriorWeek: comparisonNote === null ? null : comparisonNote > 0 ? 'up' : comparisonNote < 0 ? 'down' : 'flat',
      narrative: narrative.trim(),
      dailyMoodSeries: computeDailyMoodSeries(thisWeek),
    },
  };
}

module.exports = { buildWeeklyReview, computeDailyMoodSeries };

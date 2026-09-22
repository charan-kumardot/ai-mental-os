const { buildDayMap } = require('./dayMap');
const { computeBaselines } = require('./baselineStats');
const { buildGroundingPreamble } = require('./grounding');
const { fetchActiveContext } = require('./opportunityWindow');
const { communicationInstruction } = require('./communicationStyle');

const MIN_DAYS_THIS_WEEK = 3;

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Pure aggregation — this week's real average sleep/steps/meeting-load vs
 * the user's own medium-term (30-day) baseline. Exported separately so the
 * comparison math is unit-testable without Appwrite. Only ever compares
 * against a baseline this account actually has; a dimension with no
 * baseline yet is simply left out rather than guessed.
 */
function computeRecoveryDeltas(thisWeekAvg, baselines) {
  const deltas = [];
  if (thisWeekAvg.sleepMinutes != null && baselines.sleepMinutes?.medium) {
    const diff = thisWeekAvg.sleepMinutes - baselines.sleepMinutes.medium.mean;
    if (Math.abs(diff) >= 15) {
      deltas.push({ dimension: 'sleep', diff, text: `Sleep has averaged ${Math.round(Math.abs(diff))} minutes ${diff < 0 ? 'below' : 'above'} your normal this week.` });
    }
  }
  if (thisWeekAvg.steps != null && baselines.steps?.medium) {
    const diff = thisWeekAvg.steps - baselines.steps.medium.mean;
    if (Math.abs(diff) >= 500) {
      deltas.push({ dimension: 'steps', diff, text: `Movement has averaged ${Math.round(Math.abs(diff))} steps ${diff < 0 ? 'below' : 'above'} your normal this week.` });
    }
  }
  if (thisWeekAvg.meetingCount != null && baselines.meetingCount?.medium) {
    const diff = thisWeekAvg.meetingCount - baselines.meetingCount.medium.mean;
    if (Math.abs(diff) >= 1) {
      deltas.push({ dimension: 'meetings', diff, text: `Meetings have averaged ${Math.round(Math.abs(diff))} ${diff < 0 ? 'fewer' : 'more'} per day than your normal this week.` });
    }
  }
  return deltas;
}

/**
 * Recovery Radar (spec §30) — a weekly recovery-focused reading, distinct
 * from the mood-focused Weekly Review: same underlying week of real data,
 * different lens (sleep, movement, meeting load — the actual inputs to
 * recovery, not mood itself). Deterministic deltas first; the narrative
 * sentence is AI-phrased but constrained to only the deltas actually
 * found, same grounding guardrail as every other insight in this app.
 */
async function buildRecoveryRadar(databases, userId, generateFast, env, log, communicationStyle) {
  const [dayMap, activeContext] = await Promise.all([
    buildDayMap(databases, userId, { limit: 300 }),
    fetchActiveContext(databases, userId),
  ]);
  const now = Date.now();
  const thisWeekDays = Object.entries(dayMap).filter(([date]) => {
    const daysAgo = Math.floor((now - new Date(date).getTime()) / 86400000);
    return daysAgo >= 0 && daysAgo < 7;
  });

  if (thisWeekDays.length < MIN_DAYS_THIS_WEEK) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      message: `Only ${thisWeekDays.length} day${thisWeekDays.length === 1 ? '' : 's'} of data this week so far — need at least ${MIN_DAYS_THIS_WEEK} before a weekly recovery read means anything.`,
    };
  }

  const thisWeekAvg = {
    sleepMinutes: average(thisWeekDays.map(([, v]) => v.sleepMinutes).filter((v) => v != null)),
    steps: average(thisWeekDays.map(([, v]) => v.steps).filter((v) => v != null)),
    meetingCount: average(thisWeekDays.map(([, v]) => v.meetingCount).filter((v) => v != null)),
  };

  const baselines = computeBaselines(dayMap);
  const deltas = computeRecoveryDeltas(thisWeekAvg, baselines);

  let narrative = null;
  if (deltas.length > 0) {
    const evidence = [
      ...deltas.map((d) => ({ kind: 'observed', text: d.text })),
      ...(activeContext ? [{ kind: 'user_reported', text: `The user is currently going through: ${activeContext}.` }] : []),
    ];
    const preamble =
      buildGroundingPreamble(evidence) +
      `\n\nWrite a weekly recovery narrative describing how this week has actually gone for load and recovery, ending with one honest, non-prescriptive observation about whether recovery deserves attention right now. Never tell the user what to do — observe, don't instruct. ${communicationInstruction(communicationStyle)}`;
    try {
      const text = await generateFast([{ role: 'system', content: preamble }, { role: 'user', content: 'Write it now.' }], env, log);
      narrative = text?.trim() || null;
    } catch (e) {
      if (log) log(`recovery_radar narrative generation failed, continuing without it: ${e.message}`);
    }
  }

  return {
    skipped: false,
    daysThisWeek: thisWeekDays.length,
    thisWeekAvg,
    deltas: deltas.map((d) => d.text),
    narrative,
  };
}

module.exports = { buildRecoveryRadar, computeRecoveryDeltas };

const { buildDayMap } = require('./dayMap');
const { computeBaselines } = require('./baselineStats');

const MIN_TRIGGER_DAYS = 3;

function nextDateKey(dateKey) {
  const d = new Date(dateKey);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure lag-effect computation — "what usually happens the day after X" —
 * built by walking real consecutive day pairs in the day map, never a
 * model's guess. `triggerFn` decides which days count as "X happened";
 * `outcomeKey` is read from the FOLLOWING day. Requires a minimum number
 * of real trigger-day instances before returning a result, same honesty
 * floor as every other statistic in this app. Exported separately so the
 * comparison math is unit-testable without Appwrite.
 */
function computeLagEffect(dayMap, triggerFn, outcomeKey) {
  const allOutcomeValues = Object.values(dayMap)
    .map((d) => d[outcomeKey])
    .filter((v) => v != null);
  if (allOutcomeValues.length === 0) return null;
  const overallAvg = allOutcomeValues.reduce((a, b) => a + b, 0) / allOutcomeValues.length;

  const followingValues = [];
  for (const [dateKey, values] of Object.entries(dayMap)) {
    if (!triggerFn(values)) continue;
    const next = dayMap[nextDateKey(dateKey)];
    if (next && next[outcomeKey] != null) followingValues.push(next[outcomeKey]);
  }

  if (followingValues.length < MIN_TRIGGER_DAYS) return null;

  const followingAvg = followingValues.reduce((a, b) => a + b, 0) / followingValues.length;
  return { triggerDayCount: followingValues.length, followingAvg, overallAvg, diff: followingAvg - overallAvg };
}

const PRESETS = {
  short_sleep: {
    label: 'a short-sleep night',
    trigger: (v, baselines) => v.sleepMinutes != null && baselines.sleepMinutes?.long && v.sleepMinutes < baselines.sleepMinutes.long.mean - baselines.sleepMinutes.long.stdDev,
  },
  heavy_meetings: {
    label: 'a heavy-meeting day',
    trigger: (v, baselines) => v.meetingCount != null && baselines.meetingCount?.long && v.meetingCount > baselines.meetingCount.long.mean + baselines.meetingCount.long.stdDev,
  },
  low_movement: {
    label: 'a low-movement day',
    trigger: (v, baselines) => v.steps != null && baselines.steps?.long && v.steps < baselines.steps.long.mean - baselines.steps.long.stdDev,
  },
};

const OUTCOME_LABEL = { mood: 'mood', steps: 'activity level', sleepMinutes: 'sleep' };

/**
 * Future Me (spec §22) — "what usually happens when I do X?" answered from
 * the user's own history, always labeled as a historical pattern, never a
 * deterministic prediction (spec's explicit requirement).
 */
async function computeFutureMe(databases, userId, presetKey, log) {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown Future Me preset: ${presetKey}`);

  const dayMap = await buildDayMap(databases, userId, { limit: 300 });
  const baselines = computeBaselines(dayMap);

  const outcomeKey = presetKey === 'heavy_meetings' ? 'mood' : presetKey === 'short_sleep' ? 'steps' : 'mood';
  const effect = computeLagEffect(dayMap, (v) => preset.trigger(v, baselines), outcomeKey);

  if (!effect) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      message: `Not enough real instances of ${preset.label} with a following day tracked yet to say anything meaningful.`,
    };
  }

  const outcomeLabel = OUTCOME_LABEL[outcomeKey];
  const direction = effect.diff > 0 ? 'higher' : effect.diff < 0 ? 'lower' : 'about the same';

  return {
    skipped: false,
    label: preset.label,
    outcomeLabel,
    triggerDayCount: effect.triggerDayCount,
    direction,
    text: `Across ${effect.triggerDayCount} real instances of ${preset.label} in your history, your ${outcomeLabel} the next day tended to be ${direction} than your overall average.`,
  };
}

module.exports = { computeFutureMe, computeLagEffect, PRESETS };

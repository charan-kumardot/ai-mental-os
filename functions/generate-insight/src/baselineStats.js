/**
 * Deterministic baseline/state math — pure, no AI, no network, testable in
 * isolation (spec sections 13-16: Personal Baseline Engine, Baseline
 * Drift, Personal State Engine, State Estimation).
 */

const WINDOWS = { short: 7, medium: 30, long: 90 };
const MIN_SAMPLES = { short: 3, medium: 7, long: 14 };
const DIMENSIONS = ['mood', 'sleepMinutes', 'steps', 'meetingCount'];

function meanStdDev(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { mean, stdDev, sampleSize: n };
}

/**
 * `dayMap` is { [dateKey]: { mood?, sleepMinutes?, steps?, meetingCount? } }.
 * `referenceDate` defaults to now — pass explicitly in tests for
 * deterministic "days ago" math.
 * Returns { [dimension]: { short?, medium?, long? } }, only including a
 * window when it has at least that window's minimum sample size — an
 * honest "not established yet" rather than a baseline computed from 2
 * data points.
 */
function computeBaselines(dayMap, referenceDate = new Date()) {
  const ref = referenceDate.getTime();
  const dayEntries = Object.entries(dayMap)
    .map(([dateKey, values]) => ({ dateKey, values, daysAgo: Math.floor((ref - new Date(dateKey).getTime()) / 86400000) }))
    .filter((e) => e.daysAgo >= 0);

  const baselines = {};
  for (const dimension of DIMENSIONS) {
    baselines[dimension] = {};
    for (const [windowName, windowDays] of Object.entries(WINDOWS)) {
      const values = dayEntries
        .filter((e) => e.daysAgo < windowDays && e.values[dimension] != null)
        .map((e) => e.values[dimension]);
      if (values.length < MIN_SAMPLES[windowName]) continue;
      baselines[dimension][windowName] = meanStdDev(values);
    }
  }
  return baselines;
}

const DRIFT_MIN_LONG_SAMPLES = 14;
const DRIFT_STDDEV_MULTIPLE = 0.75;

/**
 * Baseline drift (spec section 14): the medium-term baseline has moved
 * meaningfully away from the long-term one — "your normal has changed,"
 * not just "today is unusual." Requires a stable long-term baseline to
 * compare against; guards against a zero stdDev (no real variance to
 * judge a shift against) by falling back to a small absolute-difference
 * check instead of dividing by zero.
 */
function detectDrift(baselines) {
  const drifts = [];
  for (const dimension of DIMENSIONS) {
    const long = baselines[dimension]?.long;
    const medium = baselines[dimension]?.medium;
    if (!long || !medium || long.sampleSize < DRIFT_MIN_LONG_SAMPLES) continue;
    const threshold = long.stdDev > 0 ? long.stdDev * DRIFT_STDDEV_MULTIPLE : Math.abs(long.mean) * 0.15;
    const diff = medium.mean - long.mean;
    if (threshold > 0 && Math.abs(diff) >= threshold) {
      drifts.push({ dimension, from: long.mean, to: medium.mean, direction: diff > 0 ? 'up' : 'down' });
    }
  }
  return drifts;
}

const Z_THRESHOLD = 0.5;

function levelFromZ(z) {
  if (z <= -Z_THRESHOLD) return 'low';
  if (z >= Z_THRESHOLD) return 'high';
  return 'moderate';
}

/**
 * Today's state relative to the user's own short-term baseline (spec
 * section 15-16) — never a population comparison. Only fills in a
 * dimension the app actually has a real signal for: energy from steps,
 * recovery from sleep. Focus/stress are deliberately left `null` (never
 * `'moderate'` as a fake default) since there's no real tracked source for
 * them anywhere in this app. mentalLoad is a composite of two genuinely
 * tracked signals (meeting count + unresolved mental-inbox items), not an
 * invented one.
 */
function computeStateEstimate(todayValues, baselines, unresolvedInboxCount = 0) {
  const state = { energy: null, focus: null, stress: null, recovery: null, mentalLoad: null };
  const usedSampleSizes = [];

  const zFor = (dimension, value) => {
    const b = baselines[dimension]?.short;
    if (!b || value == null) return null;
    if (b.stdDev === 0) return 0;
    return (value - b.mean) / b.stdDev;
  };

  const stepsZ = zFor('steps', todayValues.steps);
  if (stepsZ != null) {
    state.energy = levelFromZ(stepsZ);
    usedSampleSizes.push(baselines.steps.short.sampleSize);
  }

  const sleepZ = zFor('sleepMinutes', todayValues.sleepMinutes);
  if (sleepZ != null) {
    state.recovery = levelFromZ(sleepZ);
    usedSampleSizes.push(baselines.sleepMinutes.short.sampleSize);
  }

  const meetingZ = zFor('meetingCount', todayValues.meetingCount);
  if (meetingZ != null) {
    let load = levelFromZ(meetingZ);
    if (unresolvedInboxCount >= 5 && load !== 'high') {
      load = load === 'low' ? 'moderate' : 'high';
    }
    state.mentalLoad = load;
    usedSampleSizes.push(baselines.meetingCount.short.sampleSize);
  } else if (unresolvedInboxCount >= 5) {
    // No calendar connected, but a real signal (a genuinely large unresolved
    // inbox) still exists on its own — don't discard it just because the
    // other half of the composite isn't available.
    state.mentalLoad = unresolvedInboxCount >= 10 ? 'high' : 'moderate';
  }

  const confidence =
    usedSampleSizes.length === 0
      ? 0
      : Math.min(0.3 + usedSampleSizes.reduce((a, b) => a + b, 0) / usedSampleSizes.length / 40, 0.9);

  return { state, confidence, hasAnyEstimate: usedSampleSizes.length > 0 || state.mentalLoad != null };
}

module.exports = { computeBaselines, detectDrift, computeStateEstimate, WINDOWS, MIN_SAMPLES, DIMENSIONS };

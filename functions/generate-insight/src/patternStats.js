/**
 * Deterministic cross-dimension correlation math — no AI, no network,
 * testable in isolation. Same "rules before AI" cost ladder as stats.js:
 * the pattern itself is found by real statistics; AI is only ever used
 * afterward to phrase a pattern that was already mathematically real.
 */

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null; // no variance — nothing to correlate
  return num / Math.sqrt(denomX * denomY);
}

const MIN_OVERLAPPING_DAYS = 10;
const MIN_ABS_R = 0.4;

const CANDIDATE_PAIRS = [
  ['mood', 'sleepMinutes'],
  ['mood', 'steps'],
  ['mood', 'meetingCount'],
  ['mood', 'meetingMinutes'],
  ['sleepMinutes', 'meetingCount'],
  ['sleepMinutes', 'steps'],
];

/**
 * Correlates one specific named pair against fresh data — used to
 * re-evaluate an already-detected pattern (contradiction/calibration
 * checks), as opposed to `detectStrongestPattern` which searches for a new
 * one. Returns { r, n } or null if there's not enough fresh overlap to
 * judge, regardless of whether |r| clears MIN_ABS_R (the caller decides
 * what a weak/reversed r means for an existing pattern).
 */
function correlatePair(dayMap, dimensionA, dimensionB) {
  const xs = [];
  const ys = [];
  for (const day of Object.values(dayMap)) {
    if (day[dimensionA] != null && day[dimensionB] != null) {
      xs.push(day[dimensionA]);
      ys.push(day[dimensionB]);
    }
  }
  if (xs.length < MIN_OVERLAPPING_DAYS) return null;
  const r = pearson(xs, ys);
  if (r == null) return null;
  return { r, n: xs.length };
}

/**
 * `dayMap` is { [dateKey]: { mood?, steps?, sleepMinutes?, meetingCount?, meetingMinutes? } }.
 * Tests a fixed candidate set of dimension pairs (kept small and meaningful
 * rather than every possible combination) and returns the strongest
 * correlation that clears both the sample-size and effect-size gates, or
 * null if nothing does. `excludePairs` (a Set of "a|b" keys, either order)
 * lets the caller skip pairs that are already being tracked as a pattern,
 * so re-detection only surfaces genuinely new relationships.
 */
function detectStrongestPattern(dayMap, excludePairs) {
  const candidates = [];
  for (const [a, b] of CANDIDATE_PAIRS) {
    if (excludePairs && (excludePairs.has(`${a}|${b}`) || excludePairs.has(`${b}|${a}`))) continue;
    const result = correlatePair(dayMap, a, b);
    if (!result) continue;
    if (Math.abs(result.r) >= MIN_ABS_R) {
      candidates.push({ dimensionA: a, dimensionB: b, r: result.r, n: result.n });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return candidates[0];
}

module.exports = { pearson, correlatePair, detectStrongestPattern, MIN_OVERLAPPING_DAYS, MIN_ABS_R };

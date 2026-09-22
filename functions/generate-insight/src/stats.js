const MOOD_SCALE = { struggling: 1, low: 2, okay: 3, good: 4, great: 5 };

/**
 * Deterministic mood-trend statistics — deliberately has no AI dependency
 * so it (and the gating decisions built on it) can run/test without any
 * network calls, per the "rules before AI" cost ladder (spec section 58).
 * `checkins` is expected newest-first (matches the Query.orderDesc call site).
 */
function computeStats(checkins) {
  const values = checkins.map((c) => MOOD_SCALE[c.mood]).filter((v) => v != null);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const recent = values.slice(0, 3);
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { mean, recentMean, stdDev, sampleSize: values.length };
}

module.exports = { computeStats, MOOD_SCALE };

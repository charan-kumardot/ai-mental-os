const { test } = require('node:test');
const assert = require('node:assert');
const { computeBaselines, detectDrift, computeStateEstimate } = require('./baselineStats');

function daysAgoKey(n, ref) {
  const d = new Date(ref);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test('computeBaselines omits a window below its minimum sample size', () => {
  const ref = new Date('2026-09-21T12:00:00Z');
  const dayMap = {
    [daysAgoKey(1, ref)]: { mood: 3 },
    [daysAgoKey(2, ref)]: { mood: 4 },
  };
  const baselines = computeBaselines(dayMap, ref);
  assert.strictEqual(baselines.mood.short, undefined, 'only 2 samples, short needs 3');
});

test('computeBaselines fills short window once minimum samples exist', () => {
  const ref = new Date('2026-09-21T12:00:00Z');
  const dayMap = {};
  for (let i = 1; i <= 5; i++) dayMap[daysAgoKey(i, ref)] = { mood: 3 };
  const baselines = computeBaselines(dayMap, ref);
  assert.ok(baselines.mood.short);
  assert.strictEqual(baselines.mood.short.sampleSize, 5);
  assert.strictEqual(baselines.mood.short.mean, 3);
  assert.strictEqual(baselines.mood.short.stdDev, 0);
});

test('computeBaselines only counts days within each window', () => {
  const ref = new Date('2026-09-21T12:00:00Z');
  const dayMap = {};
  // 5 days within the short window (mood=5), 20 more days outside it (mood=1).
  for (let i = 1; i <= 5; i++) dayMap[daysAgoKey(i, ref)] = { mood: 5 };
  for (let i = 10; i <= 29; i++) dayMap[daysAgoKey(i, ref)] = { mood: 1 };
  const baselines = computeBaselines(dayMap, ref);
  assert.strictEqual(baselines.mood.short.mean, 5, 'short window should only see the recent 7 days');
  assert.strictEqual(baselines.mood.medium.sampleSize, 25, 'medium window (30d) should see all 25 days');
});

test('computeBaselines ignores future-dated entries (daysAgo negative)', () => {
  const ref = new Date('2026-09-21T12:00:00Z');
  const dayMap = { [daysAgoKey(-3, ref)]: { mood: 5 }, [daysAgoKey(1, ref)]: { mood: 3 } };
  const baselines = computeBaselines(dayMap, ref);
  // Only the daysAgo>=1 entry should ever count toward sampleSize.
  assert.strictEqual(baselines.mood.short, undefined, 'only 1 valid sample, below MIN_SAMPLES.short=3');
});

test('detectDrift finds no drift when medium and long baselines match', () => {
  const baselines = {
    mood: { medium: { mean: 3, stdDev: 0.5, sampleSize: 20 }, long: { mean: 3, stdDev: 0.5, sampleSize: 60 } },
    sleepMinutes: {},
    steps: {},
    meetingCount: {},
  };
  assert.deepStrictEqual(detectDrift(baselines), []);
});

test('detectDrift finds a real drift when medium diverges from long by more than 0.75 stdDev', () => {
  const baselines = {
    mood: { medium: { mean: 4.5, stdDev: 0.5, sampleSize: 20 }, long: { mean: 3, stdDev: 0.5, sampleSize: 60 } },
    sleepMinutes: {},
    steps: {},
    meetingCount: {},
  };
  const drifts = detectDrift(baselines);
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].dimension, 'mood');
  assert.strictEqual(drifts[0].direction, 'up');
});

test('detectDrift requires the long baseline to have enough samples first', () => {
  const baselines = {
    mood: { medium: { mean: 4.5, stdDev: 0.5, sampleSize: 20 }, long: { mean: 3, stdDev: 0.5, sampleSize: 5 } },
    sleepMinutes: {},
    steps: {},
    meetingCount: {},
  };
  assert.deepStrictEqual(detectDrift(baselines), []);
});

test('computeStateEstimate leaves focus and stress null — no real source exists for them', () => {
  const baselines = { steps: { short: { mean: 5000, stdDev: 1000, sampleSize: 7 } } };
  const { state } = computeStateEstimate({ steps: 5000 }, baselines);
  assert.strictEqual(state.focus, null);
  assert.strictEqual(state.stress, null);
});

test('computeStateEstimate maps a value clearly above baseline to "high"', () => {
  const baselines = { steps: { short: { mean: 5000, stdDev: 500, sampleSize: 7 } } };
  const { state, confidence } = computeStateEstimate({ steps: 8000 }, baselines);
  assert.strictEqual(state.energy, 'high');
  assert.ok(confidence > 0);
});

test('computeStateEstimate maps a value clearly below baseline to "low"', () => {
  const baselines = { sleepMinutes: { short: { mean: 450, stdDev: 30, sampleSize: 7 } } };
  const { state } = computeStateEstimate({ sleepMinutes: 300 }, baselines);
  assert.strictEqual(state.recovery, 'low');
});

test('computeStateEstimate returns hasAnyEstimate=false with zero real signal', () => {
  const result = computeStateEstimate({}, {});
  assert.strictEqual(result.hasAnyEstimate, false);
  assert.strictEqual(result.confidence, 0);
});

test('computeStateEstimate bumps mentalLoad up when unresolved inbox is large, but never invents it from nothing', () => {
  const baselines = { meetingCount: { short: { mean: 3, stdDev: 1, sampleSize: 7 } } };
  const low = computeStateEstimate({ meetingCount: 1 }, baselines, 0);
  assert.strictEqual(low.state.mentalLoad, 'low');
  const bumped = computeStateEstimate({ meetingCount: 1 }, baselines, 6);
  assert.strictEqual(bumped.state.mentalLoad, 'moderate', 'a large unresolved inbox should bump a low reading up');
});

test('computeStateEstimate can flag mentalLoad from inbox alone when calendar is not connected', () => {
  const result = computeStateEstimate({}, {}, 12);
  assert.strictEqual(result.state.mentalLoad, 'high');
  assert.strictEqual(result.hasAnyEstimate, true);
});

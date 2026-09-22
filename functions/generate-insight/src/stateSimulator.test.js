const { test } = require('node:test');
const assert = require('node:assert');
const { computeSimilarDays } = require('./stateSimulator');

const REF = new Date('2026-02-01T00:00:00.000Z');
const baselines = {
  steps: { short: { mean: 5000, stdDev: 1000, sampleSize: 20 } },
  sleepMinutes: { short: { mean: 420, stdDev: 40, sampleSize: 20 } },
};

function dayKey(daysAgo) {
  const d = new Date(REF.getTime() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

test('skipped when today has no estimated state at all', () => {
  const result = computeSimilarDays({}, baselines, { energy: null, recovery: null }, REF);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'no_current_state');
});

test('skipped when fewer than MIN_SIMILAR_DAYS match', () => {
  const dayMap = {
    [dayKey(1)]: { steps: 5000, sleepMinutes: 420, mood: 3 }, // moderate/moderate
  };
  const result = computeSimilarDays(dayMap, baselines, { energy: 'low', recovery: 'low' }, REF);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'not_enough_similar_days');
});

test('finds real similar-energy days and reports their real average mood', () => {
  const dayMap = {
    [dayKey(1)]: { steps: 2000, sleepMinutes: 420, mood: 2 }, // low energy, moderate recovery
    [dayKey(2)]: { steps: 2100, sleepMinutes: 420, mood: 3 },
    [dayKey(3)]: { steps: 2200, sleepMinutes: 420, mood: 4 },
    [dayKey(4)]: { steps: 7000, sleepMinutes: 420, mood: 5 }, // high energy — should not match
  };
  const result = computeSimilarDays(dayMap, baselines, { energy: 'low', recovery: null }, REF);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.simulation.similarDayCount, 3);
  assert.strictEqual(result.simulation.averageMood, 3); // (2+3+4)/3
  assert.deepStrictEqual(result.simulation.matchedOn, ['energy']);
});

test('excludes today itself and future-dated entries', () => {
  const dayMap = {
    [dayKey(0)]: { steps: 2000, sleepMinutes: 420, mood: 1 }, // "today" — must be excluded
    [dayKey(-1)]: { steps: 2000, sleepMinutes: 420, mood: 1 }, // future — must be excluded
    [dayKey(1)]: { steps: 2000, sleepMinutes: 420, mood: 3 },
    [dayKey(2)]: { steps: 2000, sleepMinutes: 420, mood: 3 },
    [dayKey(3)]: { steps: 2000, sleepMinutes: 420, mood: 3 },
  };
  const result = computeSimilarDays(dayMap, baselines, { energy: 'low', recovery: null }, REF);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.simulation.similarDayCount, 3);
  assert.strictEqual(result.simulation.averageMood, 3);
});

test('never fabricates a match when neither dimension is known for a historical day', () => {
  const dayMap = {
    [dayKey(1)]: { mood: 5 }, // no steps/sleep at all
    [dayKey(2)]: { mood: 5 },
    [dayKey(3)]: { mood: 5 },
  };
  const result = computeSimilarDays(dayMap, baselines, { energy: 'low', recovery: null }, REF);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'not_enough_similar_days');
});

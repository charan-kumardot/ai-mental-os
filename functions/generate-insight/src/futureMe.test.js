const { test } = require('node:test');
const assert = require('node:assert');
const { computeLagEffect } = require('./futureMe');

test('finds a real next-day effect from consecutive day pairs', () => {
  const dayMap = {
    '2026-01-01': { sleepMinutes: 250, steps: 3000 },
    '2026-01-02': { sleepMinutes: 400, steps: 9000 },
    '2026-01-03': { sleepMinutes: 240, steps: 2500 },
    '2026-01-04': { sleepMinutes: 410, steps: 9500 },
    '2026-01-05': { sleepMinutes: 230, steps: 2800 },
    '2026-01-06': { sleepMinutes: 405, steps: 9200 },
  };
  const effect = computeLagEffect(dayMap, (v) => v.sleepMinutes < 300, 'steps');
  assert.ok(effect);
  assert.strictEqual(effect.triggerDayCount, 3);
  assert.ok(effect.followingAvg > effect.overallAvg); // short-sleep days precede high-step days here
});

test('returns null below the minimum trigger-day floor', () => {
  const dayMap = {
    '2026-01-01': { sleepMinutes: 250, steps: 3000 },
    '2026-01-02': { sleepMinutes: 400, steps: 9000 },
  };
  const effect = computeLagEffect(dayMap, (v) => v.sleepMinutes < 300, 'steps');
  assert.strictEqual(effect, null);
});

test('ignores a trigger day whose following day is missing from the map', () => {
  const dayMap = {
    '2026-01-01': { sleepMinutes: 250, steps: 3000 },
    // no 2026-01-02
    '2026-01-03': { sleepMinutes: 240, steps: 2500 },
    '2026-01-04': { sleepMinutes: 410, steps: 9500 },
  };
  const effect = computeLagEffect(dayMap, (v) => v.sleepMinutes < 300, 'steps');
  assert.strictEqual(effect, null); // only 1 real trigger->following pair, below floor
});

test('returns null when the outcome dimension has no data anywhere', () => {
  const dayMap = { '2026-01-01': { sleepMinutes: 250 } };
  const effect = computeLagEffect(dayMap, () => true, 'steps');
  assert.strictEqual(effect, null);
});

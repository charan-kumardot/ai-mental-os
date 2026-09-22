const { test } = require('node:test');
const assert = require('node:assert');
const { computeDeltas } = require('./whatHappened');

test('reports a sleep delta once it clears the 15-minute floor', () => {
  const deltas = computeDeltas({ sleepMinutes: 300 }, { sleepMinutes: { short: { mean: 400, stdDev: 30, sampleSize: 7 } } });
  assert.strictEqual(deltas.length, 1);
  assert.match(deltas[0], /100 minutes below your normal/);
});

test('does not report a sleep delta below the 15-minute floor', () => {
  const deltas = computeDeltas({ sleepMinutes: 395 }, { sleepMinutes: { short: { mean: 400, stdDev: 30, sampleSize: 7 } } });
  assert.strictEqual(deltas.length, 0);
});

test('reports multiple real deltas together', () => {
  const deltas = computeDeltas(
    { sleepMinutes: 300, steps: 2000, meetingCount: 6 },
    {
      sleepMinutes: { short: { mean: 420, stdDev: 20, sampleSize: 10 } },
      steps: { short: { mean: 8000, stdDev: 1500, sampleSize: 10 } },
      meetingCount: { short: { mean: 3, stdDev: 1, sampleSize: 10 } },
    }
  );
  assert.strictEqual(deltas.length, 3);
});

test('never reports a delta for a dimension with no baseline yet', () => {
  const deltas = computeDeltas({ sleepMinutes: 100 }, {});
  assert.strictEqual(deltas.length, 0);
});

test('never reports a delta for a dimension with no real today value', () => {
  const deltas = computeDeltas({}, { sleepMinutes: { short: { mean: 400, stdDev: 30, sampleSize: 7 } } });
  assert.strictEqual(deltas.length, 0);
});

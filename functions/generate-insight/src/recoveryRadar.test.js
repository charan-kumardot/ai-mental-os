const { test } = require('node:test');
const assert = require('node:assert');
const { computeRecoveryDeltas } = require('./recoveryRadar');

test('reports a sleep delta once it clears the 15-minute floor', () => {
  const deltas = computeRecoveryDeltas(
    { sleepMinutes: 350 },
    { sleepMinutes: { medium: { mean: 420, stdDev: 20, sampleSize: 20 } } }
  );
  assert.strictEqual(deltas.length, 1);
  assert.match(deltas[0].text, /70 minutes below your normal/);
});

test('does not report a delta below the floor', () => {
  const deltas = computeRecoveryDeltas(
    { sleepMinutes: 410 },
    { sleepMinutes: { medium: { mean: 420, stdDev: 20, sampleSize: 20 } } }
  );
  assert.strictEqual(deltas.length, 0);
});

test('never reports a delta for a dimension with no medium baseline yet', () => {
  const deltas = computeRecoveryDeltas({ sleepMinutes: 100 }, {});
  assert.strictEqual(deltas.length, 0);
});

test('reports multiple real deltas together', () => {
  const deltas = computeRecoveryDeltas(
    { sleepMinutes: 350, steps: 3000, meetingCount: 6 },
    {
      sleepMinutes: { medium: { mean: 420, stdDev: 20, sampleSize: 20 } },
      steps: { medium: { mean: 8000, stdDev: 1500, sampleSize: 20 } },
      meetingCount: { medium: { mean: 3, stdDev: 1, sampleSize: 20 } },
    }
  );
  assert.strictEqual(deltas.length, 3);
});

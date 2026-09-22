const { test } = require('node:test');
const assert = require('node:assert');
const { computeStats } = require('./stats');

test('computes mean, recent mean, stdDev and sample size', () => {
  // newest-first, matching Query.orderDesc('$createdAt')
  const checkins = [
    { mood: 'low' }, // 2
    { mood: 'struggling' }, // 1
    { mood: 'low' }, // 2
    { mood: 'okay' }, // 3
    { mood: 'okay' }, // 3
    { mood: 'great' }, // 5
  ];
  const stats = computeStats(checkins);
  assert.strictEqual(stats.sampleSize, 6);
  assert.ok(Math.abs(stats.mean - 16 / 6) < 1e-9);
  assert.ok(Math.abs(stats.recentMean - 5 / 3) < 1e-9); // (2+1+2)/3
  assert.ok(stats.stdDev > 0);
});

test('recentMean equals mean when fewer than 3 check-ins exist', () => {
  const stats = computeStats([{ mood: 'great' }, { mood: 'low' }]);
  assert.strictEqual(stats.sampleSize, 2);
  assert.strictEqual(stats.recentMean, stats.mean);
});

test('ignores unrecognized mood values rather than producing NaN', () => {
  const stats = computeStats([{ mood: 'okay' }, { mood: 'not_a_real_mood' }, { mood: 'good' }]);
  assert.strictEqual(stats.sampleSize, 2);
  assert.ok(!Number.isNaN(stats.mean));
});

test('a flat trend produces zero deviation (the no-op gate in main.js)', () => {
  const stats = computeStats(Array(6).fill({ mood: 'okay' }));
  const deviation = stats.recentMean - stats.mean;
  assert.strictEqual(deviation, 0);
});

test('a genuine downward trend crosses the 0.4 gate threshold used in main.js', () => {
  // 3 recent "low" (2) against a baseline padded with "great" (5)
  const checkins = [
    { mood: 'low' },
    { mood: 'low' },
    { mood: 'low' },
    { mood: 'great' },
    { mood: 'great' },
    { mood: 'great' },
  ];
  const stats = computeStats(checkins);
  const deviation = stats.recentMean - stats.mean;
  assert.ok(Math.abs(deviation) >= 0.4, `expected a gate-crossing deviation, got ${deviation}`);
  assert.ok(deviation < 0, 'expected a downward deviation');
});

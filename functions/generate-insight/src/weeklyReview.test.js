const { test } = require('node:test');
const assert = require('node:assert');
const { computeDailyMoodSeries } = require('./weeklyReview');

test('averages multiple same-day check-ins into one point', () => {
  const series = computeDailyMoodSeries([
    { mood: 'good', $createdAt: '2026-09-15T08:00:00.000Z' },
    { mood: 'okay', $createdAt: '2026-09-15T20:00:00.000Z' },
  ]);
  assert.strictEqual(series.length, 1);
  assert.strictEqual(series[0].date, '2026-09-15');
  assert.strictEqual(series[0].value, 3.5); // (4 + 3) / 2
});

test('never fills in a day with no check-in — sparse weeks stay sparse', () => {
  const series = computeDailyMoodSeries([
    { mood: 'great', $createdAt: '2026-09-15T08:00:00.000Z' },
    { mood: 'low', $createdAt: '2026-09-19T08:00:00.000Z' },
  ]);
  assert.strictEqual(series.length, 2);
  assert.ok(!series.some((p) => p.date === '2026-09-16'));
});

test('returns points sorted chronologically regardless of input order', () => {
  const series = computeDailyMoodSeries([
    { mood: 'good', $createdAt: '2026-09-19T08:00:00.000Z' },
    { mood: 'great', $createdAt: '2026-09-15T08:00:00.000Z' },
  ]);
  assert.deepStrictEqual(series.map((p) => p.date), ['2026-09-15', '2026-09-19']);
});

test('skips a check-in with an unrecognized mood value rather than throwing', () => {
  const series = computeDailyMoodSeries([{ mood: 'not_a_real_mood', $createdAt: '2026-09-15T08:00:00.000Z' }]);
  assert.strictEqual(series.length, 0);
});

test('returns an empty series for no check-ins', () => {
  assert.deepStrictEqual(computeDailyMoodSeries([]), []);
});

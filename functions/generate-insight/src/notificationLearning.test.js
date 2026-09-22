const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateReminderEffectiveness } = require('./notificationLearning');

const REF = new Date('2026-02-15T00:00:00.000Z');

function daysAgoIso(n) {
  return new Date(REF.getTime() - n * 86400000).toISOString();
}

test('skips silently when the reminder is disabled', () => {
  const result = evaluateReminderEffectiveness([daysAgoIso(1)], false, REF);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'reminder_disabled');
});

test('recommends reducing when response rate is genuinely low', () => {
  // Only 2 of the last 14 days have a check-in.
  const dates = [daysAgoIso(1), daysAgoIso(2)];
  const result = evaluateReminderEffectiveness(dates, true, REF);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.learning.recommendation, 'reduce');
  assert.strictEqual(result.learning.daysWithCheckin, 2);
});

test('recommends keeping when response rate is healthy', () => {
  const dates = Array.from({ length: 10 }, (_, i) => daysAgoIso(i));
  const result = evaluateReminderEffectiveness(dates, true, REF);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.learning.recommendation, 'keep');
  assert.strictEqual(result.learning.daysWithCheckin, 10);
});

test('counts multiple check-ins on the same day only once', () => {
  const dates = [daysAgoIso(1), daysAgoIso(1), daysAgoIso(1)];
  const result = evaluateReminderEffectiveness(dates, true, REF);
  assert.strictEqual(result.learning.daysWithCheckin, 1);
});

test('ignores check-ins outside the lookback window', () => {
  const dates = [daysAgoIso(1), daysAgoIso(30)]; // 30 days ago is outside the 14-day window
  const result = evaluateReminderEffectiveness(dates, true, REF);
  assert.strictEqual(result.learning.daysWithCheckin, 1);
});

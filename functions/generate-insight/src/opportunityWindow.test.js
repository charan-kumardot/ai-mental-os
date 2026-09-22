const { test } = require('node:test');
const assert = require('node:assert');
const { computeOpportunityWindow } = require('./opportunityWindow');

function checkin(mood, hourOfDay) {
  // Built directly as a UTC timestamp (Date.UTC, not the local-time Date
  // constructor) so `hourOfDay` means exactly what it says regardless of
  // which timezone the test happens to run in — the source now extracts the
  // hour via Intl.DateTimeFormat with an explicit timezone (default 'UTC'
  // when the caller passes none), not the machine's ambient local time.
  return { mood, $createdAt: new Date(Date.UTC(2026, 0, 1, hourOfDay, 0, 0)).toISOString() };
}

test('skips when fewer than 2 hour buckets have enough samples', () => {
  const checkins = [checkin('good', 9), checkin('good', 10), checkin('good', 11)];
  const result = computeOpportunityWindow(checkins);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'not_enough_spread');
});

test('skips when there is no meaningful gap between the best and worst bucket', () => {
  const checkins = [
    ...[9, 10, 11].map((h) => checkin('good', h)), // morning
    ...[17, 18, 19].map((h) => checkin('good', h)), // evening — same mood, no gap
  ];
  const result = computeOpportunityWindow(checkins);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'no_meaningful_gap');
});

test('finds a real, engineered morning-strong / evening-weak opportunity window', () => {
  const checkins = [
    ...[9, 10, 11, 9, 10].map((h) => checkin('great', h)), // morning, mood=5
    ...[17, 18, 19, 17, 18].map((h) => checkin('low', h)), // evening, mood=2
  ];
  const result = computeOpportunityWindow(checkins);
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.window.bestBucket, 'morning');
  assert.strictEqual(result.window.worstBucket, 'evening');
  assert.strictEqual(result.window.bestAvg, 5);
  assert.strictEqual(result.window.worstAvg, 2);
  assert.strictEqual(result.window.bestCount, 5);
});

test('buckets by the USER\'s timezone, not the server process\'s local time', () => {
  // 9pm IST (Asia/Kolkata, UTC+5:30) is 3:30pm UTC. Without the timezone
  // fix, a server running in UTC would read this as hour 15 ("afternoon")
  // instead of the user's real local hour 21 ("night") — exactly the bug
  // that made real seeded evening check-ins for an Asia/Calcutta test
  // account bucket incorrectly before this fix.
  const nightIST = { mood: 'low', $createdAt: '2026-01-01T15:30:00.000Z' };
  const morningIST = { mood: 'great', $createdAt: '2026-01-02T03:30:00.000Z' }; // 9am IST
  const checkins = [nightIST, morningIST, morningIST, morningIST, nightIST, nightIST];

  const withoutTimezone = computeOpportunityWindow(checkins); // defaults to UTC
  const withTimezone = computeOpportunityWindow(checkins, 'Asia/Kolkata');

  // Under plain UTC interpretation, 15:30 UTC and 03:30 UTC both land in
  // buckets that don't cleanly separate "morning" from "night" the way the
  // user actually experienced them.
  assert.notDeepStrictEqual(withoutTimezone, withTimezone);
  assert.strictEqual(withTimezone.skipped, false);
  assert.strictEqual(withTimezone.window.bestBucket, 'morning');
  assert.strictEqual(withTimezone.window.worstBucket, 'night');
});

test('ignores check-ins with unrecognized mood values', () => {
  const checkins = [
    ...[9, 10, 11].map((h) => checkin('great', h)),
    { mood: 'not_a_real_mood', $createdAt: '2026-01-01T09:00:00.000Z' },
  ];
  const result = computeOpportunityWindow(checkins);
  // Still only one real bucket (morning) — not enough spread.
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'not_enough_spread');
});

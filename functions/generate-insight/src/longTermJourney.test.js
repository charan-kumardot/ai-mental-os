const { test } = require('node:test');
const assert = require('node:assert');
const { buildMonthlyBeats, describeMonth } = require('./longTermJourney');
const { MIN_OVERLAPPING_DAYS } = require('./patternStats');

function engineeredMonth(monthPrefix, days) {
  const dayMap = {};
  for (let i = 0; i < days; i++) {
    const low = i % 2 === 0;
    const dateKey = `${monthPrefix}-${String(i + 1).padStart(2, '0')}`;
    dayMap[dateKey] = { mood: low ? 2 : 4.5, sleepMinutes: low ? 300 : 480 };
  }
  return dayMap;
}

test('buildMonthlyBeats returns nothing for an empty dayMap', () => {
  assert.deepStrictEqual(buildMonthlyBeats({}), []);
});

test('buildMonthlyBeats skips a month below the overlapping-day gate', () => {
  const dayMap = engineeredMonth('2026-01', MIN_OVERLAPPING_DAYS - 2);
  assert.deepStrictEqual(buildMonthlyBeats(dayMap), []);
});

test('buildMonthlyBeats finds an engineered sleep-mood pattern for a qualifying month', () => {
  const dayMap = engineeredMonth('2026-01', 20);
  const beats = buildMonthlyBeats(dayMap);
  assert.strictEqual(beats.length, 1);
  assert.strictEqual(beats[0].monthKey, '2026-01');
  assert.strictEqual(beats[0].label, 'JAN 2026');
  assert.strictEqual(beats[0].dimensionB, 'sleepMinutes');
  assert.ok(beats[0].confidence > 0);
  assert.ok(beats[0].description.toLowerCase().includes('sleep'));
});

test('buildMonthlyBeats returns beats in chronological order across multiple qualifying months', () => {
  const dayMap = {
    ...engineeredMonth('2026-01', 20),
    ...engineeredMonth('2026-03', 20),
    ...engineeredMonth('2026-02', 20),
  };
  const beats = buildMonthlyBeats(dayMap);
  assert.deepStrictEqual(
    beats.map((b) => b.monthKey),
    ['2026-01', '2026-02', '2026-03']
  );
});

test('buildMonthlyBeats never fabricates a beat for a month with no real pattern', () => {
  const dayMap = {};
  for (let i = 0; i < 20; i++) {
    // Pure noise — no engineered relationship.
    dayMap[`2026-04-${String(i + 1).padStart(2, '0')}`] = { mood: (i * 7) % 5, steps: (i * 13) % 10000 };
  }
  assert.deepStrictEqual(buildMonthlyBeats(dayMap), []);
});

test('describeMonth uses hedged, non-causal language', () => {
  const text = describeMonth({ dimensionA: 'mood', dimensionB: 'sleepMinutes', r: 0.8 });
  assert.ok(text.includes('appears'));
  assert.ok(!text.toLowerCase().includes('causes'));
});

test('describeMonth handles a non-mood pair', () => {
  const text = describeMonth({ dimensionA: 'sleepMinutes', dimensionB: 'meetingCount', r: -0.5 });
  assert.ok(text.toLowerCase().includes('sleep'));
  assert.ok(text.toLowerCase().includes('meeting count'));
});

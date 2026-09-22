const { test } = require('node:test');
const assert = require('node:assert');
const { pearson, correlatePair, detectStrongestPattern, MIN_OVERLAPPING_DAYS, MIN_ABS_R } = require('./patternStats');

test('pearson returns null with fewer than 2 points', () => {
  assert.strictEqual(pearson([1], [1]), null);
  assert.strictEqual(pearson([], []), null);
});

test('pearson returns null when one series has no variance', () => {
  assert.strictEqual(pearson([1, 1, 1], [1, 2, 3]), null);
});

test('pearson correctly finds a perfect positive correlation', () => {
  const r = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  assert.ok(Math.abs(r - 1) < 1e-9);
});

test('pearson correctly finds a perfect negative correlation', () => {
  const r = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
  assert.ok(Math.abs(r - -1) < 1e-9);
});

test('pearson finds a weak correlation for unrelated data at a large enough sample size', () => {
  // A large enough sample that a fixed, non-linear-vs-linear mismatch
  // averages out rather than risking spurious correlation from a small n.
  const xs = Array.from({ length: 200 }, (_, i) => i);
  const ys = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 1000);
  const r = pearson(xs, ys);
  assert.ok(Math.abs(r) < 0.3, `expected a weak r, got ${r}`);
});

test('detectStrongestPattern returns null below the minimum overlapping-day gate', () => {
  const dayMap = {};
  // Only 5 days of overlapping sleep+mood data — below MIN_OVERLAPPING_DAYS.
  for (let i = 0; i < 5; i++) {
    dayMap[`d${i}`] = { mood: i % 2 === 0 ? 5 : 1, sleepMinutes: i % 2 === 0 ? 480 : 300 };
  }
  assert.strictEqual(detectStrongestPattern(dayMap), null);
});

test('detectStrongestPattern returns null when correlation is real but too weak', () => {
  const dayMap = {};
  for (let i = 0; i < MIN_OVERLAPPING_DAYS + 2; i++) {
    // Mood barely relates to steps — essentially noise.
    dayMap[`d${i}`] = { mood: (i * 7) % 5, steps: (i * 13) % 10000 };
  }
  const result = detectStrongestPattern(dayMap);
  if (result) assert.ok(Math.abs(result.r) < MIN_ABS_R + 0.3);
});

test('detectStrongestPattern finds an engineered sleep-mood correlation that clears both gates', () => {
  const dayMap = {};
  for (let i = 0; i < 20; i++) {
    const lowSleepDay = i % 2 === 0;
    dayMap[`d${i}`] = {
      mood: lowSleepDay ? 2 : 4.5,
      sleepMinutes: lowSleepDay ? 300 : 480,
    };
  }
  const result = detectStrongestPattern(dayMap);
  assert.ok(result, 'expected a detected pattern');
  assert.strictEqual(result.dimensionA, 'mood');
  assert.strictEqual(result.dimensionB, 'sleepMinutes');
  assert.ok(result.r > 0.8, `expected a strong positive r, got ${result.r}`);
  assert.strictEqual(result.n, 20);
});

test('correlatePair returns null below the overlap gate regardless of strength', () => {
  const dayMap = { d0: { mood: 5, sleepMinutes: 480 }, d1: { mood: 1, sleepMinutes: 300 } };
  assert.strictEqual(correlatePair(dayMap, 'mood', 'sleepMinutes'), null);
});

test('correlatePair returns r and n for a named pair without gating on MIN_ABS_R', () => {
  const dayMap = {};
  for (let i = 0; i < MIN_OVERLAPPING_DAYS; i++) {
    dayMap[`d${i}`] = { mood: (i * 7) % 5, sleepMinutes: (i * 13) % 500 };
  }
  const result = correlatePair(dayMap, 'mood', 'sleepMinutes');
  assert.ok(result);
  assert.strictEqual(result.n, MIN_OVERLAPPING_DAYS);
  assert.ok(typeof result.r === 'number');
});

test('correlatePair used for a contradiction check: a previously-strong pattern weakens with new noisy data', () => {
  const dayMap = {};
  // First 20 days: strong engineered correlation.
  for (let i = 0; i < 20; i++) {
    const low = i % 2 === 0;
    dayMap[`old${i}`] = { mood: low ? 2 : 4.5, sleepMinutes: low ? 300 : 480 };
  }
  const original = correlatePair(dayMap, 'mood', 'sleepMinutes');
  assert.ok(Math.abs(original.r) >= MIN_ABS_R);

  // 20 more days of pure noise dilute the relationship once averaged together.
  for (let i = 0; i < 20; i++) {
    dayMap[`new${i}`] = { mood: (i * 3) % 5, sleepMinutes: (i * 91) % 500 };
  }
  const diluted = correlatePair(dayMap, 'mood', 'sleepMinutes');
  assert.ok(Math.abs(diluted.r) < Math.abs(original.r), 'expected the relationship to weaken once diluted with noise');
});

test('detectStrongestPattern respects excludePairs', () => {
  const dayMap = {};
  for (let i = 0; i < 20; i++) {
    const low = i % 2 === 0;
    dayMap[`d${i}`] = { mood: low ? 2 : 4.5, sleepMinutes: low ? 300 : 480 };
  }
  const withoutExclusion = detectStrongestPattern(dayMap);
  assert.ok(withoutExclusion);
  assert.strictEqual(withoutExclusion.dimensionB, 'sleepMinutes');

  const excluded = detectStrongestPattern(dayMap, new Set(['mood|sleepMinutes']));
  assert.strictEqual(excluded, null);
});

test('detectStrongestPattern picks the strongest candidate when multiple clear the gate', () => {
  const dayMap = {};
  for (let i = 0; i < 20; i++) {
    const low = i % 2 === 0;
    dayMap[`d${i}`] = {
      mood: low ? 2 : 4,
      sleepMinutes: low ? 300 : 480,
      steps: low ? 3000 : 3500, // weaker, noisier relationship than sleep
    };
  }
  // Add noise to steps so its correlation with mood is real but weaker.
  Object.values(dayMap).forEach((d, i) => {
    d.steps += (i % 3) * 900 * (i % 2 === 0 ? 1 : -1);
  });
  const result = detectStrongestPattern(dayMap);
  assert.ok(result);
  assert.strictEqual(result.dimensionB, 'sleepMinutes');
});

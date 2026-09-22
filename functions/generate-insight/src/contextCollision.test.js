const { test } = require('node:test');
const assert = require('node:assert');
const { detectContextCollision } = require('./contextCollision');

test('no collision when state is null', () => {
  assert.deepStrictEqual(detectContextCollision(null), { collided: false, factors: [] });
});

test('no collision with zero bad factors', () => {
  const result = detectContextCollision({ energy: 'high', recovery: 'high', mentalLoad: 'low' });
  assert.strictEqual(result.collided, false);
});

test('no collision with exactly one bad factor', () => {
  const result = detectContextCollision({ energy: 'low', recovery: 'moderate', mentalLoad: 'low' });
  assert.strictEqual(result.collided, false);
});

test('collision detected with exactly two simultaneous bad factors', () => {
  const result = detectContextCollision({ energy: 'low', recovery: 'low', mentalLoad: 'moderate' });
  assert.strictEqual(result.collided, true);
  assert.deepStrictEqual(result.factors, ['low energy', 'light recovery']);
});

test('collision detected with all three bad factors', () => {
  const result = detectContextCollision({ energy: 'low', recovery: 'low', mentalLoad: 'high' });
  assert.strictEqual(result.collided, true);
  assert.strictEqual(result.factors.length, 3);
});

test('never counts a null/undefined dimension as a bad factor', () => {
  const result = detectContextCollision({ energy: 'low', recovery: null, mentalLoad: undefined });
  assert.strictEqual(result.collided, false);
});

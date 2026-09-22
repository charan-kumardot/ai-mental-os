const { test } = require('node:test');
const assert = require('node:assert');
const { rankInterventions, compileIntervention } = require('./interventionCompiler');

function feedback(interventionId, userFeedback) {
  return { interventionId, userFeedback };
}

test('module exports compileIntervention', () => {
  assert.strictEqual(typeof compileIntervention, 'function');
});

test('returns empty ranking below the total-feedback floor', () => {
  const results = [feedback('a', 'helped'), feedback('a', 'helped')]; // only 2 total
  assert.deepStrictEqual(rankInterventions(results), []);
});

test('excludes an intervention below the per-intervention attempt floor', () => {
  const results = [feedback('a', 'helped'), feedback('b', 'helped'), feedback('b', 'no_effect')];
  // 'a' has only 1 attempt — below MIN_ATTEMPTS_PER_INTERVENTION (2)
  const ranked = rankInterventions(results);
  assert.strictEqual(ranked.find((r) => r.interventionId === 'a'), undefined);
});

test('excludes an intervention with zero real "helped" feedback', () => {
  const results = [feedback('a', 'no_effect'), feedback('a', 'no_effect'), feedback('b', 'helped'), feedback('b', 'helped'), feedback('c', 'helped')];
  const ranked = rankInterventions(results);
  assert.strictEqual(ranked.find((r) => r.interventionId === 'a'), undefined);
});

test('ranks by real help rate, highest first', () => {
  const results = [
    feedback('low', 'helped'),
    feedback('low', 'no_effect'),
    feedback('low', 'no_effect'),
    feedback('high', 'helped'),
    feedback('high', 'helped'),
  ];
  const ranked = rankInterventions(results);
  assert.strictEqual(ranked[0].interventionId, 'high');
  assert.strictEqual(ranked[0].helpRate, 1);
  assert.strictEqual(ranked[1].interventionId, 'low');
  assert.ok(ranked[1].helpRate < 1);
});

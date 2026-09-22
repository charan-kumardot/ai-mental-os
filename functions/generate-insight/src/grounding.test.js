const { test } = require('node:test');
const assert = require('node:assert');
const { buildGroundingPreamble } = require('./grounding');

test('includes every evidence item with its kind tag', () => {
  const text = buildGroundingPreamble([
    { kind: 'observed', text: 'A' },
    { kind: 'pattern', text: 'B' },
  ]);
  assert.ok(text.includes('[observed] A'));
  assert.ok(text.includes('[pattern] B'));
});

test('instructs the model to only use given evidence and never invent data', () => {
  const text = buildGroundingPreamble([{ kind: 'observed', text: 'x' }]);
  assert.ok(/only use the evidence/i.test(text));
  assert.ok(/never invent/i.test(text));
});

test('forbids causal medical claims', () => {
  const text = buildGroundingPreamble([{ kind: 'observed', text: 'x' }]);
  assert.ok(/never claim medical causation/i.test(text));
});

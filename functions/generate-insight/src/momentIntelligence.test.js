const { test } = require('node:test');
const assert = require('node:assert');
const { isPreMomentOutlier, buildPostMomentMessage } = require('./momentIntelligence');

test('isPreMomentOutlier: not an outlier when within normal spread', () => {
  assert.strictEqual(isPreMomentOutlier(5, 4.5, 1.5), false);
});

test('isPreMomentOutlier: real outlier when meaningfully above baseline', () => {
  assert.strictEqual(isPreMomentOutlier(10, 4, 1), true);
});

test('isPreMomentOutlier: never an outlier when baseline has zero variance', () => {
  // Guards against dividing by zero rather than crashing or false-positiving.
  assert.strictEqual(isPreMomentOutlier(10, 4, 0), false);
});

test('isPreMomentOutlier: exactly at the z-threshold counts as an outlier', () => {
  // mean=4, stdDev=2 -> z=0.75 at meetingCount=5.5
  assert.strictEqual(isPreMomentOutlier(5.5, 4, 2), true);
});

test('buildPostMomentMessage: reports both real signals when both exist', () => {
  const msg = buildPostMomentMessage(6, 6, 3.5);
  assert.ok(msg.includes('6 meetings'));
  assert.ok(msg.includes('3.5/5'));
});

test('buildPostMomentMessage: honest fallback when nothing was actually recorded', () => {
  const msg = buildPostMomentMessage(6, null, null);
  assert.strictEqual(msg, 'Not enough was actually recorded that day to compare against the prediction.');
});

test('buildPostMomentMessage: still reports mood even without a calendar match', () => {
  const msg = buildPostMomentMessage(null, null, 4.2);
  assert.ok(msg.includes('4.2/5'));
});

const { Query, ID, Permission, Role } = require('node-appwrite');
const { buildDayMap, DB_ID } = require('./dayMap');
const { computeBaselines, detectDrift, computeStateEstimate, MIN_SAMPLES } = require('./baselineStats');
const { detectContextCollision } = require('./contextCollision');
const { computeSimilarDays } = require('./stateSimulator');

const DIMENSION_LABEL = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting load',
};

// Appwrite document IDs are capped at 36 chars; `${userId}_${dimension}_${windowType}`
// can exceed that (userId alone is already 20), so baseline doc ids use a
// short, unambiguous code per dimension/window instead of the full names.
const DIMENSION_CODE = { mood: 'mo', sleepMinutes: 'sl', steps: 'st', meetingCount: 'mc' };
const WINDOW_CODE = { short: 's', medium: 'm', long: 'l' };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Looks up the existing document by its real unique-key field values
 * rather than guessing a deterministic id — a guessed id can silently
 * drift out of sync with what's actually stored (e.g. after a docId
 * scheme change), which then makes every future update "not found" and
 * every create a unique-constraint violation against the orphaned real
 * row forever. Finding the row by its actual identity first is what
 * makes this a genuine upsert instead of a hopeful guess.
 */
async function upsertDocument(databases, collectionId, uniqueMatch, docId, data, perms, log) {
  const equalityFilters = Object.entries(uniqueMatch).map(([k, v]) => Query.equal(k, v));
  const existing = await databases.listDocuments(DB_ID, collectionId, [...equalityFilters, Query.limit(1)]);
  if (existing.documents.length > 0) {
    return databases.updateDocument(DB_ID, collectionId, existing.documents[0].$id, data);
  }
  try {
    return await databases.createDocument(DB_ID, collectionId, docId, data, perms);
  } catch (createErr) {
    // Another concurrent call created it between our lookup and this
    // create — look it up again and update rather than fail outright.
    if (log) log(`${collectionId} create failed for ${docId} after a miss, re-checking: ${createErr.message}`);
    const recheck = await databases.listDocuments(DB_ID, collectionId, [...equalityFilters, Query.limit(1)]);
    if (recheck.documents.length > 0) {
      return databases.updateDocument(DB_ID, collectionId, recheck.documents[0].$id, data);
    }
    throw createErr;
  }
}

/**
 * Personal Baseline Engine + Personal State Engine + Baseline Drift (spec
 * sections 13-16), orchestrating the pure math in baselineStats.js against
 * real Appwrite data. No AI involved anywhere in this action — it's the
 * same "rules before AI" ladder as the rest of this function: a
 * multidimensional state estimate is exactly the kind of thing that must
 * be real arithmetic over real records, never a model's guess.
 */
async function computeState(databases, userId, log) {
  const [dayMap, unresolvedInboxRes] = await Promise.all([
    buildDayMap(databases, userId, { limit: 300 }),
    databases.listDocuments(DB_ID, 'mental_inbox', [
      Query.equal('userId', userId),
      Query.equal('resolved', false),
      Query.limit(100),
    ]),
  ]);

  const daysWithAnyData = Object.keys(dayMap).length;
  if (daysWithAnyData < MIN_SAMPLES.short) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      message: `${daysWithAnyData} day${daysWithAnyData === 1 ? '' : 's'} of data so far — need at least ${MIN_SAMPLES.short} before a baseline means anything.`,
    };
  }

  const baselines = computeBaselines(dayMap);
  const drifts = detectDrift(baselines);

  // Persist every (dimension, window) baseline that has enough samples to
  // exist — one document per pair, upserted via a deterministic id so
  // re-running this never accumulates duplicates.
  const baselineWrites = [];
  for (const [dimension, windows] of Object.entries(baselines)) {
    for (const [windowType, stats] of Object.entries(windows)) {
      const docId = `${userId}_${DIMENSION_CODE[dimension] || dimension}_${WINDOW_CODE[windowType] || windowType}`;
      const data = { userId, dimension, windowType, mean: stats.mean, stdDev: stats.stdDev, sampleSize: stats.sampleSize };
      const perms = [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))];
      baselineWrites.push(
        upsertDocument(databases, 'baselines', { userId, dimension, windowType }, docId, data, perms, log)
      );
    }
  }
  await Promise.all(baselineWrites);

  const today = dayMap[todayKey()] || {};
  const { state, confidence, hasAnyEstimate } = computeStateEstimate(today, baselines, unresolvedInboxRes.total);

  let stateDoc = null;
  if (hasAnyEstimate) {
    const docId = `${userId}_${todayKey()}`;
    const data = {
      userId,
      date: todayKey(),
      energy: state.energy ?? undefined,
      focus: state.focus ?? undefined,
      stress: state.stress ?? undefined,
      recovery: state.recovery ?? undefined,
      mentalLoad: state.mentalLoad ?? undefined,
      confidence,
    };
    stateDoc = await upsertDocument(
      databases,
      'state_estimates',
      { userId, date: todayKey() },
      docId,
      data,
      [Permission.read(Role.user(userId))],
      log
    );
  }

  const driftMessages = drifts.map((d) => {
    const label = DIMENSION_LABEL[d.dimension] || d.dimension;
    return `Your normal ${label} has shifted ${d.direction === 'up' ? 'higher' : 'lower'} over the last month.`;
  });

  return {
    skipped: false,
    state: hasAnyEstimate ? state : null,
    confidence,
    baselines: formatBaselines(baselines),
    drifts: driftMessages,
    todayValues: today,
    // Spec §34 — combines simultaneous real load factors into one read
    // instead of leaving screens to separately show "low energy" AND "light
    // recovery" AND "heavy load" as three unrelated facts.
    collision: detectContextCollision(hasAnyEstimate ? state : null),
    // Spec §46 — "what conditions have historically preceded this state?"
    // Bounded and explicitly labeled: real similar days and their real
    // average mood, never a claim about what will happen today.
    similarDays: computeSimilarDays(dayMap, baselines, hasAnyEstimate ? state : null),
  };
}

function formatBaselines(baselines) {
  const out = {};
  for (const [dimension, windows] of Object.entries(baselines)) {
    if (Object.keys(windows).length === 0) continue;
    out[dimension] = windows;
  }
  return out;
}

module.exports = { computeState };

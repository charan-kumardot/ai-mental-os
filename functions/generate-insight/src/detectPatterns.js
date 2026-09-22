const { Query, ID, Permission, Role } = require('node-appwrite');
const { buildGroundingPreamble } = require('./grounding');
const { detectStrongestPattern, correlatePair, MIN_OVERLAPPING_DAYS, MIN_ABS_R } = require('./patternStats');
const { buildDayMap } = require('./dayMap');

const DB_ID = 'personal_os';

const DIMENSION_LABEL = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting count',
  meetingMinutes: 'meeting load',
};

/**
 * Cross-dimension pattern detection (spec: "Relationship map") plus a real
 * Contradiction Engine and prediction-calibration loop (spec sections
 * 20-21) — every already-tracked pattern is re-checked against fresh data
 * on each forced refresh, not just trusted forever from the moment it was
 * first found:
 *   - still holds (same sign, still clears the effect-size gate) →
 *     confidence recalculated from the new r/n, contradiction streak reset.
 *   - doesn't hold → contradiction streak increments, confidence genuinely
 *     drops (not reset to 0 — a real Bayesian-ish decay), and after a
 *     second consecutive contradiction the pattern is retired rather than
 *     kept around indefinitely as a stale claim.
 * All of this recalibration is deterministic math — AI is only ever
 * called to phrase a *newly discovered* pattern, never to re-justify one
 * that just got contradicted.
 */
async function detectPatterns(databases, userId, generateFast, env, log, forceRefresh) {
  const [dayMap, trackedRes] = await Promise.all([
    buildDayMap(databases, userId),
    databases.listDocuments(DB_ID, 'patterns', [Query.equal('userId', userId), Query.limit(20)]),
  ]);

  const trackedLive = trackedRes.documents.filter((p) => p.status === 'active' || p.status === 'weakened');

  // Serving cache is both cheaper and more stable for the user (the
  // relationship map shouldn't flip on every reload) — only recalibrate
  // when asked to, or when nothing has been computed yet.
  if (trackedLive.length > 0 && !forceRefresh) {
    return {
      skipped: false,
      cached: true,
      patterns: trackedLive.filter((p) => p.status === 'active').map(formatPattern),
      // Spec §26 "You may have been wrong" — a weakened pattern stays
      // visible (labeled as such) for one more cycle instead of silently
      // vanishing from the relationship map the moment it's contradicted.
      weakened: trackedLive.filter((p) => p.status === 'weakened').map(formatPattern),
    };
  }

  const daysWithAnyData = Object.keys(dayMap).length;
  const daysWithMultipleDimensions = Object.values(dayMap).filter((d) => Object.keys(d).length >= 2).length;

  if (daysWithMultipleDimensions < MIN_OVERLAPPING_DAYS) {
    return {
      skipped: true,
      reason: 'not_enough_data',
      message:
        daysWithAnyData === 0
          ? 'Nothing to look for patterns in yet.'
          : `${daysWithMultipleDimensions} day${daysWithMultipleDimensions === 1 ? '' : 's'} with more than one connected source so far — need at least ${MIN_OVERLAPPING_DAYS} before a real relationship could show up, not just coincidence.`,
    };
  }

  // --- Contradiction Engine / calibration: re-judge every already-tracked
  // pattern against the latest data before looking for anything new. ---
  const recalibrated = [];
  for (const doc of trackedLive) {
    const result = correlatePair(dayMap, doc.dimensionA, doc.dimensionB);
    if (!result) {
      recalibrated.push(doc); // not enough fresh overlap to re-judge yet — leave as-is
      continue;
    }
    const expectedSign = doc.relationshipType === 'positive' ? 1 : -1;
    const stillHolds = Math.abs(result.r) >= MIN_ABS_R && Math.sign(result.r) === expectedSign;

    let status;
    let contradictingCount = doc.contradictingCount || 0;
    let confidence;
    if (stillHolds) {
      confidence = Math.min(Math.abs(result.r) * (result.n / 30), 0.9);
      contradictingCount = 0;
      status = 'active';
    } else {
      contradictingCount += 1;
      confidence = Math.max((doc.confidence || 0.5) * 0.6, 0.1);
      status = contradictingCount >= 2 ? 'retired' : 'weakened';
    }

    const updated = await databases.updateDocument(DB_ID, 'patterns', doc.$id, {
      confidence,
      evidenceCount: result.n,
      contradictingCount,
      status,
    });
    recalibrated.push(updated);
  }

  // --- Look for a genuinely new relationship not already being tracked. ---
  const trackedPairKeys = new Set(trackedLive.map((p) => `${p.dimensionA}|${p.dimensionB}`));
  const found = detectStrongestPattern(dayMap, trackedPairKeys);

  let newDoc = null;
  if (found) {
    const labelA = DIMENSION_LABEL[found.dimensionA] || found.dimensionA;
    const labelB = DIMENSION_LABEL[found.dimensionB] || found.dimensionB;
    const relationshipType = found.r > 0 ? 'positive' : 'negative';

    const evidence = [
      {
        kind: 'observed',
        text: `Across ${found.n} days with both ${labelA} and ${labelB} recorded, the two move together with a correlation of ${found.r.toFixed(2)} (${relationshipType === 'positive' ? 'both tend to rise and fall together' : 'one tends to rise as the other falls'}).`,
      },
    ];

    const preamble =
      buildGroundingPreamble(evidence) +
      `\n\nWrite one short sentence describing this specific relationship between ${labelA} and ${labelB}. Use hedged language ("appears associated with", "tends to"). Never claim it causes anything.`;

    const text = await generateFast(
      [
        { role: 'system', content: preamble },
        { role: 'user', content: 'Write it now.' },
      ],
      env,
      log
    );
    if (!text.trim()) throw new Error('AI provider returned empty pattern description');

    newDoc = await databases.createDocument(
      DB_ID,
      'patterns',
      ID.unique(),
      {
        userId,
        description: text.trim(),
        dimensionA: found.dimensionA,
        dimensionB: found.dimensionB,
        relationshipType,
        confidence: Math.min(Math.abs(found.r) * (found.n / 30), 0.9),
        evidenceCount: found.n,
        contradictingCount: 0,
        status: 'active',
      },
      [Permission.read(Role.user(userId))]
    );

    // Semantic memory (spec §44) — a new real relationship is exactly the
    // kind of thing worth remembering as its own record, not just as a
    // row in `patterns`.
    try {
      await databases.createDocument(
        DB_ID,
        'memory_items',
        ID.unique(),
        {
          userId,
          type: 'pattern',
          content: text.trim(),
          importance: Math.min(Math.abs(found.r), 0.9),
          sensitivity: 'medium',
          source: 'detect_patterns',
        },
        [Permission.read(Role.user(userId))]
      );
    } catch (memErr) {
      if (log) log(`memory_items write failed (non-fatal): ${memErr.message}`);
    }
  }

  const finalActive = [...recalibrated, ...(newDoc ? [newDoc] : [])].filter((p) => p.status === 'active');
  const finalWeakened = recalibrated.filter((p) => p.status === 'weakened');

  if (finalActive.length === 0 && finalWeakened.length === 0) {
    return {
      skipped: true,
      reason: 'no_clear_pattern',
      message: "There's real overlapping data here, but nothing correlates strongly enough yet to call it a pattern rather than noise.",
    };
  }

  return {
    skipped: false,
    cached: false,
    patterns: finalActive.map(formatPattern),
    weakened: finalWeakened.map(formatPattern),
    // Spec §24 "Personal Discoveries" — lets the client show the cinematic
    // reveal only for the pattern actually found in this call, not every
    // already-known one being re-served from cache.
    justDiscoveredId: newDoc ? newDoc.$id : null,
  };
}

function formatPattern(doc) {
  return {
    id: doc.$id,
    description: doc.description,
    dimensionA: doc.dimensionA,
    dimensionB: doc.dimensionB,
    relationshipType: doc.relationshipType,
    confidence: doc.confidence,
    evidenceCount: doc.evidenceCount,
    contradictingCount: doc.contradictingCount || 0,
    status: doc.status || 'active',
  };
}

module.exports = { detectPatterns };

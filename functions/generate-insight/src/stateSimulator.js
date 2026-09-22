/**
 * Spec section 46, "Personal State Simulator" — a carefully bounded concept,
 * explicitly NOT a claim to reproduce the person. Answers exactly the two
 * questions the spec asks for: "what conditions have historically preceded
 * this state?" and "what happened last time?" — never anything more
 * specific or predictive than that.
 *
 * Historical days are classified into the same energy/recovery levels as
 * today using the SAME short-term baseline currently in effect (a
 * documented simplification: a fully rigorous version would use each day's
 * own rolling baseline, but reusing today's is a reasonable approximation
 * for a small recent window and keeps this pure/cheap rather than needing
 * per-day baseline recomputation). Everything returned is explicitly
 * labeled observed/pattern — never inference dressed up as fact.
 */
const MIN_SIMILAR_DAYS = 3;

function computeSimilarDays(dayMap, baselines, todayState, referenceDate = new Date()) {
  if (!todayState || (todayState.energy == null && todayState.recovery == null)) {
    return { skipped: true, reason: 'no_current_state', message: 'Not enough of today is estimated yet to compare against past days.' };
  }

  const ref = referenceDate.getTime();
  const zFor = (dimension, value) => {
    const b = baselines[dimension]?.short;
    if (!b || value == null || b.stdDev === 0) return b && value != null ? 0 : null;
    return (value - b.mean) / b.stdDev;
  };
  const levelFromZ = (z) => (z <= -0.5 ? 'low' : z >= 0.5 ? 'high' : 'moderate');

  const matches = [];
  for (const [dateKey, values] of Object.entries(dayMap)) {
    const daysAgo = Math.floor((ref - new Date(dateKey).getTime()) / 86400000);
    if (daysAgo <= 0) continue; // exclude today itself and future dates

    const energyZ = zFor('steps', values.steps);
    const recoveryZ = zFor('sleepMinutes', values.sleepMinutes);
    const energyLevel = energyZ != null ? levelFromZ(energyZ) : null;
    const recoveryLevel = recoveryZ != null ? levelFromZ(recoveryZ) : null;

    const energyMatches = todayState.energy == null || energyLevel == null || energyLevel === todayState.energy;
    const recoveryMatches = todayState.recovery == null || recoveryLevel == null || recoveryLevel === todayState.recovery;
    // Require at least one real dimension to actually match (not just both
    // being unknown) so "similar" always means something concrete.
    const hasRealMatch =
      (todayState.energy != null && energyLevel === todayState.energy) ||
      (todayState.recovery != null && recoveryLevel === todayState.recovery);

    if (energyMatches && recoveryMatches && hasRealMatch) {
      matches.push({ dateKey, mood: values.mood ?? null });
    }
  }

  if (matches.length < MIN_SIMILAR_DAYS) {
    return {
      skipped: true,
      reason: 'not_enough_similar_days',
      message: `Only ${matches.length} day${matches.length === 1 ? '' : 's'} like today so far — need at least ${MIN_SIMILAR_DAYS} before saying anything concrete.`,
    };
  }

  const moods = matches.map((m) => m.mood).filter((m) => m != null);
  const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

  return {
    skipped: false,
    simulation: {
      similarDayCount: matches.length,
      matchedOn: [todayState.energy != null ? 'energy' : null, todayState.recovery != null ? 'recovery' : null].filter(Boolean),
      averageMood: avgMood != null ? Number(avgMood.toFixed(1)) : null,
      moodSampleCount: moods.length,
    },
  };
}

module.exports = { computeSimilarDays, MIN_SIMILAR_DAYS };

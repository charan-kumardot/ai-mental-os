const { buildDayMap } = require('./dayMap');
const { detectStrongestPattern, MIN_OVERLAPPING_DAYS } = require('./patternStats');

const DIMENSION_LABEL = {
  mood: 'mood',
  sleepMinutes: 'sleep',
  steps: 'steps',
  meetingCount: 'meeting count',
  meetingMinutes: 'meeting load',
};

const MONTH_LABEL = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function label(dim) {
  return DIMENSION_LABEL[dim] || dim;
}

function describeMonth(candidate) {
  const { dimensionA, dimensionB } = candidate;
  if (dimensionA === 'mood' || dimensionB === 'mood') {
    const factor = dimensionA === 'mood' ? dimensionB : dimensionA;
    return `${capitalize(label(factor))} appears to have been the strongest factor associated with your mood.`;
  }
  return `${capitalize(label(dimensionA))} and ${label(dimensionB)} appear closely linked this month.`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Long-Term Journey / "You've changed" (spec §40, §83) — deliberately zero
 * AI calls: the whole point is a real, re-computable fact (which real
 * correlation was strongest in a given month), so a deterministic
 * description is more honest than an AI paraphrase of the same number.
 * Recomputes each month's strongest relationship fresh from that month's
 * own slice of daily data — there is no persisted month-by-month pattern
 * history to draw on, so nothing here is a stored "memory," only real
 * historical data re-analyzed on demand. A month is skipped entirely
 * (never filled with a guess) when it doesn't clear the same sample-size
 * and effect-size gates used everywhere else in pattern detection.
 */
function buildMonthlyBeats(dayMap) {
  const byMonth = {};
  for (const [dateKey, values] of Object.entries(dayMap)) {
    const monthKey = dateKey.slice(0, 7); // YYYY-MM
    if (!byMonth[monthKey]) byMonth[monthKey] = {};
    byMonth[monthKey][dateKey] = values;
  }

  const beats = [];
  for (const monthKey of Object.keys(byMonth).sort()) {
    const monthDayMap = byMonth[monthKey];
    const daysWithMultipleDimensions = Object.values(monthDayMap).filter((d) => Object.keys(d).length >= 2).length;
    if (daysWithMultipleDimensions < MIN_OVERLAPPING_DAYS) continue;

    const candidate = detectStrongestPattern(monthDayMap);
    if (!candidate) continue;

    const [year, month] = monthKey.split('-');
    beats.push({
      monthKey,
      label: `${MONTH_LABEL[Number(month) - 1]} ${year}`,
      description: describeMonth(candidate),
      dimensionA: candidate.dimensionA,
      dimensionB: candidate.dimensionB,
      confidence: Math.min(Math.abs(candidate.r) * (candidate.n / 30), 0.9),
      evidenceCount: candidate.n,
    });
  }
  return beats;
}

async function buildLongTermJourney(databases, userId) {
  const dayMap = await buildDayMap(databases, userId, { limit: 400 });
  const beats = buildMonthlyBeats(dayMap);

  if (beats.length === 0) {
    return {
      skipped: true,
      message: 'Not enough tracked months yet to show a journey — this fills in as more time passes with connected data.',
    };
  }

  return { skipped: false, beats };
}

module.exports = { buildLongTermJourney, buildMonthlyBeats, describeMonth };

const { MOOD_SCALE } = require('./stats');

const HOUR_BUCKET_LABEL = {
  'late night': 'late night (12–6am)',
  morning: 'morning (6am–12pm)',
  afternoon: 'afternoon (12–5pm)',
  evening: 'evening (5–9pm)',
  night: 'night (9pm–12am)',
};

function bucketForHour(hour) {
  if (hour < 6) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// This runs on Appwrite's server (UTC), not the user's device — a check-in
// genuinely made at 8pm in the user's own timezone must not be bucketed by
// the SERVER's local hour (which `.getHours()` would silently do), or every
// non-UTC user gets systematically mislabeled. `Intl.DateTimeFormat` with an
// explicit `timeZone` extracts the real hour in the user's own timezone.
function hourInTimezone(isoString, timezone) {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(isoString));
    return parseInt(formatted, 10);
  } catch {
    // An invalid/unrecognized timezone string falls back to UTC rather than
    // throwing and breaking the whole feature over one bad profile field.
    return new Date(isoString).getUTCHours();
  }
}

/**
 * Spec section 35, "Opportunity Window" — pure, deterministic, no AI: finds
 * the time-of-day bucket with the real, meaningfully-highest average mood.
 * Same honesty gate as everywhere else in this app — requires at least 3
 * check-ins in a bucket before it counts, and at least a 0.5-point real gap
 * between the best and worst bucket before claiming anything, rather than
 * reporting noise as a pattern. Shared by the Opportunity Window feature
 * itself and by the Operating Manual's "I focus best" section, so the two
 * can never disagree with each other.
 */
function computeHourBuckets(checkins, timezone) {
  const byHour = {};
  for (const c of checkins) {
    const hour = hourInTimezone(c.$createdAt, timezone);
    const bucket = bucketForHour(hour);
    const v = MOOD_SCALE[c.mood];
    if (v == null) continue;
    if (!byHour[bucket]) byHour[bucket] = [];
    byHour[bucket].push(v);
  }
  return Object.entries(byHour)
    .filter(([, values]) => values.length >= 3)
    .map(([bucket, values]) => ({
      bucket,
      label: HOUR_BUCKET_LABEL[bucket],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      n: values.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

function computeOpportunityWindow(checkins, timezone) {
  const buckets = computeHourBuckets(checkins, timezone);
  if (buckets.length < 2) {
    return {
      skipped: true,
      reason: 'not_enough_spread',
      message: 'Check in at a few different times of day and this will start finding when you tend to feel strongest.',
    };
  }
  const best = buckets[0];
  const worst = buckets[buckets.length - 1];
  if (best.avg - worst.avg < 0.5) {
    return {
      skipped: true,
      reason: 'no_meaningful_gap',
      message: "Mood looks fairly even across the day so far — no time-of-day window stands out yet.",
    };
  }
  return {
    skipped: false,
    window: {
      bestBucket: best.bucket,
      bestLabel: best.label,
      bestAvg: Number(best.avg.toFixed(1)),
      bestCount: best.n,
      worstBucket: worst.bucket,
      worstLabel: worst.label,
      worstAvg: Number(worst.avg.toFixed(1)),
    },
  };
}

const { Query } = require('node-appwrite');
const DB_ID = 'personal_os';

/** Real user timezone, when set, instead of assuming the server's (Appwrite
 * Cloud's UTC) — see hourInTimezone() above for why this matters. */
async function fetchUserTimezone(databases, userId) {
  try {
    const res = await databases.listDocuments(DB_ID, 'profiles', [Query.equal('userId', userId), Query.limit(1)]);
    return res.documents[0]?.timezone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Life Event Mode / Contextual Modes (spec §17-18) — real, user-set,
 * self-expiring context label, or null once it's expired or never set. */
async function fetchActiveContext(databases, userId) {
  try {
    const res = await databases.listDocuments(DB_ID, 'profiles', [Query.equal('userId', userId), Query.limit(1)]);
    const profile = res.documents[0];
    if (!profile?.activeContextMode || !profile.activeContextExpiresAt) return null;
    if (new Date(profile.activeContextExpiresAt).getTime() <= Date.now()) return null;
    return profile.activeContextLabel || profile.activeContextMode;
  } catch {
    return null;
  }
}

module.exports = { computeOpportunityWindow, computeHourBuckets, HOUR_BUCKET_LABEL, fetchUserTimezone, fetchActiveContext };

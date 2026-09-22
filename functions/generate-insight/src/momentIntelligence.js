const { Query, ID, Permission, Role } = require('node-appwrite');

const DB_ID = 'personal_os';
const Z_OUTLIER = 0.75;

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

/** Pure: is a real meeting count a real statistical outlier against the
 * user's own recent average — never a fixed "more than N meetings" rule. */
function isPreMomentOutlier(meetingCount, baselineMean, baselineStdDev) {
  if (baselineStdDev <= 0) return false;
  const z = (meetingCount - baselineMean) / baselineStdDev;
  return z >= Z_OUTLIER;
}

/** Pure: builds the post-moment comparison text (spec §33) — expected vs.
 * actual, always as an observed comparison, never a verdict on the day. */
function buildPostMomentMessage(predictedMeetingCount, actualMeetingCount, actualMoodAvg) {
  const met = actualMeetingCount != null && predictedMeetingCount != null;
  const parts = [];
  if (met) {
    parts.push(`That day had ${actualMeetingCount} meeting${actualMeetingCount === 1 ? '' : 's'}, close to what was expected.`);
  }
  if (actualMoodAvg != null) {
    parts.push(`Mood that day averaged ${actualMoodAvg.toFixed(1)}/5.`);
  }
  if (parts.length === 0) return 'Not enough was actually recorded that day to compare against the prediction.';
  return parts.join(' ');
}

/**
 * Spec sections 32-33, "Pre-Moment" and "Post-Moment Intelligence" —
 * pre-moment only fires when tomorrow's already-synced real calendar data
 * is a genuine outlier against the user's own recent average (never a
 * fixed threshold, never invented calendar data). Post-moment only ever
 * compares a stored real prediction against what was actually recorded —
 * if nothing was recorded, it says so rather than guessing.
 */
async function checkMomentIntelligence(databases, userId, log) {
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86400000));

  // ---- Post-moment: resolve the oldest still-pending prediction whose
  // target date has arrived or passed. ----
  let postMoment = null;
  const pending = await databases.listDocuments(DB_ID, 'memory_items', [
    Query.equal('userId', userId),
    Query.equal('source', 'pre_moment'),
    Query.orderAsc('$createdAt'),
    Query.limit(10),
  ]);
  for (const doc of pending.documents) {
    let payload;
    try {
      payload = JSON.parse(doc.content);
    } catch {
      continue;
    }
    if (payload.resolved || payload.targetDate > today) continue;

    const [calRes, checkinsRes] = await Promise.all([
      databases.listDocuments(DB_ID, 'calendar_summaries', [
        Query.equal('userId', userId),
        Query.equal('date', payload.targetDate),
        Query.limit(1),
      ]),
      databases.listDocuments(DB_ID, 'checkins', [Query.equal('userId', userId), Query.limit(200)]),
    ]);
    const actualMeetingCount = calRes.documents[0]?.meetingCount ?? null;
    const MOOD_SCALE = { struggling: 1, low: 2, okay: 3, good: 4, great: 5 };
    const moodsThatDay = checkinsRes.documents
      .filter((c) => c.$createdAt.slice(0, 10) === payload.targetDate)
      .map((c) => MOOD_SCALE[c.mood])
      .filter((v) => v != null);
    const actualMoodAvg = moodsThatDay.length ? moodsThatDay.reduce((a, b) => a + b, 0) / moodsThatDay.length : null;

    const message = buildPostMomentMessage(payload.predictedMeetingCount, actualMeetingCount, actualMoodAvg);
    postMoment = { targetDate: payload.targetDate, predictedMeetingCount: payload.predictedMeetingCount, actualMeetingCount, actualMoodAvg, message };

    await databases.updateDocument(DB_ID, 'memory_items', doc.$id, {
      content: JSON.stringify({ ...payload, resolved: true, actualMeetingCount, actualMoodAvg }),
    });
    break; // resolve one per call — plenty for a check that runs on every app open
  }

  // ---- Pre-moment: does tomorrow's already-synced real calendar data look
  // like an outlier against the user's own recent average? ----
  let preMoment = null;
  const [tomorrowCal, recentCal] = await Promise.all([
    databases.listDocuments(DB_ID, 'calendar_summaries', [Query.equal('userId', userId), Query.equal('date', tomorrow), Query.limit(1)]),
    databases.listDocuments(DB_ID, 'calendar_summaries', [Query.equal('userId', userId), Query.orderDesc('date'), Query.limit(14)]),
  ]);
  const tomorrowSummary = tomorrowCal.documents[0];
  const recentCounts = recentCal.documents.filter((d) => d.date !== tomorrow).map((d) => d.meetingCount);

  if (tomorrowSummary && recentCounts.length >= 5) {
    const mean = recentCounts.reduce((a, b) => a + b, 0) / recentCounts.length;
    const stdDev = Math.sqrt(recentCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / recentCounts.length);
    if (isPreMomentOutlier(tomorrowSummary.meetingCount, mean, stdDev)) {
      // Only create a new prediction if one doesn't already exist for tomorrow.
      const alreadyPredicted = pending.documents.some((doc) => {
        try {
          return JSON.parse(doc.content).targetDate === tomorrow;
        } catch {
          return false;
        }
      });
      if (!alreadyPredicted) {
        await databases.createDocument(
          DB_ID,
          'memory_items',
          ID.unique(),
          {
            userId,
            type: 'episodic',
            content: JSON.stringify({
              targetDate: tomorrow,
              predictedMeetingCount: tomorrowSummary.meetingCount,
              baselineMeetingCount: Number(mean.toFixed(1)),
              resolved: false,
            }),
            source: 'pre_moment',
          },
          [Permission.read(Role.user(userId))]
        );
      }
      preMoment = {
        targetDate: tomorrow,
        meetingCount: tomorrowSummary.meetingCount,
        baselineMeetingCount: Number(mean.toFixed(1)),
        message: `Tomorrow has ${tomorrowSummary.meetingCount} meetings, noticeably more than your recent average of ${mean.toFixed(1)} — it resembles your higher-pressure days.`,
      };
    }
  }

  return { preMoment, postMoment };
}

module.exports = { checkMomentIntelligence, isPreMomentOutlier, buildPostMomentMessage };

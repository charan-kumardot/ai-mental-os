const { Query } = require('node-appwrite');
const { MOOD_SCALE } = require('./stats');

const DB_ID = 'personal_os';

/**
 * Builds a { [dateKey]: { mood?, sleepMinutes?, steps?, meetingCount?,
 * meetingMinutes? } } map from the user's real records — the single shared
 * aggregation used by both pattern detection and the baseline/state engine,
 * so "what a day's data looks like" is defined in exactly one place.
 * Multiple check-ins on the same day are averaged into one mood value.
 */
async function buildDayMap(databases, userId, { limit = 200 } = {}) {
  const [checkinsRes, healthRes, calendarRes] = await Promise.all([
    databases.listDocuments(DB_ID, 'checkins', [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(limit)]),
    databases.listDocuments(DB_ID, 'health_data', [Query.equal('userId', userId), Query.limit(limit)]),
    databases.listDocuments(DB_ID, 'calendar_summaries', [Query.equal('userId', userId), Query.limit(limit)]),
  ]);

  const dayMap = {};
  const addTo = (dateKey, field, value) => {
    if (value == null) return;
    if (!dayMap[dateKey]) dayMap[dateKey] = {};
    dayMap[dateKey][field] = value;
  };

  const moodSumByDay = {};
  const moodCountByDay = {};
  for (const c of checkinsRes.documents) {
    const v = MOOD_SCALE[c.mood];
    if (v == null) continue;
    const day = new Date(c.$createdAt).toISOString().slice(0, 10);
    moodSumByDay[day] = (moodSumByDay[day] || 0) + v;
    moodCountByDay[day] = (moodCountByDay[day] || 0) + 1;
  }
  for (const day of Object.keys(moodSumByDay)) {
    addTo(day, 'mood', moodSumByDay[day] / moodCountByDay[day]);
  }

  for (const h of healthRes.documents) {
    if (!h.date) continue;
    addTo(h.date, 'sleepMinutes', h.sleepMinutes);
    addTo(h.date, 'steps', h.steps);
  }

  for (const cal of calendarRes.documents) {
    if (!cal.date) continue;
    addTo(cal.date, 'meetingCount', cal.meetingCount);
    addTo(cal.date, 'meetingMinutes', cal.meetingMinutes);
  }

  return dayMap;
}

module.exports = { buildDayMap, DB_ID };

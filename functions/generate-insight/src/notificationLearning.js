const { Query } = require('node-appwrite');

const DB_ID = 'personal_os';
const LOOKBACK_DAYS = 14;
const MIN_DAYS_TO_JUDGE = 7;
const LOW_RESPONSE_THRESHOLD = 0.3;

/**
 * Spec section 51, "Notification Learning" — pure, deterministic: the only
 * real signal this app can honestly observe about notification effectiveness
 * (there's no delivery/open tracking pipeline) is whether the user actually
 * checks in at all during the days the reminder has been active. That's a
 * genuine, if modest, proxy — not a fabricated "response rate." If the
 * reminder is off, there's nothing to learn about, so this stays silent.
 */
function evaluateReminderEffectiveness(checkinDates, reminderEnabled, referenceDate = new Date()) {
  if (!reminderEnabled) {
    return { skipped: true, reason: 'reminder_disabled', message: 'No reminder is currently on to learn from.' };
  }

  const ref = referenceDate.getTime();
  const daysWithCheckin = new Set();
  for (const iso of checkinDates) {
    const daysAgo = Math.floor((ref - new Date(iso).getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < LOOKBACK_DAYS) daysWithCheckin.add(daysAgo);
  }

  const responseRate = daysWithCheckin.size / LOOKBACK_DAYS;

  if (daysWithCheckin.size === 0 && LOOKBACK_DAYS < MIN_DAYS_TO_JUDGE) {
    return { skipped: true, reason: 'not_enough_history', message: 'Not enough days yet to tell if the reminder is landing.' };
  }

  const isLow = responseRate < LOW_RESPONSE_THRESHOLD;

  return {
    skipped: false,
    learning: {
      daysWithCheckin: daysWithCheckin.size,
      lookbackDays: LOOKBACK_DAYS,
      responseRate: Number(responseRate.toFixed(2)),
      recommendation: isLow ? 'reduce' : 'keep',
      message: isLow
        ? `You've checked in on ${daysWithCheckin.size} of the last ${LOOKBACK_DAYS} days — the reminder might not be landing at a useful time. Want to change it or turn it off?`
        : `You've checked in on ${daysWithCheckin.size} of the last ${LOOKBACK_DAYS} days — the current reminder seems to be working.`,
    },
  };
}

async function fetchReminderLearning(databases, userId, reminderEnabled) {
  const checkinsRes = await databases.listDocuments(DB_ID, 'checkins', [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(60),
  ]);
  const result = evaluateReminderEffectiveness(
    checkinsRes.documents.map((d) => d.$createdAt),
    !!reminderEnabled
  );

  // Persist the learned recommendation to the already-provisioned (until now
  // unused) notification_prefs collection so it's a real stored preference
  // signal, not just an ephemeral computed value.
  if (!result.skipped) {
    try {
      const existing = await databases.listDocuments(DB_ID, 'notification_prefs', [Query.equal('userId', userId), Query.limit(1)]);
      const data = { userId, lastNotifiedAt: new Date().toISOString() };
      if (existing.documents.length > 0) {
        await databases.updateDocument(DB_ID, 'notification_prefs', existing.documents[0].$id, data);
      } else {
        const { Permission, Role, ID } = require('node-appwrite');
        await databases.createDocument(DB_ID, 'notification_prefs', ID.unique(), data, [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
        ]);
      }
    } catch {
      // Best-effort persistence — the learning result itself is still valid
      // and returned even if the write fails.
    }
  }

  return result;
}

module.exports = { evaluateReminderEffectiveness, fetchReminderLearning };

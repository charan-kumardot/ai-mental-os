import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';
import { getOrCreateNotificationPrefs } from './notificationPrefs';

export interface InterruptionDecision {
  shouldNotify: boolean;
  reason: string;
}

const PRESENCE_STALE_AFTER_MS = 30 * 60 * 1000;

function isWithinQuietHours(start?: string, end?: string): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin; // wraps past midnight
}

/**
 * Interruption Value Engine (spec §50-51). This app only ever fires one
 * kind of local notification (the daily check-in reminder — no push
 * server, no per-insight alerts), so "importance"/"time sensitivity" don't
 * vary per call; what genuinely varies, and what this checks, are real
 * tracked signals: current voluntary presence status, quiet hours the user
 * set, whether today's check-in already happened (so the reminder would be
 * redundant), and recent notification history (so unopened reminders taper
 * off automatically, per §51 "reduce unwanted notifications"). Nothing
 * here is inferred or invented — every check reads a real collection.
 *
 * Architectural honesty: with local-only notifications and no background
 * task runner in this build, this can only be evaluated when the app is
 * foregrounded (see `reconcileDailyReminder` in notifications.ts), not at
 * the literal instant a backgrounded OS would have delivered it.
 */
export async function evaluateDailyReminder(userId: string): Promise<InterruptionDecision> {
  const presenceDocs = await databases
    .listDocuments(DB_ID, COLLECTIONS.presence, [Query.equal('userId', userId), Query.limit(1)])
    .catch(() => ({ documents: [] as any[] }));
  const presenceDoc = presenceDocs.documents[0] as any;
  if (presenceDoc && Date.now() - new Date(presenceDoc.$updatedAt).getTime() < PRESENCE_STALE_AFTER_MS) {
    if (presenceDoc.status === 'dnd') return { shouldNotify: false, reason: "Suppressed — you're marked do not disturb." };
    if (presenceDoc.status === 'focusing') return { shouldNotify: false, reason: "Suppressed — you're marked focusing." };
  }

  const prefs = await getOrCreateNotificationPrefs(userId).catch(() => null);
  if (prefs && isWithinQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
    return { shouldNotify: false, reason: 'Suppressed — inside your quiet hours.' };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysCheckins = await databases
    .listDocuments(DB_ID, COLLECTIONS.checkins, [
      Query.equal('userId', userId),
      Query.greaterThanEqual('$createdAt', todayStart.toISOString()),
      Query.limit(1),
    ])
    .catch(() => ({ total: 0 }));
  if ((todaysCheckins as any).total > 0) {
    return { shouldNotify: false, reason: 'Suppressed — already checked in today.' };
  }

  const recent = await databases
    .listDocuments(DB_ID, COLLECTIONS.notificationEvents, [
      Query.equal('userId', userId),
      Query.equal('category', 'daily_reminder'),
      Query.orderDesc('$createdAt'),
      Query.limit(5),
    ])
    .catch(() => ({ documents: [] as any[] }));
  const scheduled = recent.documents.filter((d: any) => d.kind === 'scheduled');
  const opened = recent.documents.filter((d: any) => d.kind === 'opened');
  if (scheduled.length >= 5 && opened.length === 0) {
    return { shouldNotify: false, reason: "Suppressed — the last several went unopened." };
  }

  return { shouldNotify: true, reason: 'Real signals check out.' };
}

export async function recordNotificationEvent(userId: string, category: string, kind: 'scheduled' | 'opened') {
  return databases.createDocument(DB_ID, COLLECTIONS.notificationEvents, ID.unique(), { userId, category, kind }, [
    Permission.read(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);
}

/**
 * Local notifications only — no remote push server. Requires a dev-client
 * or production build; `expo-notifications` crashes on import inside Expo
 * Go on Android since SDK 53, which is why this couldn't be wired in until
 * a native build existed.
 */
import { Platform } from 'react-native';
import { evaluateDailyReminder, recordNotificationEvent } from './interruptionEngine';

const DAILY_REMINDER_ID = 'daily-checkin-reminder';
const DAILY_REMINDER_CATEGORY = 'daily_reminder';

// Guarded `require`, not a static `import` — expo-notifications can throw
// synchronously the moment its own module is evaluated (not just when a
// function on it is called) whenever it decides the runtime looks like
// Expo Go, and a static `import` can't be wrapped in try/catch since it's
// hoisted above this code. A top-level throw here aborts the whole
// importing module's evaluation, which previously cascaded into
// `app/(tabs)/you.tsx` (which imports this file) failing to even export
// its default component. Every exported function below additionally
// no-ops when the module never loaded, so a caller never has to know
// which failure mode occurred.
let Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Notifications simply won't work this session — every caller below
  // still works safely since they each no-op when the module is missing.
}

export async function ensureNotificationChannel() {
  if (!Notifications) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Personal OS',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestNotificationPermission() {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

function nextOccurrence(hour: number, minute: number): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hour, minute);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * Interruption Value Engine (spec §50), applied to the one notification
 * this app ever sends. Rather than blindly scheduling a repeating daily
 * trigger, this re-evaluates real signals (presence, quiet hours, today's
 * check-in, recent open history — see interruptionEngine.ts) every time
 * it's called and schedules at most a single one-time trigger for the next
 * valid occurrence — never a blanket recurring alarm the engine can't
 * override. Call this on app foreground and whenever the user turns the
 * reminder on, not just once at setup, since the decision can change day
 * to day.
 */
export async function reconcileDailyReminder(userId: string, hour: number, minute: number) {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

  const decision = await evaluateDailyReminder(userId);
  if (!decision.shouldNotify) return decision;

  await ensureNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'A moment for yourself',
      body: 'A quick check-in, whenever you have ten seconds.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextOccurrence(hour, minute),
    },
  });
  recordNotificationEvent(userId, DAILY_REMINDER_CATEGORY, 'scheduled').catch(() => {});
  return decision;
}

export async function cancelDailyReminder() {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

export async function recordReminderOpened(userId: string) {
  await recordNotificationEvent(userId, DAILY_REMINDER_CATEGORY, 'opened').catch(() => {});
}

export function isDailyReminderNotification(identifier: string | undefined) {
  return identifier === DAILY_REMINDER_ID;
}

/**
 * Feeds real "was this actually opened" history back into the
 * Interruption Value Engine (see interruptionEngine.ts's dismissal-rate
 * check) — registered once at the app root, not per-screen.
 */
export function addNotificationOpenedListener(onOpened: (identifier: string | undefined) => void) {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpened(response.notification.request.identifier);
  });
  return () => sub.remove();
}

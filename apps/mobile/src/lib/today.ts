import { databases, DB_ID, COLLECTIONS } from './appwrite';

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const STEPS_TARGET = 8000;
const SLEEP_TARGET_MINUTES = 8 * 60;

export interface RingState {
  ratio: number; // 0-1
  label: string;
  tracked: boolean;
}

export interface DayDelta {
  sleepMinutesDelta: number | null;
  meetingCountDelta: number | null;
}

export interface TodayState {
  energy: RingState;
  focus: RingState;
  recovery: RingState;
  delta: DayDelta | null;
  hasAnyData: boolean;
  freeWindowMinutes: number | null;
}

function levelLabel(ratio: number, levels: [string, string, string, string]) {
  if (ratio < 0.3) return levels[0];
  if (ratio < 0.6) return levels[1];
  if (ratio < 0.9) return levels[2];
  return levels[3];
}

async function getDoc(collectionId: string, docId: string) {
  try {
    return await databases.getDocument(DB_ID, collectionId, docId);
  } catch {
    return null;
  }
}

export async function fetchTodayState(userId: string): Promise<TodayState> {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(yesterday);

  const [healthToday, healthYesterday, calendarToday, calendarYesterday] = await Promise.all([
    getDoc(COLLECTIONS.healthData, `${userId}_${todayKey}`),
    getDoc(COLLECTIONS.healthData, `${userId}_${yesterdayKey}`),
    getDoc(COLLECTIONS.calendarSummaries, `${userId}_${todayKey}`),
    getDoc(COLLECTIONS.calendarSummaries, `${userId}_${yesterdayKey}`),
  ]);

  const steps = (healthToday as any)?.steps ?? null;
  const sleepMinutes = (healthToday as any)?.sleepMinutes ?? null;

  const energy: RingState =
    steps == null
      ? { ratio: 0, label: 'None yet', tracked: false }
      : { ratio: Math.min(steps / STEPS_TARGET, 1), label: levelLabel(steps / STEPS_TARGET, ['Low', 'Fair', 'Good', 'Great']), tracked: true };

  const recovery: RingState =
    sleepMinutes == null
      ? { ratio: 0, label: 'None yet', tracked: false }
      : {
          ratio: Math.min(sleepMinutes / SLEEP_TARGET_MINUTES, 1),
          label: levelLabel(sleepMinutes / SLEEP_TARGET_MINUTES, ['Low', 'Building', 'Good', 'Great']),
          tracked: true,
        };

  // No real focus signal exists anywhere in this app yet — honestly "None
  // yet" rather than inventing one from steps/meetings, same principle as
  // the Brain tab's dimension tiles.
  const focus: RingState = { ratio: 0, label: 'None yet', tracked: false };

  let delta: DayDelta | null = null;
  const sleepY = (healthYesterday as any)?.sleepMinutes;
  const meetingsT = (calendarToday as any)?.meetingCount;
  const meetingsY = (calendarYesterday as any)?.meetingCount;
  if (sleepMinutes != null && sleepY != null) {
    delta = {
      sleepMinutesDelta: sleepMinutes - sleepY,
      meetingCountDelta: meetingsT != null && meetingsY != null ? meetingsT - meetingsY : null,
    };
  } else if (meetingsT != null && meetingsY != null) {
    delta = { sleepMinutesDelta: null, meetingCountDelta: meetingsT - meetingsY };
  }

  return {
    energy,
    focus,
    recovery,
    delta,
    hasAnyData: steps != null || sleepMinutes != null || meetingsT != null,
    freeWindowMinutes: (calendarToday as any)?.freeWindowMinutes ?? null,
  };
}

/**
 * Spec section 65, "Recovery Planner" — deterministic, no AI: balances a
 * real free calendar window against real recovery debt instead of treating
 * every open slot as more capacity for work ("Do not fill every empty
 * calendar slot with productivity"). Only ever names a real top-helped
 * intervention if the caller actually has one and it fits the window.
 */
export function buildRecoveryPlan(
  freeWindowMinutes: number | null,
  recoveryDebt: 'building' | 'balanced' | 'ahead' | null,
  topIntervention: { title: string } | null
): string | null {
  if (freeWindowMinutes == null || freeWindowMinutes < 10) return null;
  if (recoveryDebt !== 'building') return null;

  const windowLabel = freeWindowMinutes >= 60 ? `${Math.round(freeWindowMinutes / 60)}h` : `${freeWindowMinutes}m`;
  const suggestion = topIntervention ? ` — maybe "${topIntervention.title}", since that's helped before` : '';
  return `You have a ${windowLabel} open window today. Recovery is building — worth protecting some of it rather than filling it with more work${suggestion}.`;
}

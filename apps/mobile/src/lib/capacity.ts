import { StateLevel } from './stateEngine';
import { MoodValue } from '../components/MoodSelector';

export type CapacityLevel = 'high' | 'normal' | 'low' | 'very_low';

export interface CapacityReason {
  label: string;
  detail: string;
}

export interface CapacityResult {
  level: CapacityLevel;
  score: number;
  reasons: CapacityReason[];
}

const MOOD_PENALTY: Record<MoodValue, number> = {
  great: 0,
  good: 0,
  okay: 1,
  low: 2,
  struggling: 3,
};

const LOAD_PENALTY: Record<StateLevel, number> = { high: 2, moderate: 1, low: 0 };
// Recovery is inverted — low recovery is the penalty, high recovery is good.
const RECOVERY_PENALTY: Record<StateLevel, number> = { low: 2, moderate: 1, high: 0 };

/**
 * Adaptive Capacity Engine — combines every real signal this app already
 * tracks (most recent mood, mental load, recovery) into one internal
 * UX-personalization read, replacing the old mood-only binary gate
 * ("Adaptive Friction Engine"). This is deliberately NOT a medical score:
 * it only ever drives how much the interface asks of the user, never a
 * label shown to them as a diagnosis. Every contributing signal is real
 * and already-tracked — nothing here is invented to fill out the model.
 * With zero real signals available, this honestly returns 'normal' rather
 * than claiming a capacity read it has no evidence for.
 */
export function computeCapacity(input: {
  lastMood?: MoodValue;
  mentalLoad?: StateLevel | null;
  recovery?: StateLevel | null;
}): CapacityResult {
  const reasons: CapacityReason[] = [];
  let score = 0;
  let hasAnySignal = false;

  if (input.lastMood) {
    hasAnySignal = true;
    const penalty = MOOD_PENALTY[input.lastMood];
    score += penalty;
    if (penalty >= 2) {
      reasons.push({ label: 'Mood', detail: `Your last check-in was "${input.lastMood}"` });
    }
  }

  if (input.mentalLoad) {
    hasAnySignal = true;
    const penalty = LOAD_PENALTY[input.mentalLoad];
    score += penalty;
    if (penalty >= 2) {
      reasons.push({ label: 'Mental load', detail: 'Today looks heavy on meetings and unresolved things' });
    }
  }

  if (input.recovery) {
    hasAnySignal = true;
    const penalty = RECOVERY_PENALTY[input.recovery];
    score += penalty;
    if (penalty >= 2) {
      reasons.push({ label: 'Recovery', detail: 'Recovery looks below your normal range' });
    }
  }

  let level: CapacityLevel;
  if (!hasAnySignal) {
    level = 'normal';
  } else if (score === 0) {
    level = 'high';
  } else if (score <= 2) {
    level = 'normal';
  } else if (score <= 4) {
    level = 'low';
  } else {
    level = 'very_low';
  }

  return { level, score, reasons };
}

import { functions } from './appwrite';

export type StateLevel = 'low' | 'moderate' | 'high';

export interface PersonalState {
  energy: StateLevel | null;
  focus: StateLevel | null;
  stress: StateLevel | null;
  recovery: StateLevel | null;
  mentalLoad: StateLevel | null;
}

export interface BaselineWindow {
  mean: number;
  stdDev: number;
  sampleSize: number;
}

export interface StateResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  error?: string;
  state?: PersonalState | null;
  confidence?: number;
  baselines?: Record<string, { short?: BaselineWindow; medium?: BaselineWindow; long?: BaselineWindow }>;
  drifts?: string[];
  todayValues?: { mood?: number; sleepMinutes?: number; steps?: number; meetingCount?: number };
  collision?: { collided: boolean; factors: string[]; message?: string };
  similarDays?: {
    skipped: boolean;
    reason?: string;
    message?: string;
    simulation?: { similarDayCount: number; matchedOn: string[]; averageMood: number | null; moodSampleCount: number };
  };
}

export async function fetchPersonalState(): Promise<StateResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'compute_state' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

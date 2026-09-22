import { functions } from './appwrite';
import { getCommunicationStyle } from './interactionPreference';

export interface RecoveryRadarResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  daysThisWeek?: number;
  thisWeekAvg?: { sleepMinutes: number | null; steps: number | null; meetingCount: number | null };
  deltas?: string[];
  narrative?: string | null;
  error?: string;
}

export async function fetchRecoveryRadar(): Promise<RecoveryRadarResult> {
  const communicationStyle = await getCommunicationStyle();
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'recovery_radar', communicationStyle }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

import { functions } from './appwrite';

export interface MomentIntelligenceResult {
  skipped: boolean;
  preMoment?: { targetDate: string; meetingCount: number; baselineMeetingCount: number; message: string } | null;
  postMoment?: { targetDate: string; predictedMeetingCount: number | null; actualMeetingCount: number | null; actualMoodAvg: number | null; message: string } | null;
  error?: string;
}

export async function fetchMomentIntelligence(): Promise<MomentIntelligenceResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'moment_intelligence' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

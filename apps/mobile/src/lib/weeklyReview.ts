import { functions } from './appwrite';

export interface WeeklyReviewResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  sampleSize?: number;
  review?: {
    checkinCount: number;
    mostCommonMood: string;
    averageMood: number;
    trendVsPriorWeek: 'up' | 'down' | 'flat' | null;
    narrative: string;
    dailyMoodSeries: { date: string; value: number }[];
  };
  error?: string;
}

export async function fetchWeeklyReview(): Promise<WeeklyReviewResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'weekly_review' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

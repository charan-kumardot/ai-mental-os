import { functions } from './appwrite';

export type FutureMePreset = 'short_sleep' | 'heavy_meetings' | 'low_movement';

export interface FutureMeResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  label?: string;
  outcomeLabel?: string;
  triggerDayCount?: number;
  direction?: string;
  text?: string;
  error?: string;
}

export async function fetchFutureMe(preset: FutureMePreset): Promise<FutureMeResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'future_me', preset }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

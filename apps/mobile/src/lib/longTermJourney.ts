import { functions } from './appwrite';

export interface JourneyBeat {
  monthKey: string;
  label: string;
  description: string;
  dimensionA: string;
  dimensionB: string;
  confidence: number;
  evidenceCount: number;
}

export interface LongTermJourneyResult {
  skipped: boolean;
  message?: string;
  beats?: JourneyBeat[];
  error?: string;
}

export async function fetchLongTermJourney(): Promise<LongTermJourneyResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'long_term_journey' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

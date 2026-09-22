import { functions } from './appwrite';

export interface OpportunityWindowResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  window?: {
    bestBucket: string;
    bestLabel: string;
    bestAvg: number;
    bestCount: number;
    worstBucket: string;
    worstLabel: string;
    worstAvg: number;
  };
  error?: string;
}

export async function fetchOpportunityWindow(): Promise<OpportunityWindowResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'opportunity_window' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

import { functions } from './appwrite';

export interface OperatingManualSection {
  key: string;
  label: string;
  text: string;
}

export interface OperatingManualResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  manual?: { sections: OperatingManualSection[]; evidenceCount: number };
  error?: string;
}

export async function fetchOperatingManual(): Promise<OperatingManualResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'operating_manual' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

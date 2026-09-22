import { functions } from './appwrite';

export async function simulateDecision(decisionId: string): Promise<{ skipped: boolean; exploration?: string; error?: string }> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'simulate_decision', decisionId }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

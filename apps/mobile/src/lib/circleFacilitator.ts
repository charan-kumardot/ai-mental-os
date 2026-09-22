import { functions } from './appwrite';

export async function facilitateCircle(circleId: string): Promise<{ skipped: boolean; reason?: string; message?: { id: string; content: string }; error?: string }> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'facilitate_circle', circleId }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

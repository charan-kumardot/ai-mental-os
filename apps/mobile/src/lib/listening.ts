import { functions } from './appwrite';

export async function reflectOnEntry(content: string): Promise<{ skipped: boolean; reflection?: string; error?: string }> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'listen_reflect', content }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

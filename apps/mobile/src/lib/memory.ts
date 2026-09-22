import { functions } from './appwrite';

export interface MemoryItem {
  id: string;
  type: 'episodic' | 'semantic' | 'pattern' | 'intervention' | 'experiment';
  content: string;
  importance: number | null;
  sensitivity: 'low' | 'medium' | 'high';
  source: string | null;
  outdated: boolean;
  createdAt: string;
}

export async function recordMemory(input: {
  type: MemoryItem['type'];
  content: string;
  importance?: number;
  sensitivity?: MemoryItem['sensitivity'];
  source?: string;
}) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'record_memory', ...input }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function listMemories(limit = 20): Promise<{ memories: MemoryItem[] }> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'list_memories', limit }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{"memories":[]}');
}

export async function forgetMemory(memoryId: string) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'forget_memory', memoryId }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function markMemoryOutdated(memoryId: string, outdated: boolean) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'mark_memory_outdated', memoryId, outdated }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function correctMemory(memoryId: string, content: string) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'correct_memory', memoryId, content }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

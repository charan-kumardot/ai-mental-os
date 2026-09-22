import { functions } from './appwrite';

export interface CompiledRoutineResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  routine?: { text: string; minutesAvailable: number; basedOn: string[] };
  error?: string;
}

export async function compileIntervention(minutesAvailable: number): Promise<CompiledRoutineResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'compile_intervention', minutesAvailable }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

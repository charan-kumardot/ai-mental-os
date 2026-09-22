import { functions } from './appwrite';

export type RehearsalMode =
  | 'difficult_conversation'
  | 'interview'
  | 'presentation'
  | 'boundary'
  | 'apology'
  | 'asking_for_help'
  | 'manager_conversation'
  | 'relationship_conversation';

export async function rehearseConversation(mode: RehearsalMode, situation: string, plannedWords: string) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'rehearse_conversation', mode, situation, plannedWords }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}') as { skipped: boolean; result?: string; error?: string };
}

export type BoundaryTone = 'gentle' | 'direct' | 'professional' | 'warm' | 'short';

export interface BoundaryInput {
  whatHappened: string;
  whatYouWant: string;
  comfortable: string;
  negotiable: string;
  notNegotiable: string;
}

export async function draftBoundaryMessage(input: BoundaryInput, tone: BoundaryTone) {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'draft_boundary_message', input, tone }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}') as { skipped: boolean; draft?: string; error?: string };
}

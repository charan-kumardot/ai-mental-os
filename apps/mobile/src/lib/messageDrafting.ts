import { functions } from './appwrite';
import { getCommunicationStyle } from './interactionPreference';

// Both drafts render into a plain-text TextField for the user to edit and
// share, never a markdown renderer — the model occasionally still wraps
// labels in "**bold**" or "# heading" syntax, which then shows up as raw
// asterisks/hashes on screen instead of emphasis. Strip that formatting
// rather than displaying it literally.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ');
}

export type RecipientType = 'partner' | 'friend' | 'family' | 'manager' | 'colleague' | 'therapist' | 'professional';

export interface DraftResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  draft?: string;
  error?: string;
}

export async function draftPersonalMessage(recipientType: RecipientType): Promise<DraftResult> {
  const communicationStyle = await getCommunicationStyle();
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'draft_personal_message', recipientType, communicationStyle }),
    async: false,
  });
  const result: DraftResult = JSON.parse(execution.responseBody || '{}');
  if (result.draft) result.draft = stripMarkdown(result.draft);
  return result;
}

export interface SummaryResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  summary?: string;
  error?: string;
}

export async function draftProfessionalSummary(): Promise<SummaryResult> {
  const communicationStyle = await getCommunicationStyle();
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'draft_professional_summary', communicationStyle }),
    async: false,
  });
  const result: SummaryResult = JSON.parse(execution.responseBody || '{}');
  if (result.summary) result.summary = stripMarkdown(result.summary);
  return result;
}

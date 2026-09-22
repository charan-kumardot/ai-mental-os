import { functions } from './appwrite';
import { getCommunicationStyle } from './interactionPreference';

export interface WhatHappenedResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  events?: { time: string; label: string }[];
  deltas?: string[];
  collided?: boolean;
  closing?: string | null;
  activeContext?: string | null;
  error?: string;
}

export async function fetchWhatHappened(): Promise<WhatHappenedResult> {
  const communicationStyle = await getCommunicationStyle();
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'what_happened', communicationStyle }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

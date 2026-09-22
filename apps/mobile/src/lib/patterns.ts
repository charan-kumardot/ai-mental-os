import { functions } from './appwrite';

export interface Pattern {
  id: string;
  description: string;
  dimensionA: string;
  dimensionB: string;
  relationshipType: 'positive' | 'negative';
  confidence: number;
  evidenceCount: number;
  contradictingCount?: number;
  status?: 'active' | 'weakened' | 'retired';
}

export interface PatternsResult {
  skipped: boolean;
  reason?: string;
  message?: string;
  cached?: boolean;
  patterns?: Pattern[];
  // Spec §26 — a pattern that was contradicted once but not yet retired;
  // shown as "you may have been wrong" rather than silently disappearing.
  weakened?: Pattern[];
  // Spec §24 — set only on the call that actually found this pattern, so
  // the client can play the cinematic reveal once rather than every load.
  justDiscoveredId?: string | null;
  error?: string;
}

export async function fetchPatterns(forceRefresh = false): Promise<PatternsResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'detect_patterns', forceRefresh }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

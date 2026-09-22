/**
 * Grounding helpers shared by any Appwrite Function that generates
 * user-facing insight text. Every insight must carry an evidence list
 * built from these categories — never a bare assertion (spec section 59-60).
 */

export type EvidenceKind = 'observed' | 'user_reported' | 'pattern' | 'inference' | 'hypothesis';

export interface Evidence {
  kind: EvidenceKind;
  text: string;
  sourceId?: string;
}

/**
 * Builds the system-prompt fragment that constrains the model to only
 * reason over the evidence it's given, and to tag every claim with the
 * evidence category it's grounded in. This is the core anti-hallucination
 * guardrail — the model is never given free rein over "the user's history",
 * only the specific evidence array assembled deterministically beforehand.
 */
export function buildGroundingPreamble(evidence: Evidence[]): string {
  const lines = evidence.map((e, i) => `${i + 1}. [${e.kind}] ${e.text}`).join('\n');
  return [
    'You are generating a short, grounded personal insight for a wellbeing app.',
    'You may ONLY use the evidence listed below. Never invent data, history, or outcomes not present here.',
    'If the evidence is too thin to say anything specific, say so plainly instead of generalizing.',
    'Never claim medical causation — use language like "appears associated with", "similar situations", "may be contributing".',
    '',
    'Evidence:',
    lines || '(none provided)',
  ].join('\n');
}

/**
 * Minimal PII/content minimization before anything leaves the device or
 * server boundary toward a cloud model — strips freeform note text down
 * to structured signals where possible. This is intentionally
 * conservative; expand as real calendar/voice integrations land.
 */
export function summarizeForCloud(input: { meetingCount?: number; meetingMinutes?: number }) {
  return {
    meeting_count: input.meetingCount ?? null,
    meeting_density:
      input.meetingMinutes == null ? null : input.meetingMinutes > 300 ? 'high' : input.meetingMinutes > 120 ? 'medium' : 'low',
  };
}

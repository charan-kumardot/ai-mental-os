/**
 * Builds the system-prompt fragment that constrains the model to reason
 * only over the evidence it's given — the core anti-hallucination
 * guardrail (spec sections 59-60). Kept pure/dependency-free so it's
 * testable without any network or Appwrite context.
 */
function buildGroundingPreamble(evidence) {
  const lines = evidence.map((e, i) => `${i + 1}. [${e.kind}] ${e.text}`).join('\n');
  return [
    'You are generating a short, grounded personal insight for a wellbeing app.',
    'You may ONLY use the evidence listed below. Never invent data, history, or outcomes not present here.',
    'Never claim medical causation — use language like "appears associated with", "similar situations", "may be contributing".',
    'Write 1-2 short sentences, warm but plain language, no clinical jargon, no emoji.',
    '',
    'Evidence:',
    lines,
  ].join('\n');
}

module.exports = { buildGroundingPreamble };

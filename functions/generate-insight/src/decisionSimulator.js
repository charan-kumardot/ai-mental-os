const { buildGroundingPreamble } = require('./grounding');

/**
 * Personal Decision Simulator (spec §21) — extends the existing "Decision
 * Debt" structuring tool with scenario exploration, grounded only in what
 * the user already wrote for this decision (known/unknown/options).
 * Every line of the response must be labeled Observed/Historical/
 * Assumption/Hypothetical per the spec's explicit requirement, and it
 * never makes the decision — it only lays out what each option might
 * involve.
 */
async function simulateDecision(decision, generateFast, env, log) {
  const evidence = [];
  evidence.push({ kind: 'user_reported', text: `Decision: ${decision.title}` });
  if (decision.knownInfo) evidence.push({ kind: 'user_reported', text: `Known: ${decision.knownInfo}` });
  if (decision.unknownInfo) evidence.push({ kind: 'user_reported', text: `Unknown: ${decision.unknownInfo}` });
  if (decision.options) evidence.push({ kind: 'user_reported', text: `Options considered: ${decision.options}` });

  const preamble =
    buildGroundingPreamble(evidence) +
    '\n\nFor each option the user listed, write one line exploring what that path might involve — risks, what would need to be true, and what information could change the decision. ' +
    'Prefix every single line with exactly one of these labels in brackets: [Observed], [Historical], [Assumption], or [Hypothetical] — use [Assumption] for anything not explicitly stated by the user, and [Hypothetical] for "what might happen" statements. ' +
    'Do not recommend one option over another. Do not make the decision for the user.';

  const text = await generateFast(
    [{ role: 'system', content: preamble }, { role: 'user', content: 'Explore the scenarios now.' }],
    env,
    log
  );
  if (!text.trim()) throw new Error('AI provider returned an empty scenario exploration');
  return { skipped: false, exploration: text.trim() };
}

module.exports = { simulateDecision };

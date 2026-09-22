const { buildGroundingPreamble } = require('./grounding');

/**
 * Listening Mode (spec §2/§7) — "just listen" means exactly that: reflect
 * what was said back, understand it, never pivot into unsolicited advice,
 * generic wellness tips, or a motivational quote. Grounded only in the
 * user's own just-written text (kind: user_reported) so nothing is
 * invented about their situation. Always ends with the one permitted
 * clarifying question from the spec's own example, offering — never
 * assuming — that they might want help after all.
 */
async function reflectOnEntry(content, generateFast, env, log) {
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('Nothing to reflect on');

  const evidence = [{ kind: 'user_reported', text: trimmed }];
  const preamble =
    buildGroundingPreamble(evidence) +
    '\n\nThe user asked to just be listened to — not given advice, solutions, generic wellness tips, or a motivational quote. ' +
    'Write 1-2 sentences that reflect back what they said in your own words, showing you understood the real thing underneath it (not just restating it). ' +
    'Then, on a new line, ask exactly this closing question verbatim: "Do you want help with it, or would you rather just get it out?"';

  const text = await generateFast(
    [
      { role: 'system', content: preamble },
      { role: 'user', content: 'Reflect now.' },
    ],
    env,
    log
  );
  if (!text.trim()) throw new Error('AI provider returned an empty reflection');
  return { skipped: false, reflection: text.trim() };
}

module.exports = { reflectOnEntry };

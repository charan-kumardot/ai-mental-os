const { buildGroundingPreamble } = require('./grounding');

const REHEARSAL_MODE_LABEL = {
  difficult_conversation: 'a difficult conversation',
  interview: 'a job interview',
  presentation: 'a presentation',
  boundary: 'setting a boundary',
  apology: 'an apology',
  asking_for_help: 'asking for help',
  manager_conversation: 'a conversation with a manager',
  relationship_conversation: 'a relationship conversation',
};

/**
 * Conversation Rehearsal (spec §19) — the AI roleplays the other person's
 * likely reaction to what the user plans to say, grounded only in the
 * user's own description of the situation (never invents facts about the
 * other person beyond what was given). Feedback is about communication
 * mechanics (clarity, directness, gaps), never a personality "score."
 */
async function rehearseConversation(mode, situation, plannedWords, generateFast, env, log) {
  const label = REHEARSAL_MODE_LABEL[mode] || 'a conversation';
  const evidence = [
    { kind: 'user_reported', text: `Situation: ${situation}` },
    { kind: 'user_reported', text: `What the user plans to say: ${plannedWords}` },
  ];
  const preamble =
    buildGroundingPreamble(evidence) +
    `\n\nThis is a rehearsal for ${label}. First, write a short, realistic reaction (2-3 sentences) from the OTHER person in this situation, based only on what the user described — do not invent unrelated backstory for them. ` +
    'Then on new lines, give structured feedback with exactly these labeled lines: "Clarity:", "Directness:", "Potential misunderstanding:", "Unanswered concern:", "Communication options:". ' +
    'Each feedback line should be one short sentence. Never rate or score the user as a person — only comment on the words and structure of what they plan to say.';

  const text = await generateFast(
    [{ role: 'system', content: preamble }, { role: 'user', content: 'Rehearse it now.' }],
    env,
    log
  );
  if (!text.trim()) throw new Error('AI provider returned an empty rehearsal');
  return { skipped: false, result: text.trim() };
}

const BOUNDARY_TONE_INSTRUCTION = {
  gentle: 'gentle and soft, acknowledging feelings first',
  direct: 'direct and clear, no hedging',
  professional: 'professional and neutral',
  warm: 'warm but clear',
  short: 'as short as possible, no more than 2 sentences',
};

/**
 * Boundary Coach (spec §20) — structures the boundary before drafting it,
 * so the message reflects what the user actually decided is negotiable
 * vs. not, rather than the AI guessing at a compromise.
 */
async function draftBoundaryMessage(input, tone, generateFast, env, log) {
  const { whatHappened, whatYouWant, comfortable, negotiable, notNegotiable } = input;
  const evidence = [
    { kind: 'user_reported', text: `What happened: ${whatHappened}` },
    { kind: 'user_reported', text: `What they want: ${whatYouWant}` },
    { kind: 'user_reported', text: `What they're comfortable with: ${comfortable}` },
    { kind: 'user_reported', text: `What's negotiable: ${negotiable}` },
    { kind: 'user_reported', text: `What's NOT negotiable: ${notNegotiable}` },
  ];
  const toneInstruction = BOUNDARY_TONE_INSTRUCTION[tone] || BOUNDARY_TONE_INSTRUCTION.direct;
  const preamble =
    buildGroundingPreamble(evidence) +
    `\n\nDraft a boundary-setting message in first person, in a tone that is ${toneInstruction}. ` +
    'State the boundary clearly. Do not apologize excessively. Do not soften the non-negotiable part into something negotiable. Do not invent details not given above.';

  const text = await generateFast(
    [{ role: 'system', content: preamble }, { role: 'user', content: 'Draft it now.' }],
    env,
    log
  );
  if (!text.trim()) throw new Error('AI provider returned an empty draft');
  return { skipped: false, draft: text.trim() };
}

module.exports = { rehearseConversation, draftBoundaryMessage };

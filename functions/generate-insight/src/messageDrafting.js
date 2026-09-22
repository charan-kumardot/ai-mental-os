const { Query } = require('node-appwrite');
const { buildGroundingPreamble } = require('./grounding');
const { fetchActiveContext } = require('./opportunityWindow');
const { communicationInstruction } = require('./communicationStyle');

const DB_ID = 'personal_os';

const RECIPIENT_TONE = {
  partner: 'warm and personal, like talking to someone who knows you well',
  friend: 'casual and warm',
  family: 'warm, simple, not clinical',
  manager: 'professional but human, brief',
  colleague: 'professional, brief, not oversharing',
  therapist: 'open and detailed, this person is trained to help',
  professional: 'clear, factual, organized for someone meeting you for the first time',
};

/**
 * Social Support Bridge / "Help me talk to someone" (spec §13-14) — drafts
 * an editable message from the user's own recent real context. Never
 * sends anything itself (spec: "never automatically contact someone") —
 * the client always requires explicit review/edit before sharing via the
 * native share sheet.
 */
async function draftPersonalMessage(databases, userId, recipientType, generateFast, env, log, communicationStyle) {
  const [recentRes, activeContext] = await Promise.all([
    databases.listDocuments(DB_ID, 'mental_inbox', [
      Query.equal('userId', userId),
      Query.equal('category', 'emotional'),
      Query.orderDesc('$createdAt'),
      Query.limit(3),
    ]),
    fetchActiveContext(databases, userId),
  ]);

  if (recentRes.documents.length === 0) {
    return {
      skipped: true,
      reason: 'no_data',
      message: "Nothing recent to draw from yet — jot down what's going on in the Mental Inbox first, or just write this one yourself.",
    };
  }

  const tone = RECIPIENT_TONE[recipientType] || RECIPIENT_TONE.friend;
  const evidence = [
    ...recentRes.documents.map((d) => ({ kind: 'user_reported', text: d.content })),
    ...(activeContext ? [{ kind: 'user_reported', text: `Currently going through: ${activeContext}.` }] : []),
  ];
  const preamble =
    buildGroundingPreamble(evidence) +
    `\n\nDraft a short message the user could send to a ${recipientType}, in a tone that is ${tone}. ${communicationInstruction(communicationStyle)} ` +
    'Speak in first person as the user. Do not diagnose or use clinical language. Do not invent specifics not in the evidence. ' +
    'End with what kind of support would help (company, listening, practical help) only if it is clear from the evidence — otherwise leave it open.';

  const text = await generateFast([{ role: 'system', content: preamble }, { role: 'user', content: 'Draft it now.' }], env, log);
  if (!text.trim()) throw new Error('AI provider returned an empty draft');
  return { skipped: false, draft: text.trim() };
}

/**
 * Professional Handoff (spec §16) — "prepare for a professional
 * conversation." Assembles a real, evidence-backed summary from data this
 * app already has (recent patterns, concluded experiments, baseline
 * drifts) — never diagnoses, never invents a clinical framing.
 */
async function draftProfessionalSummary(databases, userId, generateFast, env, log, communicationStyle) {
  const [patternsRes, experimentsRes] = await Promise.all([
    databases.listDocuments(DB_ID, 'patterns', [Query.equal('userId', userId), Query.equal('status', 'active'), Query.limit(10)]),
    databases.listDocuments(DB_ID, 'experiments', [Query.equal('userId', userId), Query.equal('status', 'completed'), Query.orderDesc('$createdAt'), Query.limit(10)]),
  ]);

  const evidence = [];
  for (const p of patternsRes.documents) {
    evidence.push({ kind: 'pattern', text: p.description });
  }
  for (const e of experimentsRes.documents) {
    if (e.conclusion) evidence.push({ kind: 'observed', text: `Tested: "${e.hypothesis}" — ${e.conclusion}` });
  }

  if (evidence.length === 0) {
    return {
      skipped: true,
      reason: 'no_data',
      message: 'Not enough tracked history yet to put together a meaningful summary — this fills in as patterns and experiments accumulate.',
    };
  }

  const preamble =
    buildGroundingPreamble(evidence) +
    '\n\nWrite a short, organized summary (bullet-style, 4-6 lines) for the user to bring to a conversation with a professional (therapist, doctor, coach). ' +
    'Include: recent patterns noticed, what has genuinely helped, what has not helped, and one honest open question worth raising. ' +
    `Never diagnose, never suggest a specific condition or treatment, never claim certainty beyond the evidence given. ${communicationInstruction(communicationStyle)}`;

  const text = await generateFast([{ role: 'system', content: preamble }, { role: 'user', content: 'Write it now.' }], env, log);
  if (!text.trim()) throw new Error('AI provider returned an empty summary');
  return { skipped: false, summary: text.trim() };
}

module.exports = { draftPersonalMessage, draftProfessionalSummary };

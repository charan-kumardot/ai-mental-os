const { Query, ID, Permission, Role } = require('node-appwrite');
const { buildGroundingPreamble } = require('./grounding');

const DB_ID = 'personal_os';

/**
 * Circle AI (spec §46) — a lightweight facilitator, explicitly never a
 * therapist: it may suggest a group activity or summarize the recent
 * conversation, grounded only in the real messages already posted in this
 * circle. Posts its own suggestion as a real circle_messages document
 * (kind: 'ai_facilitator') so it appears in the same timeline as human
 * messages, not a separate hidden system.
 */
async function facilitateCircle(databases, circleId, generateFast, env, log) {
  const [circleRes, messagesRes] = await Promise.all([
    databases.getDocument(DB_ID, 'circles', circleId),
    databases.listDocuments(DB_ID, 'circle_messages', [
      Query.equal('circleId', circleId),
      Query.equal('kind', 'message'),
      Query.orderDesc('$createdAt'),
      Query.limit(15),
    ]),
  ]);

  if (messagesRes.documents.length === 0) {
    return {
      skipped: true,
      reason: 'no_messages',
      message: 'Nothing posted here yet — once people start talking, I can suggest something.',
    };
  }

  const evidence = [
    { kind: 'observed', text: `This circle is called "${circleRes.name}"${circleRes.description ? ` — ${circleRes.description}` : ''}.` },
    ...messagesRes.documents.reverse().map((m) => ({ kind: 'observed', text: `${m.displayName || 'A member'} said: "${m.content}"` })),
  ];

  const preamble =
    buildGroundingPreamble(evidence) +
    '\n\nYou are a lightweight community facilitator for this wellbeing circle — not a therapist, not a counselor. ' +
    'Write one short, warm suggestion (max 2 sentences): either a simple group activity relevant to the conversation, or a brief encouraging summary of what people have shared. ' +
    'Never give clinical or therapeutic advice. Never single out one member. Never claim to know how anyone feels beyond what they wrote.';

  const text = await generateFast([{ role: 'system', content: preamble }, { role: 'user', content: 'Suggest something now.' }], env, log);
  if (!text.trim()) throw new Error('AI provider returned an empty facilitation message');

  const doc = await databases.createDocument(
    DB_ID,
    'circle_messages',
    ID.unique(),
    { circleId, userId: 'ai_facilitator', displayName: 'Circle AI', content: text.trim(), kind: 'ai_facilitator' },
    [Permission.read(Role.users())]
  );

  return { skipped: false, message: { id: doc.$id, content: doc.content } };
}

module.exports = { facilitateCircle };

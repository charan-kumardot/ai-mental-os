const { ID, Permission, Role, Query } = require('node-appwrite');
const { classify, safetyResponse } = require('./safety');

const DB_ID = 'personal_os';

/**
 * Sends a Circle chat message through the Safety Engine before it ever
 * becomes visible to other members — closing the gap where
 * `circle_messages` (unlike `mental_inbox`) previously accepted a raw
 * client-side write with no check at all. A flagged message is never
 * created; the sender gets the same warm, non-diagnostic safety response
 * used everywhere else, and nothing is posted to the circle.
 */
async function sendCircleMessage(databases, userId, displayName, circleId, content) {
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const membership = await databases.listDocuments(DB_ID, 'circle_members', [
    Query.equal('circleId', circleId),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  if (membership.documents.length === 0) throw new Error('Not a member of this circle');

  const result = classify(trimmed);
  if (result.flagged) {
    return { flagged: true, response: safetyResponse(result.category) };
  }

  const doc = await databases.createDocument(
    DB_ID,
    'circle_messages',
    ID.unique(),
    { circleId, userId, displayName, content: trimmed.slice(0, 500), kind: 'message' },
    [Permission.read(Role.users()), Permission.delete(Role.user(userId))]
  );

  return { flagged: false, message: { id: doc.$id, circleId: doc.circleId, userId: doc.userId, displayName: doc.displayName, content: doc.content, kind: doc.kind, createdAt: doc.$createdAt } };
}

module.exports = { sendCircleMessage };

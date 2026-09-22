import { client, databases, functions, DB_ID, COLLECTIONS, ID, Permission, Role, Query } from './appwrite';

export interface Circle {
  $id: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface CircleMessage {
  $id: string;
  circleId: string;
  userId: string;
  displayName?: string;
  content: string;
  kind: 'message' | 'ai_facilitator' | 'system';
  $createdAt: string;
}

/**
 * Wellbeing Circles (spec §45) — open, topic-based communities anyone can
 * browse and join, not private invite-only groups (matches the spec's own
 * examples like "Early Risers"/"Calm Evenings"). Every write here grants
 * Permission.read(Role.users()) deliberately — see schema.ts's file-level
 * comment for the reasoning.
 */
export async function createCircle(userId: string, name: string, description?: string) {
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.circles,
    ID.unique(),
    { name, description, createdBy: userId },
    [Permission.read(Role.users()), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
}

export async function listCircles(): Promise<Circle[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circles, [Query.orderDesc('$createdAt'), Query.limit(50)]);
  return res.documents as any as Circle[];
}

export async function joinCircle(circleId: string, userId: string, displayName?: string) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.circleMembers, [
    Query.equal('circleId', circleId),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return existing.documents[0];
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.circleMembers,
    ID.unique(),
    { circleId, userId, displayName },
    [Permission.read(Role.users()), Permission.delete(Role.user(userId))]
  );
}

export async function leaveCircle(circleId: string, userId: string) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.circleMembers, [
    Query.equal('circleId', circleId),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) {
    await databases.deleteDocument(DB_ID, COLLECTIONS.circleMembers, existing.documents[0].$id);
  }
}

export async function isCircleMember(circleId: string, userId: string): Promise<boolean> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circleMembers, [
    Query.equal('circleId', circleId),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  return res.documents.length > 0;
}

export async function countCircleMembers(circleId: string): Promise<number> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circleMembers, [Query.equal('circleId', circleId), Query.limit(1)]);
  return res.total;
}

export interface SendCircleMessageResult {
  flagged: boolean;
  response?: string;
  message?: CircleMessage;
  error?: string;
}

/**
 * Routes through the generate-insight `send_circle_message` action rather
 * than writing `circle_messages` directly — this is the only path that
 * runs the message through the Safety Engine before it can become visible
 * to other members (a direct client write here would skip that check
 * entirely, unlike mental_inbox which already goes through
 * process-mental-inbox for the same reason).
 */
export async function sendCircleMessage(
  circleId: string,
  displayName: string | undefined,
  content: string
): Promise<SendCircleMessageResult> {
  const execution = await functions.createExecution({
    functionId: 'generate-insight',
    body: JSON.stringify({ action: 'send_circle_message', circleId, content, displayName }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function listCircleMessages(circleId: string): Promise<CircleMessage[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circleMessages, [
    Query.equal('circleId', circleId),
    Query.orderDesc('$createdAt'),
    Query.limit(50),
  ]);
  return (res.documents as any as CircleMessage[]).reverse();
}

export function subscribeToCircleMessages(circleId: string, onMessage: (msg: CircleMessage) => void) {
  return client.subscribe(`databases.${DB_ID}.collections.${COLLECTIONS.circleMessages}.documents`, (event: any) => {
    const payload = event.payload as CircleMessage;
    if (payload?.circleId === circleId && event.events.some((e: string) => e.endsWith('.create'))) {
      onMessage(payload);
    }
  });
}

const REPORT_HIDE_THRESHOLD = 2;

/**
 * Basic Circle Moderation. No admin panel exists in this build (out of
 * scope), so this is deliberately rule-based rather than routed to a human
 * review queue: blocking is a per-user client-side filter, and a report
 * hides a message for every member once REPORT_HIDE_THRESHOLD distinct
 * members have reported it — never an AI judgment call.
 */
export async function blockUser(circleId: string, actorUserId: string, targetUserId: string) {
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.circleModeration,
    ID.unique(),
    { kind: 'block', actorUserId, targetUserId, circleId },
    [Permission.read(Role.user(actorUserId)), Permission.delete(Role.user(actorUserId))]
  );
}

export async function unblockUser(circleId: string, actorUserId: string, targetUserId: string) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.circleModeration, [
    Query.equal('kind', 'block'),
    Query.equal('actorUserId', actorUserId),
    Query.equal('targetUserId', targetUserId),
    Query.equal('circleId', circleId),
  ]);
  for (const doc of existing.documents) {
    await databases.deleteDocument(DB_ID, COLLECTIONS.circleModeration, doc.$id);
  }
}

export async function listBlockedUserIds(circleId: string, actorUserId: string): Promise<Set<string>> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circleModeration, [
    Query.equal('kind', 'block'),
    Query.equal('actorUserId', actorUserId),
    Query.equal('circleId', circleId),
    Query.limit(200),
  ]);
  return new Set(res.documents.map((d: any) => d.targetUserId));
}

export async function reportMessage(circleId: string, actorUserId: string, messageId: string) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.circleModeration, [
    Query.equal('kind', 'report'),
    Query.equal('actorUserId', actorUserId),
    Query.equal('messageId', messageId),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return { alreadyReported: true, hidden: false };
  await databases.createDocument(
    DB_ID,
    COLLECTIONS.circleModeration,
    ID.unique(),
    { kind: 'report', actorUserId, messageId, circleId },
    [Permission.read(Role.users()), Permission.delete(Role.user(actorUserId))]
  );
  const count = await databases.listDocuments(DB_ID, COLLECTIONS.circleModeration, [
    Query.equal('kind', 'report'),
    Query.equal('messageId', messageId),
    Query.limit(REPORT_HIDE_THRESHOLD),
  ]);
  return { alreadyReported: false, hidden: count.total >= REPORT_HIDE_THRESHOLD };
}

export async function listHiddenMessageIds(circleId: string, messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.circleModeration, [
    Query.equal('kind', 'report'),
    Query.equal('messageId', messageIds),
    Query.limit(1000),
  ]);
  const counts = new Map<string, number>();
  for (const doc of res.documents as any[]) {
    counts.set(doc.messageId, (counts.get(doc.messageId) ?? 0) + 1);
  }
  const hidden = new Set<string>();
  for (const [id, count] of counts) {
    if (count >= REPORT_HIDE_THRESHOLD) hidden.add(id);
  }
  return hidden;
}

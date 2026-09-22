import { client, databases, DB_ID, COLLECTIONS, ID, Permission, Role, Query } from './appwrite';

export type SessionKind = 'reset' | 'focus';

export interface SessionCatalogEntry {
  key: string;
  kind: SessionKind;
  label: string;
  durationSeconds: number;
}

/**
 * Live Reset Rooms / Reset Together / Focus Together (spec §43-44, §50) —
 * a fixed catalog rather than free-form session creation, so "347 people
 * are here" always refers to one of a small, recognizable set of real
 * rooms instead of fragmenting into dozens of near-duplicate ones.
 */
export const SESSION_CATALOG: SessionCatalogEntry[] = [
  { key: 'reset_2min', kind: 'reset', label: '2-Minute Reset', durationSeconds: 120 },
  { key: 'calm_5min', kind: 'reset', label: '5-Minute Calm', durationSeconds: 300 },
  { key: 'focus_25min', kind: 'focus', label: 'Focus Together', durationSeconds: 1500 },
];

export interface LiveSession {
  $id: string;
  kind: SessionKind;
  label: string;
  startedAt: string;
  durationSeconds: number;
  createdBy?: string;
}

function isStillActive(session: LiveSession): boolean {
  return new Date(session.startedAt).getTime() + session.durationSeconds * 1000 > Date.now();
}

/**
 * Finds the current real, still-running instance of this room, or starts a
 * fresh one if none is active — every participant's countdown is then
 * derived from the SAME `startedAt`, which is what keeps them genuinely
 * synchronized without any server-side ticking.
 */
export async function joinOrStartSession(entry: SessionCatalogEntry, userId: string, displayName?: string): Promise<LiveSession> {
  const recent = await databases.listDocuments(DB_ID, COLLECTIONS.liveSessions, [
    Query.equal('kind', entry.kind),
    Query.equal('label', entry.label),
    Query.orderDesc('$createdAt'),
    Query.limit(5),
  ]);
  const active = (recent.documents as any as LiveSession[]).find(isStillActive);

  const session =
    active ??
    ((await databases.createDocument(
      DB_ID,
      COLLECTIONS.liveSessions,
      ID.unique(),
      { kind: entry.kind, label: entry.label, startedAt: new Date().toISOString(), durationSeconds: entry.durationSeconds, createdBy: userId },
      [Permission.read(Role.users())]
    )) as any as LiveSession);

  const existingParticipant = await databases.listDocuments(DB_ID, COLLECTIONS.liveSessionParticipants, [
    Query.equal('sessionId', session.$id),
    Query.equal('userId', userId),
    Query.limit(1),
  ]);
  if (existingParticipant.documents.length === 0) {
    await databases.createDocument(
      DB_ID,
      COLLECTIONS.liveSessionParticipants,
      ID.unique(),
      { sessionId: session.$id, userId, displayName },
      [Permission.read(Role.users()), Permission.delete(Role.user(userId))]
    );
  }

  return session;
}

export async function countSessionParticipants(sessionId: string): Promise<number> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.liveSessionParticipants, [
    Query.equal('sessionId', sessionId),
    Query.limit(1),
  ]);
  return res.total;
}

export function subscribeToSessionParticipants(sessionId: string, onChange: () => void) {
  return client.subscribe(`databases.${DB_ID}.collections.${COLLECTIONS.liveSessionParticipants}.documents`, (event: any) => {
    if (event.payload?.sessionId === sessionId) onChange();
  });
}

export function secondsRemaining(session: LiveSession): number {
  const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
  return Math.max(0, Math.round(session.durationSeconds - elapsed));
}

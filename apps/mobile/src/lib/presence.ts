import { client, databases, DB_ID, COLLECTIONS, ID, Permission, Role, Query } from './appwrite';

export type PresenceStatus =
  | 'available'
  | 'break'
  | 'focusing'
  | 'walking'
  | 'winding_down'
  | 'resetting'
  | 'open_to_talk'
  | 'dnd';

export const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  available: '🟢 Available',
  break: '🌿 Taking a break',
  focusing: '🎯 Focusing',
  walking: '🚶 Walking',
  winding_down: '🌙 Winding down',
  resetting: '🧘 Resetting',
  open_to_talk: '💬 Open to talk',
  dnd: '🔕 Do not disturb',
};

export interface PresenceDoc {
  $id: string;
  userId: string;
  displayName?: string;
  status: PresenceStatus;
  $updatedAt: string;
}

// Presence older than this is treated as stale and excluded from "who's
// around" — this app has no background heartbeat, so a status only stays
// "live" for as long as the app was actually open recently.
const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Live Wellbeing Presence (spec §41) — always a voluntary, explicit status
 * the user picked, never inferred from behavior. Upserts by querying the
 * user's own doc first (same pattern as the rest of this app's "find by
 * real field, don't guess the id" convention), and deliberately grants
 * Permission.read(Role.users()) since presence only means anything if
 * other people can see it.
 */
export async function setMyPresence(userId: string, displayName: string | undefined, status: PresenceStatus) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.presence, [Query.equal('userId', userId), Query.limit(1)]);
  if (existing.documents.length > 0) {
    return databases.updateDocument(DB_ID, COLLECTIONS.presence, existing.documents[0].$id, { status, displayName });
  }
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.presence,
    ID.unique(),
    { userId, displayName, status },
    [Permission.read(Role.users()), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
}

export async function getMyPresence(userId: string): Promise<PresenceStatus | null> {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.presence, [Query.equal('userId', userId), Query.limit(1)]);
  return (existing.documents[0] as any as PresenceDoc | undefined)?.status ?? null;
}

export async function clearMyPresence(userId: string) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.presence, [Query.equal('userId', userId), Query.limit(1)]);
  if (existing.documents.length > 0) {
    await databases.deleteDocument(DB_ID, COLLECTIONS.presence, existing.documents[0].$id);
  }
}

export async function listActivePresence(excludeUserId?: string): Promise<PresenceDoc[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.presence, [Query.orderDesc('$updatedAt'), Query.limit(50)]);
  const cutoff = Date.now() - STALE_AFTER_MS;
  return (res.documents as any as PresenceDoc[]).filter(
    (d) => new Date(d.$updatedAt).getTime() >= cutoff && d.userId !== excludeUserId
  );
}

export function subscribeToPresence(onChange: () => void) {
  return client.subscribe(`databases.${DB_ID}.collections.${COLLECTIONS.presence}.documents`, () => onChange());
}

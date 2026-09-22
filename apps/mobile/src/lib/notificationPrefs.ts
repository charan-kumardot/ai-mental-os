import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';

export interface NotificationPrefs {
  $id: string;
  userId: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  categoriesEnabled?: string[];
}

export async function getOrCreateNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.notificationsPrefs, [Query.equal('userId', userId)]);
  if (res.documents.length > 0) return res.documents[0] as unknown as NotificationPrefs;
  const created = await databases.createDocument(
    DB_ID,
    COLLECTIONS.notificationsPrefs,
    ID.unique(),
    { userId, categoriesEnabled: [] },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
  return created as unknown as NotificationPrefs;
}

export async function updateNotificationPrefs(id: string, patch: Partial<NotificationPrefs>) {
  return databases.updateDocument(DB_ID, COLLECTIONS.notificationsPrefs, id, patch);
}

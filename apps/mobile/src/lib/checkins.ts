import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';
import type { MoodValue } from '../components/MoodSelector';

export interface CheckinInput {
  userId: string;
  mood: MoodValue;
  energy?: number;
  stress?: number;
  focus?: number;
  note?: string;
}

export async function createCheckin(input: CheckinInput) {
  const { userId, ...data } = input;
  return databases.createDocument(DB_ID, COLLECTIONS.checkins, ID.unique(), { userId, ...data, source: 'manual' }, [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ]);
}

export async function listRecentCheckins(userId: string, limit = 14) {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.checkins, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ]);
  return res.documents;
}

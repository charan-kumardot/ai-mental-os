import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { databases, functions, DB_ID, COLLECTIONS, Query } from './appwrite';

/**
 * Client-side export: every collection already grants the owning user
 * read access on their own documents (per-document permissions set at
 * write time), so this needs no server function — just read everything
 * this session is already allowed to read and bundle it.
 */
export async function exportUserData(userId: string) {
  const result: Record<string, any[]> = {};

  for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
    try {
      const docs: any[] = [];
      let cursor: string | undefined;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const queries = [Query.equal('userId', userId), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments(DB_ID, collectionId, queries);
        docs.push(...res.documents);
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
      }
      result[key] = docs;
    } catch {
      // Some collections (e.g. audit_logs) key on a different field and
      // will legitimately 401/return nothing for a non-admin user — skip.
      result[key] = [];
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    data: result,
  };

  const fileUri = `${FileSystem.cacheDirectory}personal-os-export-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export your data' });
  }

  return fileUri;
}

export async function deleteAccountForever() {
  const execution = await functions.createExecution({
    functionId: 'process-mental-inbox',
    body: JSON.stringify({ action: 'delete_account' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

/**
 * Granular per-source deletion (spec §96) — "delete just my health data,"
 * not just the all-or-nothing account wipe. Every targeted collection
 * grants the owning user delete permission on their own documents (same
 * per-document permission model `exportUserData` relies on for reads), so
 * this is a plain client-side bulk delete, no server function needed.
 */
export async function deleteSourceData(collectionId: string, userId: string): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await databases.listDocuments(DB_ID, collectionId, [Query.equal('userId', userId), Query.limit(100)]);
    if (res.documents.length === 0) break;
    await Promise.all(res.documents.map((doc) => databases.deleteDocument(DB_ID, collectionId, doc.$id)));
    deleted += res.documents.length;
    if (res.documents.length < 100) break;
  }
  return deleted;
}

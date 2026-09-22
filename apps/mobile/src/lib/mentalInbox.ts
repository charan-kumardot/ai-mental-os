import { functions, databases, DB_ID, COLLECTIONS, Query } from './appwrite';

export interface ProcessResult {
  flagged: boolean;
  response?: string;
  item?: any;
  error?: string;
}

export async function submitToMentalInbox(content: string): Promise<ProcessResult> {
  const execution = await functions.createExecution({
    functionId: 'process-mental-inbox',
    body: JSON.stringify({ content }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function listMentalInbox(userId: string) {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.mentalInbox, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(30),
  ]);
  return res.documents;
}

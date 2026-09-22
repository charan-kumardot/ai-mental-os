import { databases, DB_ID, COLLECTIONS, ID, Query, Permission, Role } from './appwrite';

export interface Playbook {
  $id: string;
  userId: string;
  trigger: string;
  steps: string[];
  effectivenessScore?: number;
}

/**
 * Personal Playbooks (spec §38) — "when X happens, do Y" recipes that
 * evolve from real intervention outcomes rather than being written from
 * scratch: a playbook's steps start as whatever intervention(s) the user
 * has already found actually helped for a given trigger, not invented
 * generic advice.
 */
export async function listPlaybooks(userId: string): Promise<Playbook[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.playbooks, [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
  ]);
  return res.documents as unknown as Playbook[];
}

export async function createPlaybook(userId: string, trigger: string, steps: string[]) {
  return databases.createDocument(
    DB_ID,
    COLLECTIONS.playbooks,
    ID.unique(),
    { userId, trigger, steps },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
}

export async function deletePlaybook(playbookId: string) {
  return databases.deleteDocument(DB_ID, COLLECTIONS.playbooks, playbookId);
}

/**
 * Real usage nudges effectiveness up or down — a playbook that keeps
 * getting followed and helping should surface with more confidence than
 * one nobody's touched since creation. Deliberately simple (no decay
 * curve yet): +0.1 on "it helped," -0.1 on "it didn't," clamped to [0,1].
 */
export async function recordPlaybookOutcome(playbook: Playbook, helped: boolean) {
  const current = playbook.effectivenessScore ?? 0.5;
  const next = Math.max(0, Math.min(1, current + (helped ? 0.1 : -0.1)));
  return databases.updateDocument(DB_ID, COLLECTIONS.playbooks, playbook.$id, { effectivenessScore: next });
}

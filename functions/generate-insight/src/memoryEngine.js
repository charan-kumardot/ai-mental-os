const { Query, ID, Permission, Role } = require('node-appwrite');

const DB_ID = 'personal_os';
const VALID_TYPES = new Set(['episodic', 'semantic', 'pattern', 'intervention', 'experiment']);

/**
 * Memory Architecture (spec §44) — a unified record of what this app has
 * actually learned about the user, distinct from the raw per-feature
 * collections (checkins, experiments, etc.) each feature already writes
 * to. `memory_items` is server-only, so both writing and reading go
 * through this function rather than a direct client query. Kept
 * deliberately simple for now: a flat, recency-ordered record — no
 * "memory quality" strengthen/weaken engine (spec §45) yet, since that
 * needs real usage history to design against rather than being invented
 * up front.
 */
async function recordMemory(databases, userId, body) {
  const type = body.type;
  const content = (body.content || '').trim();
  if (!VALID_TYPES.has(type)) throw new Error(`Invalid memory type: ${type}`);
  if (!content) throw new Error('Memory content cannot be empty');
  if (content.length > 2000) throw new Error('Memory content too long');

  const importance = typeof body.importance === 'number' ? Math.max(0, Math.min(1, body.importance)) : undefined;
  const sensitivity = ['low', 'medium', 'high'].includes(body.sensitivity) ? body.sensitivity : 'medium';
  const source = typeof body.source === 'string' ? body.source.slice(0, 32) : undefined;

  const doc = await databases.createDocument(
    DB_ID,
    'memory_items',
    ID.unique(),
    { userId, type, content: content.slice(0, 2000), importance, sensitivity, source },
    [Permission.read(Role.user(userId))]
  );

  return { skipped: false, memory: formatMemory(doc) };
}

async function listMemories(databases, userId, limit = 20) {
  const res = await databases.listDocuments(DB_ID, 'memory_items', [
    Query.equal('userId', userId),
    Query.orderDesc('$createdAt'),
    Query.limit(Math.min(limit, 50)),
  ]);
  return { skipped: false, memories: res.documents.map(formatMemory) };
}

/**
 * Memory Transparency (spec §28) — every memory can be corrected, marked
 * outdated, or deleted outright, and every mutation is ownership-checked
 * server-side (memory_items is server-only, so this is the only path to
 * it) rather than trusting a client-supplied userId.
 */
async function forgetMemory(databases, userId, memoryId) {
  const doc = await databases.getDocument(DB_ID, 'memory_items', memoryId);
  if (doc.userId !== userId) throw new Error('Not your memory to forget');
  await databases.deleteDocument(DB_ID, 'memory_items', memoryId);
  return { skipped: false, deleted: true };
}

async function markMemoryOutdated(databases, userId, memoryId, outdated = true) {
  const doc = await databases.getDocument(DB_ID, 'memory_items', memoryId);
  if (doc.userId !== userId) throw new Error('Not your memory to update');
  const updated = await databases.updateDocument(DB_ID, 'memory_items', memoryId, { outdated: !!outdated });
  return { skipped: false, memory: formatMemory(updated) };
}

async function correctMemory(databases, userId, memoryId, content) {
  const trimmed = (content || '').trim();
  if (!trimmed) throw new Error('Corrected memory content cannot be empty');
  const doc = await databases.getDocument(DB_ID, 'memory_items', memoryId);
  if (doc.userId !== userId) throw new Error('Not your memory to correct');
  const updated = await databases.updateDocument(DB_ID, 'memory_items', memoryId, {
    content: trimmed.slice(0, 2000),
    outdated: false,
  });
  return { skipped: false, memory: formatMemory(updated) };
}

function formatMemory(doc) {
  return {
    id: doc.$id,
    type: doc.type,
    content: doc.content,
    importance: doc.importance ?? null,
    sensitivity: doc.sensitivity,
    source: doc.source ?? null,
    outdated: !!doc.outdated,
    createdAt: doc.$createdAt,
  };
}

module.exports = { recordMemory, listMemories, forgetMemory, markMemoryOutdated, correctMemory };

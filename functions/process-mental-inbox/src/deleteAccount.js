const { Query } = require('node-appwrite');

const DB_ID = 'personal_os';

const USER_ID_COLLECTIONS = [
  'profiles',
  'consents',
  'checkins',
  'voice_reflections',
  'health_data',
  'calendar_summaries',
  'baselines',
  'state_estimates',
  'patterns',
  'interventions',
  'intervention_results',
  'experiments',
  'experiment_observations',
  'insights',
  'memory_items',
  'mental_inbox',
  'decisions',
  'playbooks',
  'notification_prefs',
  'safety_events',
];

async function deleteAllInCollection(databases, collectionId, field, userId, log) {
  let deleted = 0;
  while (true) {
    const res = await databases.listDocuments(DB_ID, collectionId, [Query.equal(field, userId), Query.limit(100)]);
    if (res.documents.length === 0) break;
    for (const doc of res.documents) {
      await databases.deleteDocument(DB_ID, collectionId, doc.$id);
      deleted++;
    }
  }
  if (deleted > 0) log(`Deleted ${deleted} document(s) from ${collectionId}`);
}

/**
 * Full account + data deletion (spec section 96). Deletes every document
 * this user owns across every collection, then the auth account itself.
 * Irreversible — the client must confirm with the user before calling this.
 */
async function deleteAccount(databases, users, userId, log) {
  for (const collectionId of USER_ID_COLLECTIONS) {
    await deleteAllInCollection(databases, collectionId, 'userId', userId, log);
  }
  await deleteAllInCollection(databases, 'audit_logs', 'actorId', userId, log);
  await users.delete(userId);
  log(`Deleted account ${userId}`);
}

module.exports = { deleteAccount };

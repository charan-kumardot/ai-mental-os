import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';
import { readFileSync } from 'node:fs';

const content = readFileSync('D:/AI fitness app/.env', 'utf-8');
const env = {};
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const client = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const db = new Databases(client);

const profiles = await db.listDocuments('personal_os', 'profiles', [Query.limit(1)]);
const userId = profiles.documents[0].userId;
console.log(`Seeding check-ins for userId=${userId}`);

// Deliberately trends lower than the existing 'great' check-in, so the
// insight function's deviation gate actually fires (see functions/generate-insight).
const moods = ['okay', 'okay', 'low', 'struggling', 'low'];

for (const mood of moods) {
  await db.createDocument(
    'personal_os',
    'checkins',
    ID.unique(),
    { userId, mood, source: 'seed' },
    [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
  );
  console.log(`  created check-in: ${mood}`);
  await new Promise((r) => setTimeout(r, 300)); // keep $createdAt ordering distinct
}
console.log('Done.');

import { Client, Databases, Query } from 'node-appwrite';
import { readFileSync } from 'node:fs';

const envPath = new URL('../../../.env', import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const db = new Databases(client);

const res = await db.listDocuments('personal_os', 'profiles', [Query.limit(25)]);
console.log(`Found ${res.total} profile(s)`);
for (const doc of res.documents) {
  console.log(`- ${doc.$id} userId=${doc.userId} name=${doc.name} onboardingCompleted=${doc.onboardingCompleted}`);
  if (!doc.onboardingCompleted) {
    await db.updateDocument('personal_os', 'profiles', doc.$id, { onboardingCompleted: true, onboardingStep: 'complete' });
    console.log(`  -> patched to onboardingCompleted=true`);
  }
}

import { Client, Users, Databases, ID, Query } from 'node-appwrite';
import { Client as ClientSDK, Functions, Account } from 'appwrite';
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

const adminClient = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const users = new Users(adminClient);
const adminDb = new Databases(adminClient);

// 1. Create a throwaway test user + some data owned by them.
const testEmail = `throwaway-${Date.now()}@example.com`;
const user = await users.create(ID.unique(), testEmail, undefined, 'TestPassword123!', 'Throwaway Test');
console.log('Created throwaway user:', user.$id, testEmail);

await adminDb.createDocument('personal_os', 'checkins', ID.unique(), { userId: user.$id, mood: 'okay', source: 'test' }, []);
await adminDb.createDocument('personal_os', 'mental_inbox', ID.unique(), { userId: user.$id, content: 'test item', category: 'information', resolved: false }, []);
console.log('Seeded 2 documents for throwaway user.');

// 2. Create a session for that user (admin action) and use it client-side.
const session = await users.createSession(user.$id);
console.log('Created session:', session.$id);

// node-appwrite's client SDK isn't meant for browser session cookies, so
// call the REST execution endpoint directly with the session secret as a
// cookie-equivalent header, matching what the mobile client does.
const res = await fetch(`${env.APPWRITE_ENDPOINT}/functions/process-mental-inbox/executions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': env.APPWRITE_PROJECT_ID,
    'X-Appwrite-Session': session.secret,
  },
  body: JSON.stringify({ body: JSON.stringify({ action: 'delete_account' }), async: false }),
});
const execution = await res.json();
console.log('Execution status:', res.status);
console.log('Response body:', execution.responseBody);

// 3. Verify: user gone, documents gone.
try {
  await users.get(user.$id);
  console.log('FAIL: user still exists');
} catch {
  console.log('PASS: user no longer exists');
}

const remaining = await adminDb.listDocuments('personal_os', 'checkins', [Query.equal('userId', user.$id)]);
console.log(remaining.total === 0 ? 'PASS: no remaining checkins' : `FAIL: ${remaining.total} checkins remain`);

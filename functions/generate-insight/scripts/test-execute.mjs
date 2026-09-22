import { Client, Functions, Databases, Query } from 'node-appwrite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
const content = readFileSync(resolve(rootDir, '.env'), 'utf-8');
const env = {};
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const client = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const functions = new Functions(client);
const databases = new Databases(client);

// Find the real test user's id (from the profiles collection) so we can
// simulate an authenticated execution the same way the mobile app would
// trigger it (function reads x-appwrite-user-id header).
const profiles = await databases.listDocuments('personal_os', 'profiles', [Query.limit(1)]);
const userId = profiles.documents[0].userId;
console.log(`Testing as userId=${userId}`);

const execution = await functions.createExecution(
  'generate-insight',
  '',
  false, // sync (wait for result)
  '/',
  'GET',
  { 'x-appwrite-user-id': userId }
);

console.log('Status:', execution.status);
console.log('Response code:', execution.responseStatusCode);
console.log('Body:', execution.responseBody);
console.log('Logs:', execution.logs);
console.log('Errors:', execution.errors);

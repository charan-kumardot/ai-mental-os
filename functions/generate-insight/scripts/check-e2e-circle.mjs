import { Client, Databases, Query } from 'node-appwrite';
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
const databases = new Databases(client);
const res = await databases.listDocuments('personal_os', 'circles', [Query.orderDesc('$createdAt'), Query.limit(5)]);
console.log(`Total circles: ${res.total}`);
for (const c of res.documents) {
  console.log(`  ${c.$id}  name="${c.name}"  createdBy=${c.createdBy}  createdAt=${c.$createdAt}`);
}

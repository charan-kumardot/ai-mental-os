import { Client, Functions, Query } from 'node-appwrite';
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

const res = await functions.listExecutions('generate-insight', [Query.orderDesc('$createdAt'), Query.limit(5)]);
console.log(`Found ${res.total} execution(s)`);
for (const e of res.executions) {
  console.log('----');
  console.log('id:', e.$id, 'status:', e.status, 'code:', e.responseStatusCode, 'trigger:', e.trigger);
  console.log('body:', e.responseBody);
  console.log('logs:', e.logs);
  console.log('errors:', e.errors);
}

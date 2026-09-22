import { Client, Functions } from 'node-appwrite';
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
const functions = new Functions(client);

const functionId = process.argv[2];
if (!functionId) {
  console.error('Usage: node dev-check-function.mjs <functionId>');
  process.exit(1);
}

const fn = await functions.get(functionId);
console.log(`Active deployment: ${fn.deployment}`);
const deployments = await functions.listDeployments(functionId);
for (const d of deployments.deployments.slice(0, 3)) {
  console.log(`- ${d.$id} status=${d.status} activate=${d.activate}`);
  if (d.status === 'failed') console.log(`  logs: ${(d.buildLogs || '').slice(-1000)}`);
}

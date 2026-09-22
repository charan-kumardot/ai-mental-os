import { Client, Functions } from 'node-appwrite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionDir = resolve(__dirname, '..');
const rootDir = resolve(__dirname, '../../..');

function loadEnv() {
  const content = readFileSync(resolve(rootDir, '.env'), 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const client = new Client().setEndpoint(env.APPWRITE_ENDPOINT).setProject(env.APPWRITE_PROJECT_ID).setKey(env.APPWRITE_API_KEY);
const functions = new Functions(client);

const FUNCTION_ID = 'process-mental-inbox';
const FUNCTION_NAME = 'Process Mental Inbox';
const RUNTIME = 'node-22';
const ENTRYPOINT = 'src/main.js';

const tarPath = resolve(functionDir, 'code.tar.gz');
console.log('Packaging function code...');
execSync(`tar --force-local -czf "${tarPath}" -C "${functionDir}" package.json src`, { stdio: 'inherit' });

let exists = true;
try {
  await functions.get(FUNCTION_ID);
} catch {
  exists = false;
}

if (!exists) {
  console.log('Creating function...');
  await functions.create(FUNCTION_ID, FUNCTION_NAME, RUNTIME, ['users'], undefined, undefined, undefined, undefined, undefined, ENTRYPOINT, undefined);
} else {
  console.log('Function already exists, updating config...');
  await functions.update(FUNCTION_ID, FUNCTION_NAME, RUNTIME, ['users'], undefined, undefined, undefined, undefined, undefined, ENTRYPOINT, undefined);
}

const requiredVars = {
  APPWRITE_ENDPOINT: env.APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID: env.APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY: env.APPWRITE_API_KEY,
  GROQ_API_KEY: env.GROQ_API_KEY,
};

console.log('Syncing environment variables...');
const existingVars = await functions.listVariables(FUNCTION_ID);
for (const [key, value] of Object.entries(requiredVars)) {
  if (!value) continue;
  const existing = existingVars.variables.find((v) => v.key === key);
  if (existing) {
    await functions.updateVariable(FUNCTION_ID, existing.$id, key, value);
  } else {
    await functions.createVariable(FUNCTION_ID, key, value);
  }
}

console.log('Uploading deployment...');
const codeFile = new File([readFileSync(tarPath)], 'code.tar.gz', { type: 'application/gzip' });
const deployment = await functions.createDeployment(FUNCTION_ID, codeFile, true, ENTRYPOINT, 'npm install');
console.log(`Deployment created: ${deployment.$id} (status: ${deployment.status})`);

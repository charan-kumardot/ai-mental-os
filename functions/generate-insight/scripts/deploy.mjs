import { Client, Functions } from 'node-appwrite';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionDir = resolve(__dirname, '..');
const rootDir = resolve(__dirname, '../../..');

function loadEnv() {
  const envPath = resolve(rootDir, '.env');
  const content = readFileSync(envPath, 'utf-8');
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
const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const functions = new Functions(client);

const FUNCTION_ID = 'generate-insight';
const FUNCTION_NAME = 'Generate Insight';

// 1. Package code as tar.gz (Appwrite build step runs `npm install` itself,
// so node_modules is intentionally excluded from the archive).
const tarPath = resolve(functionDir, 'code.tar.gz');
console.log('Packaging function code...');
execSync(`tar --force-local -czf "${tarPath}" -C "${functionDir}" package.json src`, { stdio: 'inherit' });

// 2. Ensure the function exists.
let exists = true;
try {
  await functions.get(FUNCTION_ID);
} catch {
  exists = false;
}

const RUNTIME = 'node-22';
const ENTRYPOINT = 'src/main.js';

if (!exists) {
  console.log('Creating function...');
  await functions.create(
    FUNCTION_ID,
    FUNCTION_NAME,
    RUNTIME,
    ['users'], // execute: any authenticated user may invoke
    undefined, // events
    undefined, // schedule
    undefined, // timeout
    undefined, // enabled
    undefined, // logging
    ENTRYPOINT, // entrypoint (10th param)
    undefined // commands
  );
} else {
  console.log('Function already exists, updating config...');
  await functions.update(
    FUNCTION_ID,
    FUNCTION_NAME,
    RUNTIME,
    ['users'],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    ENTRYPOINT,
    undefined
  );
}

// 3. Push required env vars into the function (provider keys, Appwrite creds).
const requiredVars = {
  APPWRITE_ENDPOINT: env.APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID: env.APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY: env.APPWRITE_API_KEY,
  GROQ_API_KEY: env.GROQ_API_KEY,
  OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
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

// 4. Create + activate the deployment.
console.log('Uploading deployment...');
const codeFile = new File([readFileSync(tarPath)], 'code.tar.gz', { type: 'application/gzip' });
const deployment = await functions.createDeployment(
  FUNCTION_ID,
  codeFile,
  true, // activate immediately
  ENTRYPOINT,
  'npm install' // build command
);
console.log(`Deployment created: ${deployment.$id} (status: ${deployment.status})`);
console.log('Done. Function will finish building in the background — check status before invoking.');

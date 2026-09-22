/**
 * Idempotent Appwrite provisioning script.
 * Creates the database, collections, attributes, and indexes defined in
 * ../schema.ts against the real Appwrite project. Safe to re-run — it
 * skips anything that already exists rather than erroring or duplicating.
 *
 * Usage: npm run setup   (from packages/appwrite), requires .env at repo root
 * with APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY.
 */
import { Client, Databases, Permission, Role, IndexType } from 'node-appwrite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLLECTIONS, DB_ID, DB_NAME, AttributeDef } from '../schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRootEnv() {
  const envPath = resolve(__dirname, '../../../.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadRootEnv();

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureDatabase() {
  try {
    await databases.get(DB_ID);
    console.log(`[db] "${DB_ID}" already exists`);
  } catch {
    await databases.create(DB_ID, DB_NAME);
    console.log(`[db] created "${DB_ID}"`);
  }
}

async function ensureCollection(id: string, name: string, serverOnly: boolean) {
  // documentSecurity=true so per-document permissions (set at write time)
  // govern row-level access; collection-level perms only gate create.
  const createPerms = serverOnly ? [] : [Permission.create(Role.users())];
  try {
    await databases.getCollection(DB_ID, id);
    console.log(`[collection] "${id}" already exists`);
  } catch {
    await databases.createCollection(DB_ID, id, name, createPerms, true /* documentSecurity */);
    console.log(`[collection] created "${id}"`);
  }
}

async function attrExists(collectionId: string, key: string) {
  const existing = await databases.listAttributes(DB_ID, collectionId);
  return existing.attributes.some((a: any) => a.key === key);
}

async function ensureAttribute(collectionId: string, attr: AttributeDef) {
  if (await attrExists(collectionId, attr.key)) {
    return;
  }
  const { key, required, array, default: def } = attr;
  const d = required ? undefined : (def ?? undefined);

  switch (attr.type) {
    case 'string':
      await databases.createStringAttribute(DB_ID, collectionId, key, attr.size ?? 255, required, d as string, array);
      break;
    case 'integer':
      await databases.createIntegerAttribute(DB_ID, collectionId, key, required, undefined, undefined, d as number, array);
      break;
    case 'float':
      await databases.createFloatAttribute(DB_ID, collectionId, key, required, undefined, undefined, d as number, array);
      break;
    case 'boolean':
      await databases.createBooleanAttribute(DB_ID, collectionId, key, required, d as boolean, array);
      break;
    case 'datetime':
      await databases.createDatetimeAttribute(DB_ID, collectionId, key, required, d as string, array);
      break;
    case 'enum':
      await databases.createEnumAttribute(DB_ID, collectionId, key, attr.elements ?? [], required, d as string, array);
      break;
  }
  console.log(`  [attr] ${collectionId}.${key} (${attr.type}${array ? '[]' : ''})`);
}

async function waitForAttributesReady(collectionId: string, attrKeys: string[]) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const existing = await databases.listAttributes(DB_ID, collectionId);
    const ready = attrKeys.every((k) => {
      const found: any = existing.attributes.find((a: any) => a.key === k);
      return found && found.status === 'available';
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.warn(`  [warn] ${collectionId}: attributes did not reach "available" within 60s, indexes may fail`);
}

async function ensureIndex(collectionId: string, index: { key: string; type: string; attributes: string[] }) {
  const existing = await databases.listIndexes(DB_ID, collectionId);
  if (existing.indexes.some((i: any) => i.key === index.key)) return;

  const typeMap: Record<string, IndexType> = {
    key: IndexType.Key,
    unique: IndexType.Unique,
    fulltext: IndexType.Fulltext,
  };
  await databases.createIndex(DB_ID, collectionId, index.key, typeMap[index.type], index.attributes);
  console.log(`  [index] ${collectionId}.${index.key} on [${index.attributes.join(', ')}]`);
}

async function main() {
  console.log(`Provisioning Appwrite project ${projectId} at ${endpoint}\n`);
  await ensureDatabase();

  for (const col of COLLECTIONS) {
    await ensureCollection(col.id, col.name, !!col.serverOnly);
    for (const attr of col.attributes) {
      await ensureAttribute(col.id, attr);
    }
    await waitForAttributesReady(
      col.id,
      col.attributes.map((a) => a.key)
    );
    for (const idx of col.indexes) {
      await ensureIndex(col.id, idx);
    }
  }

  console.log('\nDone. Schema matches packages/appwrite/schema.ts.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

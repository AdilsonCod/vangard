import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const [backupPath, targetProject, targetDatabase = '(default)', mode = '--dry-run'] = process.argv.slice(2);

if (!backupPath || !targetProject) {
  throw new Error('Uso: node scripts/migrate-firestore-backup.mjs <backup.json> <projeto> [banco] [--apply]');
}

const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));
const collections = backup.collections || {};

function sanitizeDocument(collection, document) {
  const clean = structuredClone(document);
  delete clean._id;
  if (collection === 'users') {
    delete clean.password;
    delete clean.pass;
  }
  return clean;
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, nested]) => nested !== undefined)
            .map(([key, nested]) => [key, firestoreValue(nested)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function firestoreFields(document) {
  return Object.fromEntries(
    Object.entries(document)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, firestoreValue(value)]),
  );
}

const writes = [];
const counts = {};
for (const [collection, documents] of Object.entries(collections)) {
  counts[collection] = documents.length;
  for (const sourceDocument of documents) {
    const documentId = String(sourceDocument._id || sourceDocument.id || '');
    if (!documentId || documentId.includes('/')) {
      throw new Error(`ID inválido em ${collection}: ${documentId}`);
    }
    writes.push({
      update: {
        name: `projects/${targetProject}/databases/${targetDatabase}/documents/${collection}/${documentId}`,
        fields: firestoreFields(sanitizeDocument(collection, sourceDocument)),
      },
    });
  }
}

console.log(JSON.stringify({ targetProject, targetDatabase, totalDocuments: writes.length, counts }, null, 2));
if (mode !== '--apply') process.exit(0);

const firebaseConfigPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const firebaseConfig = JSON.parse(await fs.readFile(firebaseConfigPath, 'utf8'));
const refreshToken = firebaseConfig?.tokens?.refresh_token;
if (!refreshToken) throw new Error('Firebase CLI não autenticado. Execute firebase login.');

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});
if (!tokenResponse.ok) throw new Error(`Falha ao renovar acesso: ${await tokenResponse.text()}`);
const { access_token: accessToken } = await tokenResponse.json();

for (let index = 0; index < writes.length; index += 200) {
  const batch = writes.slice(index, index + 200);
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/${targetDatabase}/documents:commit`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ writes: batch }),
    },
  );
  if (!response.ok) throw new Error(`Falha no lote ${index / 200 + 1}: ${await response.text()}`);
  console.log(`Lote ${index / 200 + 1}: ${batch.length} documentos gravados.`);
}

console.log(`Migração concluída: ${writes.length} documentos.`);

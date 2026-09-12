import { readFile } from 'node:fs/promises';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

type BackupDocument = Record<string, unknown> & { _id?: string; id?: string };
type BackupFile = { collections?: Record<string, BackupDocument[]> };

const applyChanges = process.argv.includes('--apply');
const backupPath = process.env.FIREBASE_SOURCE_BACKUP?.trim() || '.Docs/BAKU.MOD.md';
const backup = JSON.parse(await readFile(backupPath, 'utf8')) as BackupFile;
const collections = backup.collections || {};
const userUnits = new Map<string, string>();

for (const user of collections.users || []) {
  const id = String(user.id || user._id || '').trim();
  const unitId = String(user.unitId || user.unit || '').trim();
  if (id && unitId) userUnits.set(id, unitId);
}

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId,
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
const recoveries: Array<{ collection: string; id: string; unitId: string; source: string }> = [];

for (const collection of ['targets', 'payments']) {
  const snapshot = await db.collection(collection).get();
  for (const document of snapshot.docs) {
    const data = document.data();
    if (String(data.unitId || '').trim()) continue;
    const legacyOwnerId = collection === 'targets' ? document.id : String(data.userId || '').trim();
    const unitId = userUnits.get(legacyOwnerId);
    if (unitId) recoveries.push({
      collection,
      id: document.id,
      unitId,
      source: `backup:${backupPath}:users/${legacyOwnerId}`,
    });
  }
}

console.log(`Vínculos recuperáveis pelo backup: ${recoveries.length}.`);
console.table(recoveries);
if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi alterado.');
  process.exit(0);
}

const batch = db.batch();
const migratedAt = new Date().toISOString();
for (const item of recoveries) {
  batch.update(db.collection(item.collection).doc(item.id), {
    unitId: item.unitId,
    unitIdMigrationSource: item.source,
    unitIdMigratedAt: migratedAt,
  });
}
await batch.commit();
console.log(`Recuperação concluída: ${recoveries.length} documento(s) atualizado(s).`);

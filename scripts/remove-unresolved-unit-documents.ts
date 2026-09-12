import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

type UnresolvedItem = { collection: string; id: string; reason?: string; candidates?: string[] };
type MigrationReport = {
  projectId: string;
  databaseId?: string;
  unresolved: UnresolvedItem[];
};

const applyChanges = process.argv.includes('--apply');
const reportPath = process.env.UNIT_MIGRATION_REPORT?.trim()
  || path.join(process.cwd(), 'unit-id-migration-report.json');
const backupRoot = process.env.FIREBASE_UNIT_BACKUP_DIR?.trim()
  || path.join(process.cwd(), '.local-backups');

const report = JSON.parse(await readFile(reportPath, 'utf8')) as MigrationReport;
if (report.projectId !== firebaseConfig.projectId) {
  throw new Error(`O relatório pertence ao projeto ${report.projectId}, não a ${firebaseConfig.projectId}.`);
}
if (!Array.isArray(report.unresolved) || report.unresolved.length === 0) {
  throw new Error('O relatório não contém documentos não resolvidos.');
}

const uniqueTargets = new Map<string, UnresolvedItem>();
for (const item of report.unresolved) {
  if (!item.collection || !item.id || item.collection.includes('/') || item.id.includes('/')) {
    throw new Error(`Destino inválido no relatório: ${JSON.stringify(item)}.`);
  }
  uniqueTargets.set(`${item.collection}/${item.id}`, item);
}

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId,
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
const snapshots = await Promise.all([...uniqueTargets.values()].map(item =>
  db.collection(item.collection).doc(item.id).get()
));
const existing = snapshots.filter(snapshot => snapshot.exists);
const missing = snapshots.filter(snapshot => !snapshot.exists);

console.log(`Destinos únicos no relatório: ${uniqueTargets.size}.`);
console.log(`Documentos existentes: ${existing.length}. Ausentes: ${missing.length}.`);
console.table(Object.entries(existing.reduce<Record<string, number>>((counts, snapshot) => {
  const collection = snapshot.ref.parent.id;
  counts[collection] = (counts[collection] || 0) + 1;
  return counts;
}, {})).map(([collection, count]) => ({ collection, count })));

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi removido.');
  process.exit(0);
}

await mkdir(backupRoot, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupRoot, `firebase-unit-unresolved-${timestamp}.json`);
await writeFile(backupPath, JSON.stringify({
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  createdAt: new Date().toISOString(),
  sourceReport: path.resolve(reportPath),
  documents: existing.map(snapshot => ({
    collection: snapshot.ref.parent.id,
    id: snapshot.id,
    data: snapshot.data(),
  })),
}, null, 2), 'utf8');

const batch = db.batch();
for (const snapshot of existing) batch.delete(snapshot.ref);
await batch.commit();

const verification = await Promise.all(existing.map(snapshot => snapshot.ref.get()));
const remaining = verification.filter(snapshot => snapshot.exists);
if (remaining.length > 0) {
  throw new Error(`Falha na verificação: ${remaining.length} documento(s) ainda existem.`);
}

console.log(`Backup gravado em: ${backupPath}`);
console.log(`Remoção concluída e verificada: ${existing.length} documento(s).`);

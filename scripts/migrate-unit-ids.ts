import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { planUnitIdMigration, type MigrationDocument } from './unit-id-migration-core';

const PRIVATE_COLLECTIONS = new Set([
  'entries', 'gdvEntries', 'gdvSettings', 'targets', 'monthlyUnitStats', 'monthlyBarberStats',
  'transactions', 'cashClosings', 'payments', 'notifications', 'announcements', 'commissionConfigs',
  'dataImportJobs', 'reconciliation_reports', 'reports_manual_weeks', 'marketing_campaigns',
  'marketing_traffic', 'marketing_organic', 'social_posts', 'social_library', 'message_contact_lists',
  'message_dispatch_history', 'dispatch_audit', 'smart_links', 'smart_link_clicks',
]);
const SUPPORT_COLLECTIONS = new Set(['users', 'systemUnits']);
const applyChanges = process.argv.includes('--apply');
const reportArgument = process.argv.find(argument => argument.startsWith('--report='));
const reportPath = reportArgument?.slice('--report='.length) || 'unit-id-migration-report.json';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
const app = getApps()[0] ?? initializeApp({
  credential,
  projectId: process.env.FIREBASE_PROJECT_ID?.trim() || firebaseConfig.projectId,
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const documents: MigrationDocument[] = [];
for (const collectionName of [...SUPPORT_COLLECTIONS, ...PRIVATE_COLLECTIONS]) {
  const snapshot = await db.collection(collectionName).orderBy(FieldPath.documentId()).get();
  snapshot.docs.forEach(document => documents.push({ collection: collectionName, id: document.id, data: document.data() }));
}

const plan = planUnitIdMigration(documents, PRIVATE_COLLECTIONS);
const resolved = plan.filter(item => item.resolution.status === 'resolved');
const alreadyValid = plan.filter(item => item.resolution.status === 'already-valid');
const unresolved = plan.filter(item => item.resolution.status === 'unresolved');
const report = {
  generatedAt: new Date().toISOString(),
  mode: applyChanges ? 'apply' : 'dry-run',
  projectId: app.options.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  summary: { scanned: plan.length, alreadyValid: alreadyValid.length, resolved: resolved.length, unresolved: unresolved.length },
  changes: resolved.map(item => ({ collection: item.document.collection, id: item.document.id, unitId: item.resolution.unitId, source: item.resolution.source })),
  unresolved: unresolved.map(item => ({ collection: item.document.collection, id: item.document.id, reason: item.resolution.reason, candidates: item.resolution.candidates })),
};

await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Relatório gravado em ${reportPath}.`);

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi alterado.');
  process.exit(0);
}

for (let offset = 0; offset < resolved.length; offset += 400) {
  const batch = db.batch();
  for (const item of resolved.slice(offset, offset + 400)) {
    if (item.resolution.status !== 'resolved') continue;
    batch.update(db.collection(item.document.collection).doc(item.document.id), {
      unitId: item.resolution.unitId,
      unitIdMigrationSource: item.resolution.source,
      unitIdMigratedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
}

console.log(`Aplicação concluída: ${resolved.length} documento(s) atualizado(s); ${unresolved.length} preservado(s) para revisão.`);

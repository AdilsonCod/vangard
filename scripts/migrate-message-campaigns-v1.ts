import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { MESSAGE_CAMPAIGN_COLLECTIONS } from '../src/services/messageCampaignSchema';
import { planLegacyDispatchMigration, type LegacyDispatchHistory } from './message-campaign-migration-core';

const applyChanges = process.argv.includes('--apply');
const reportArgument = process.argv.find(argument => argument.startsWith('--report='));
const reportPath = reportArgument?.slice('--report='.length) || 'message-campaign-migration-v1-report.json';
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID?.trim() || firebaseConfig.projectId });
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const historySnapshot = await db.collection('message_dispatch_history').get();
const existingCampaigns = await db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).get();
const existingIds = new Set(existingCampaigns.docs.map(document => document.id));
const plans = historySnapshot.docs
  .map(document => planLegacyDispatchMigration({ id: document.id, ...document.data() } as LegacyDispatchHistory))
  .filter(plan => !existingIds.has(plan.campaign.id));
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: applyChanges ? 'apply' : 'dry-run',
  projectId: app.options.projectId,
  summary: {
    historyDocuments: historySnapshot.size,
    alreadyMigrated: historySnapshot.size - plans.length,
    campaignsToCreate: plans.length,
    recipientsToCreate: plans.reduce((sum, plan) => sum + plan.recipients.length, 0),
  },
  campaigns: plans.map(plan => ({ id: plan.campaign.id, legacyHistoryId: plan.campaign.legacyHistoryId, unitId: plan.campaign.unitId, recipients: plan.recipients.length })),
};
await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Relatório gravado em ${reportPath}.`);

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi alterado.');
  process.exit(0);
}

const writes = plans.flatMap(plan => [
  { collection: MESSAGE_CAMPAIGN_COLLECTIONS.campaigns, id: plan.campaign.id, data: plan.campaign },
  ...plan.recipients.map(recipient => ({ collection: MESSAGE_CAMPAIGN_COLLECTIONS.recipients, id: recipient.id, data: recipient })),
]);
for (let offset = 0; offset < writes.length; offset += 400) {
  const batch = db.batch();
  writes.slice(offset, offset + 400).forEach(write => batch.create(db.collection(write.collection).doc(write.id), write.data));
  await batch.commit();
}
console.log(`Migração aplicada: ${plans.length} campanha(s) e ${report.summary.recipientsToCreate} destinatário(s).`);


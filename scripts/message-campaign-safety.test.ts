import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { evaluateCampaignFailureWindow, recordMessageDeliverySafety, validateAutomaticPauseResume } from '../message-campaign-safety';
import { claimNextMessageRecipient } from '../message-campaign-worker';
import { planMessageCampaignCreation } from '../message-campaign-creation';

let app: App;
let db: Firestore;
before(() => { app = initializeApp({ projectId: 'vans-message-safety-test', credential: applicationDefault() }, 'message-safety-test'); db = getFirestore(app); });
after(async () => deleteApp(app));

async function seedCampaign(key: string, unitId: string, phone: string) {
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: key, unitId, name: key, message: 'Olá', contacts: [phone], createdBy: 'admin', createdAt: '2026-09-17T12:00:00.000Z' });
  const batch = db.batch();
  batch.set(db.collection('message_campaigns').doc(plan.campaign.id), plan.campaign);
  plan.recipients.forEach(recipient => batch.set(db.collection('message_campaign_recipients').doc(recipient.id), recipient));
  await batch.commit();
  return plan;
}

test('janela móvel só pausa após amostra mínima e limiar configurado', () => {
  const now = new Date('2026-09-17T15:00:00.000Z');
  const base = [{ at: now.toISOString(), campaignId: 'a', result: 'FAILURE' as const }, { at: now.toISOString(), campaignId: 'a', result: 'SUCCESS' as const }];
  assert.equal(evaluateCampaignFailureWindow(base, { windowSize: 5, minimumSample: 3, thresholdPercent: 50, now, cooldownMinutes: 15 }).shouldPause, false);
  const result = evaluateCampaignFailureWindow([...base, { at: now.toISOString(), campaignId: 'a', result: 'FAILURE' }], { windowSize: 5, minimumSample: 3, thresholdPercent: 50, now, cooldownMinutes: 15 });
  assert.equal(result.shouldPause, true);
  assert.equal(Math.round(result.failureRate), 67);
});

test('curva de aquecimento persistente limita a conta conforme sua idade', async () => {
  const plan = await seedCampaign('warmup', 'warmup-unit', '11999991001');
  await db.collection('message_dispatch_policies').doc('warmup-unit').set({ quietHoursEnabled: false, globalDailyLimit: 100, unitDailyLimit: 100, accountDailyLimit: 100, warmupEnabled: true, warmupDailyLimits: [2, 5, 10], warmupStageDays: 2 });
  const accountId = 'warmup-account';
  const { createHash } = await import('node:crypto');
  const accountDocumentId = createHash('sha256').update(accountId).digest('hex').slice(0, 32);
  await db.collection('message_account_safety').doc(accountDocumentId).set({ unitId: 'warmup-unit', accountId, warmupStartedAt: '2026-09-14T12:00:00.000Z' });
  await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'warmup-unit', accountId, now: new Date('2026-09-17T15:00:00.000Z') });
  const counter = await db.collection('message_dispatch_quota_counters').where('scope', '==', 'conta').where('scopeId', '==', accountId).get();
  assert.equal(counter.docs[0].data().limit, 5);
  const safety = await db.collection('message_account_safety').doc(accountDocumentId).get();
  assert.equal(safety.data()?.warmupStage, 1);
  assert.equal(safety.data()?.warmupDailyLimit, 5);
});

test('taxa elevada pausa campanha e persiste causa e métricas', async () => {
  const plan = await seedCampaign('auto-pause', 'safety-unit', '11999991002');
  await db.collection('message_dispatch_policies').doc('safety-unit').set({ failureWindowSize: 5, failureMinimumSample: 3, failureThresholdPercent: 50, autoPauseCooldownMinutes: 15 });
  const times = ['15:00', '15:01', '15:02'];
  await recordMessageDeliverySafety(db, { unitId: 'safety-unit', accountId: 'safety-account', campaignId: plan.campaign.id, success: false, now: new Date(`2026-09-17T${times[0]}:00.000Z`) });
  await recordMessageDeliverySafety(db, { unitId: 'safety-unit', accountId: 'safety-account', campaignId: plan.campaign.id, success: true, now: new Date(`2026-09-17T${times[1]}:00.000Z`) });
  const result = await recordMessageDeliverySafety(db, { unitId: 'safety-unit', accountId: 'safety-account', campaignId: plan.campaign.id, success: false, now: new Date(`2026-09-17T${times[2]}:00.000Z`) });
  assert.equal(result.shouldPause, true);
  const campaign = await db.collection('message_campaigns').doc(plan.campaign.id).get();
  assert.equal(campaign.data()?.status, 'PAUSADA');
  assert.equal(campaign.data()?.autoPaused, true);
  assert.match(campaign.data()?.autoPauseReason, /66\.7%/);
});

test('retomada automática exige cooldown e registra responsável na auditoria', async () => {
  const campaigns = await db.collection('message_campaigns').where('unitId', '==', 'safety-unit').get();
  const campaign = campaigns.docs.find(document => document.data().autoPaused === true);
  assert.ok(campaign);
  await assert.rejects(() => validateAutomaticPauseResume(db, { campaignId: campaign!.id, unitId: 'safety-unit', accountId: 'safety-account', actorId: 'admin-1', now: new Date('2026-09-17T15:10:00.000Z') }), /Retomada protegida/);
  assert.equal(await validateAutomaticPauseResume(db, { campaignId: campaign!.id, unitId: 'safety-unit', accountId: 'safety-account', actorId: 'admin-1', now: new Date('2026-09-17T15:18:00.000Z') }), true);
  const updated = await campaign!.ref.get();
  assert.equal(updated.data()?.autoPaused, false);
  assert.equal(updated.data()?.resumedBy, 'admin-1');
  const audit = await db.collection('dispatch_audit').where('campaignId', '==', campaign!.id).get();
  assert.equal(audit.docs.some(document => document.data().action === 'CAMPAIGN_AUTO_PAUSE_RESUMED'), true);
});

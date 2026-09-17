import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { claimNextMessageRecipient } from '../message-campaign-worker';
import { planMessageCampaignCreation } from '../message-campaign-creation';
import { MessageDispatchPolicyBlockedError, normalizeMessageDispatchPolicy, quietHoursBlock } from '../message-dispatch-limits';

let app: App;
let db: Firestore;

before(() => {
  app = initializeApp({ projectId: 'vans-message-limits-test', credential: applicationDefault() }, 'message-limits-test');
  db = getFirestore(app);
});
after(async () => deleteApp(app));

async function seedCampaign(key: string, unitId: string, phone: string, createdAt = '2026-09-17T15:00:00.000Z') {
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: key, unitId, name: key, message: 'Olá', contacts: [phone], createdBy: 'admin', createdAt });
  const batch = db.batch();
  batch.set(db.collection('message_campaigns').doc(plan.campaign.id), plan.campaign);
  plan.recipients.forEach(recipient => batch.set(db.collection('message_campaign_recipients').doc(recipient.id), recipient));
  await batch.commit();
  return plan;
}

test('horário silencioso calcula liberação sem alterar a fila', () => {
  const policy = normalizeMessageDispatchPolicy({ quietStart: '22:00', quietEnd: '08:00', timeZone: 'America/Sao_Paulo' });
  const block = quietHoursBlock(policy, new Date('2026-09-18T02:00:00.000Z'));
  assert.equal(block?.code, 'QUIET_HOURS');
  assert.match(block?.message || '', /08:00/);
  assert.equal(quietHoursBlock(policy, new Date('2026-09-17T15:00:00.000Z')), null);
});

test('reservas concorrentes não ultrapassam o limite diário global', async () => {
  const first = await seedCampaign('daily-a', 'limit-a', '11999990001');
  const second = await seedCampaign('daily-b', 'limit-b', '11999990002');
  for (const unitId of ['limit-a', 'limit-b']) await db.collection('message_dispatch_policies').doc(unitId).set({ globalDailyLimit: 1, unitDailyLimit: 10, accountDailyLimit: 10, quietHoursEnabled: false });
  const now = new Date('2026-09-17T15:01:00.000Z');
  const outcomes = await Promise.allSettled([
    claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: first.campaign.id, unitId: 'limit-a', accountId: 'account-a', now }),
    claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: second.campaign.id, unitId: 'limit-b', accountId: 'account-b', now }),
  ]);
  assert.equal(outcomes.filter(item => item.status === 'fulfilled' && item.value).length, 1);
  const rejected = outcomes.find(item => item.status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof MessageDispatchPolicyBlockedError);
  assert.equal((rejected as PromiseRejectedResult).reason.block.code, 'GLOBAL_DAILY_LIMIT');
});

test('mesmo contato não é reservado por campanhas simultâneas ou recentes', async () => {
  const first = await seedCampaign('frequency-a', 'frequency-unit', '11999990111');
  const second = await seedCampaign('frequency-b', 'frequency-unit', '11999990111');
  await db.collection('message_dispatch_policies').doc('frequency-unit').set({ globalDailyLimit: 100, unitDailyLimit: 100, accountDailyLimit: 100, contactFrequencyHours: 24, quietHoursEnabled: false });
  const now = new Date('2026-09-17T15:01:00.000Z');
  const claimed = await claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: first.campaign.id, unitId: 'frequency-unit', accountId: 'account-a', now });
  assert.ok(claimed);
  await assert.rejects(
    () => claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: second.campaign.id, unitId: 'frequency-unit', accountId: 'account-a', now }),
    (error: unknown) => error instanceof MessageDispatchPolicyBlockedError && error.block.code === 'CONTACT_FREQUENCY',
  );
  const snapshot = await db.collection('message_campaign_recipients').doc(second.recipients[0].id).get();
  assert.equal(snapshot.data()?.status, 'PENDENTE');
  assert.equal(snapshot.data()?.nextAttemptAt, second.recipients[0].nextAttemptAt);
});

test('retentativa do mesmo destinatário reutiliza a reserva sem consumir nova cota', async () => {
  const plan = await seedCampaign('retry-reservation', 'retry-unit', '11999990222');
  await db.collection('message_dispatch_policies').doc('retry-unit').set({ globalDailyLimit: 100, unitDailyLimit: 1, accountDailyLimit: 1, quietHoursEnabled: false });
  const first = await claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: plan.campaign.id, unitId: 'retry-unit', accountId: 'account-retry', now: new Date('2026-09-17T15:01:00.000Z'), leaseMs: 10_000 });
  assert.ok(first?.policyReservedAt);
  const recovered = await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: plan.campaign.id, unitId: 'retry-unit', accountId: 'account-retry', now: new Date('2026-09-17T15:02:00.000Z') });
  assert.equal(recovered?.id, first?.id);
  const counter = await db.collection('message_dispatch_quota_counters').where('scope', '==', 'unidade').where('scopeId', '==', 'retry-unit').get();
  assert.equal(counter.docs[0]?.data().used, 1);
});

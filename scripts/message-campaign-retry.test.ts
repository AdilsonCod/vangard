import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { planMessageCampaignCreation } from '../message-campaign-creation';
import { claimNextMessageRecipient, finalizeMessageRecipient } from '../message-campaign-worker';
import { classifyMessageFailure, handleMessageRecipientFailure, messageRetryDecision, requeueMessageDeadLetter } from '../message-campaign-retry';

let app: App; let db: Firestore;
before(() => { app = initializeApp({ projectId: 'vans-message-retry-test', credential: applicationDefault() }, 'message-retry-test'); db = getFirestore(app); });
after(async () => deleteApp(app));

async function seed(key: string) {
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: key, unitId: 'unit-a', name: key, message: 'Olá', contacts: ['11999999999'], createdBy: 'admin', createdAt: '2026-09-16T12:00:00.000Z' });
  const batch = db.batch(); batch.set(db.collection('message_campaigns').doc(plan.campaign.id), plan.campaign); batch.set(db.collection('message_campaign_recipients').doc(plan.recipients[0].id), plan.recipients[0]); await batch.commit(); return plan;
}

test('classificação e backoff usam relógio controlado', () => {
  assert.equal(classifyMessageFailure(new Error('Número não encontrado no WhatsApp')), 'PERMANENT');
  assert.equal(classifyMessageFailure(new Error('socket timeout 503')), 'TRANSIENT');
  const now = new Date('2026-09-16T12:00:00.000Z');
  assert.deepEqual(messageRetryDecision({ attemptCount: 1, maxAttempts: 3 }, new Error('timeout'), now, 1_000), { kind: 'TRANSIENT', retry: true, retryAt: '2026-09-16T12:00:01.000Z', delayMs: 1_000 });
  assert.equal(messageRetryDecision({ attemptCount: 2, maxAttempts: 3 }, new Error('timeout'), now, 1_000).delayMs, 2_000);
  assert.equal(messageRetryDecision({ attemptCount: 3, maxAttempts: 3 }, new Error('timeout'), now, 1_000).retry, false);
});

test('falha transitória é retomada e sucesso posterior não cria fila de erros', async () => {
  const plan = await seed('transient'); const now = new Date('2026-09-16T12:01:00.000Z');
  const first = await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'unit-a', now }); assert.ok(first);
  const failure = await handleMessageRecipientFailure(db, { recipientId: first.id, workerId: 'worker', error: new Error('socket timeout'), now, baseDelayMs: 1_000 }); assert.equal(failure?.decision.retry, true);
  assert.equal(await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'unit-a', now }), null);
  const retry = await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:01.000Z') }); assert.ok(retry);
  await finalizeMessageRecipient(db, retry.id, 'worker', 'ENVIADO', { now: new Date('2026-09-16T12:01:02.000Z') });
  const dead = await db.collection('message_dead_letters').where('recipientId', '==', retry.id).get(); assert.equal(dead.empty, true);
});

test('falha definitiva entra na fila de erros mascarada e pode ser reprocessada com auditoria', async () => {
  const plan = await seed('permanent'); const now = new Date('2026-09-16T13:00:00.000Z');
  const claimed = await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'unit-a', now }); assert.ok(claimed);
  const failure = await handleMessageRecipientFailure(db, { recipientId: claimed.id, workerId: 'worker', error: new Error('Número não encontrado no WhatsApp'), now }); assert.equal(failure?.decision.retry, false);
  const deadReference = db.collection('message_dead_letters').doc(`dead_${claimed.id}`); const dead = await deadReference.get(); assert.equal(dead.exists, true); assert.equal(String(dead.data()?.maskedPhone).includes('999999999'), false);
  assert.equal(await requeueMessageDeadLetter(db, { deadLetterId: dead.id, actorId: 'admin', now: new Date('2026-09-16T14:00:00.000Z') }), true);
  const audited = await deadReference.get(); assert.equal(audited.data()?.reprocessedBy, 'admin');
  const auditEvents = await db.collection('dispatch_audit').where('recipientId', '==', claimed.id).get(); assert.equal(auditEvents.size, 1);
  const reopenedCampaign = await db.collection('message_campaigns').doc(plan.campaign.id).get(); assert.equal(reopenedCampaign.data()?.status, 'NA_FILA');
});

test('falha transitória esgotada encerra na terceira tentativa', async () => {
  const plan = await seed('exhausted');
  const times = ['2026-09-16T15:00:00.000Z', '2026-09-16T15:00:01.000Z', '2026-09-16T15:00:03.000Z'];
  for (let index = 0; index < times.length; index++) {
    const now = new Date(times[index]);
    const claimed = await claimNextMessageRecipient(db, { workerId: 'worker', campaignId: plan.campaign.id, unitId: 'unit-a', now }); assert.ok(claimed);
    const failure = await handleMessageRecipientFailure(db, { recipientId: claimed.id, workerId: 'worker', error: new Error('timeout de rede'), now, baseDelayMs: 1_000 });
    assert.equal(failure?.decision.retry, index < 2);
  }
  const recipient = await db.collection('message_campaign_recipients').doc(plan.recipients[0].id).get(); assert.equal(recipient.data()?.status, 'FALHOU'); assert.equal(recipient.data()?.attemptCount, 3);
  const attempts = await db.collection('message_delivery_attempts').where('recipientId', '==', plan.recipients[0].id).get(); assert.equal(attempts.size, 3);
  const dead = await db.collection('message_dead_letters').doc(`dead_${plan.recipients[0].id}`).get(); assert.equal(dead.exists, true);
});

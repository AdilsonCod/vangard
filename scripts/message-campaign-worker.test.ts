import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { claimNextMessageRecipient, finalizeMessageRecipient, renewMessageRecipientLease } from '../message-campaign-worker';
import { planMessageCampaignCreation } from '../message-campaign-creation';

let app: App;
let db: Firestore;
let seededPhone = 0;

before(() => {
  app = initializeApp({ projectId: 'vans-message-worker-test', credential: applicationDefault() }, 'message-worker-test');
  db = getFirestore(app);
});

after(async () => deleteApp(app));

async function seed(key: string, createdAt = '2026-09-16T12:00:00.000Z') {
  const phone = `11999${String(++seededPhone).padStart(6, '0')}`;
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: key, unitId: 'unit-a', name: key, message: 'Olá', contacts: [phone], createdBy: 'admin', createdAt });
  const batch = db.batch();
  batch.set(db.collection('message_campaigns').doc(plan.campaign.id), plan.campaign);
  plan.recipients.forEach(recipient => batch.set(db.collection('message_campaign_recipients').doc(recipient.id), recipient));
  await batch.commit();
  return plan;
}

test('duas instâncias concorrentes reivindicam exatamente uma vez', async () => {
  const plan = await seed('concurrent');
  const now = new Date('2026-09-16T12:01:00.000Z');
  const results = await Promise.all([
    claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: plan.campaign.id, unitId: 'unit-a', now }),
    claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: plan.campaign.id, unitId: 'unit-a', now }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(new Set(results.filter(Boolean).map(item => item?.idempotencyKey)).size, 1);
});

test('lease vigente é protegido, pode ser renovado pelo proprietário e expirado é recuperado', async () => {
  const plan = await seed('lease');
  const first = await claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:00.000Z'), leaseMs: 60_000 });
  assert.ok(first);
  assert.equal(await renewMessageRecipientLease(db, first.id, 'worker-b', new Date('2026-09-16T12:01:10.000Z')), false);
  assert.equal(await renewMessageRecipientLease(db, first.id, 'worker-a', new Date('2026-09-16T12:01:10.000Z'), 60_000), true);
  assert.equal(await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:30.000Z') }), null);
  const recovered = await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:02:11.000Z') });
  assert.equal(recovered?.id, first.id);
  assert.equal(recovered?.leaseOwner, 'worker-b');
});

test('destinatário finalizado e campanha cancelada nunca retornam à fila', async () => {
  const completedPlan = await seed('completed');
  const claimed = await claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: completedPlan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:00.000Z') });
  assert.ok(claimed);
  assert.equal(await finalizeMessageRecipient(db, claimed.id, 'worker-a', 'ENVIADO'), true);
  assert.equal(await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: completedPlan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T13:00:00.000Z') }), null);

  const cancelledPlan = await seed('cancelled');
  await db.collection('message_campaigns').doc(cancelledPlan.campaign.id).update({ status: 'CANCELADA' });
  assert.equal(await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: cancelledPlan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T13:00:00.000Z') }), null);
});

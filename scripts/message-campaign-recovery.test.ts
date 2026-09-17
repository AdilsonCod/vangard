import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { planMessageCampaignCreation } from '../message-campaign-creation';
import { recoverMessageCampaign } from '../message-campaign-recovery';
import { claimNextMessageRecipient, finalizeMessageRecipient } from '../message-campaign-worker';

let app: App;
let db: Firestore;
before(() => { app = initializeApp({ projectId: 'vans-message-recovery-test', credential: applicationDefault() }, 'message-recovery-test'); db = getFirestore(app); });
after(async () => deleteApp(app));

async function seed() {
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: 'restart', unitId: 'unit-a', name: 'Retomada', message: 'Olá', contacts: ['11999999999', '11888888888', '11777777777'], createdBy: 'admin', createdAt: '2026-09-16T12:00:00.000Z' });
  const batch = db.batch();
  batch.set(db.collection('message_campaigns').doc(plan.campaign.id), plan.campaign);
  plan.recipients.forEach(recipient => batch.set(db.collection('message_campaign_recipients').doc(recipient.id), recipient));
  await batch.commit();
  return plan;
}

test('reinício recupera lease vencido, preserva concluídos e reconstrói contadores', async () => {
  const plan = await seed();
  const first = await claimNextMessageRecipient(db, { workerId: 'old-worker', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:00.000Z'), leaseMs: 60_000 });
  assert.ok(first);
  await finalizeMessageRecipient(db, first.id, 'old-worker', 'ENVIADO', { now: new Date('2026-09-16T12:01:10.000Z') });
  const interrupted = await claimNextMessageRecipient(db, { workerId: 'old-worker', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:01:20.000Z'), leaseMs: 60_000 });
  assert.ok(interrupted);
  const recovered = await recoverMessageCampaign(db, plan.campaign.id, new Date('2026-09-16T12:03:00.000Z'));
  assert.ok(recovered);
  assert.equal(recovered.recoveredLeases, 1);
  assert.equal(recovered.campaign.sentCount, 1);
  assert.equal(recovered.campaign.pendingCount, 2);
  assert.equal(recovered.campaign.processingCount, 0);

  const processed = new Set<string>([first.id]);
  while (true) {
    const item = await claimNextMessageRecipient(db, { workerId: 'new-worker', campaignId: plan.campaign.id, unitId: 'unit-a', now: new Date('2026-09-16T12:04:00.000Z') });
    if (!item) break;
    assert.equal(processed.has(item.id), false);
    processed.add(item.id);
    await finalizeMessageRecipient(db, item.id, 'new-worker', 'ENVIADO', { now: new Date('2026-09-16T12:04:10.000Z') });
  }
  assert.equal(processed.size, 3);
  const finished = await recoverMessageCampaign(db, plan.campaign.id, new Date('2026-09-16T12:05:00.000Z'));
  assert.equal(finished?.campaign.sentCount, 3);
  assert.equal(finished?.campaign.status, 'CONCLUIDA');
});

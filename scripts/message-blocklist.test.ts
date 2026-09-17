import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { blockMessageContact, canUnblockMessageContact, isMessageContactBlocked, isMessageOptOut, messageBlocklistId, unblockMessageContact } from '../message-blocklist';
import { createMessageCampaign } from '../message-campaign-creation';
import { claimNextMessageRecipient } from '../message-campaign-worker';
import { registerMessageConsents } from '../message-consent';

let app: App;
let db: Firestore;

before(() => {
  app = initializeApp({ projectId: 'vans-message-blocklist-test', credential: applicationDefault() }, 'message-blocklist-test');
  db = getFirestore(app);
});

after(async () => deleteApp(app));

const campaign = async (key: string, contacts: string[]) => {
  await registerMessageConsents(db, { unitId: 'unit-a', actorId: 'admin', now: new Date('2026-09-17T12:00:00.000Z'), contacts: contacts.map(phone => ({ phone, origin: 'Cadastro', consentAt: '2026-09-16T12:00:00.000Z', evidence: 'Formulário assinado' })) });
  return createMessageCampaign(db, { requestIdempotencyKey: key, unitId: 'unit-a', name: key, message: 'Olá', contacts, createdBy: 'admin', createdAt: '2026-09-17T12:00:00.000Z', confirmedOptIn: true });
};

test('detecta palavras de saída com caixa, acentos, espaços e pontuação', () => {
  for (const value of ['sair', ' SAIR! ', 'S Á I R', 'parar', 'P-A-R-A-R', 'cancelar', 'CANCELÁR.']) assert.equal(isMessageOptOut(value), true, value);
  for (const value of ['quero sair', 'pararam', 'cancelamento', '']) assert.equal(isMessageOptOut(value), false, value);
});

test('contato bloqueado não entra em uma nova campanha', async () => {
  await blockMessageContact(db, { phone: '11911110001', reason: 'Solicitação do cliente', source: 'MANUAL', actorId: 'admin' });
  const created = await campaign('blocked-at-creation', ['11911110001', '11911110002']);
  assert.equal(created.recipientsCreated, 1);
  const recipients = await db.collection('message_campaign_recipients').where('campaignId', '==', created.campaign.id).get();
  assert.deepEqual(recipients.docs.map(item => item.data().normalizedPhone), ['5511911110002']);
});

test('bloqueio imediato cancela destinatário que ainda estava na fila', async () => {
  const created = await campaign('cancel-pending', ['11911110003']);
  const result = await blockMessageContact(db, { phone: '11911110003', reason: 'Opt-out recebido', source: 'WHATSAPP_OPT_OUT', actorId: 'WHATSAPP' });
  const recipient = await db.collection('message_campaign_recipients').where('campaignId', '==', created.campaign.id).get();
  assert.equal(result.cancelledRecipients, 1);
  assert.equal(recipient.docs[0].data().status, 'CANCELADO');
  assert.equal(await isMessageContactBlocked(db, '11911110003'), true);
});

test('corrida entre worker e bloqueio termina sem destinatário elegível', async () => {
  const created = await campaign('block-race', ['11911110004']);
  await Promise.all([
    claimNextMessageRecipient(db, { workerId: 'worker-a', campaignId: created.campaign.id, unitId: 'unit-a', now: new Date('2026-09-17T12:01:00.000Z') }),
    blockMessageContact(db, { phone: '11911110004', reason: 'Opt-out concorrente', source: 'WHATSAPP_OPT_OUT', actorId: 'WHATSAPP', now: new Date('2026-09-17T12:01:00.000Z') }),
  ]);
  const recipients = await db.collection('message_campaign_recipients').where('campaignId', '==', created.campaign.id).get();
  assert.equal(recipients.docs[0].data().status, 'CANCELADO');
  assert.equal(await claimNextMessageRecipient(db, { workerId: 'worker-b', campaignId: created.campaign.id, unitId: 'unit-a', now: new Date('2026-09-17T12:02:00.000Z') }), null);
});

test('desbloqueio exige justificativa e preserva histórico', async () => {
  assert.equal(canUnblockMessageContact('RECEPTION'), false);
  assert.equal(canUnblockMessageContact('MARKETING'), false);
  assert.equal(canUnblockMessageContact('ADMIN'), true);
  const blocked = await blockMessageContact(db, { phone: '11911110005', reason: 'Bloqueio manual', source: 'MANUAL', actorId: 'admin' });
  await assert.rejects(() => unblockMessageContact(db, { id: blocked.id, justification: 'curta', actorId: 'admin' }), /10 caracteres/);
  await unblockMessageContact(db, { id: blocked.id, justification: 'Consentimento confirmado novamente', actorId: 'admin' });
  assert.equal(await isMessageContactBlocked(db, '11911110005'), false);
  const document = await db.collection('message_global_blocklist').doc(messageBlocklistId('11911110005')).get();
  assert.equal(document.data()?.status, 'ACTIVE');
  assert.equal((await db.collection('message_consent_events').where('phoneHash', '==', blocked.id).get()).size, 2);
});

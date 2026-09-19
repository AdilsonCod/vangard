import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { applyMessagePhoneRetention, mapImportedConsentRows, messageConsentId, reconstructConsentAt, registerMessageConsents, validateContactConsent, type MessageConsentEvent } from '../message-consent';

let app: App;
let db: Firestore;
before(() => { app = initializeApp({ projectId: 'vans-message-consent-test', credential: applicationDefault() }, 'message-consent-test'); db = getFirestore(app); });
after(async () => deleteApp(app));

test('mapeia origem, data e evidência de colunas configuráveis', () => {
  const mapped = mapImportedConsentRows([{ Celular: '11999999999', Fonte: 'Landing page', Aceite: '2026-09-01', Comprovante: 'lead-123' }], { phone: 'Celular', origin: 'Fonte', consentAt: 'Aceite', evidence: 'Comprovante' });
  assert.deepEqual(mapped[0], { phone: '11999999999', origin: 'Landing page', consentAt: '2026-09-01', evidence: 'lead-123', legalBasis: 'CONSENT' });
});

test('validação rejeita prova incompleta e data futura', () => {
  const now = new Date('2026-09-17T12:00:00.000Z');
  assert.equal(validateContactConsent({ phone: '11999999999', origin: '', consentAt: '2026-09-01', evidence: 'x' }, now).valid, false);
  assert.equal(validateContactConsent({ phone: '11999999999', origin: 'Site', consentAt: '2026-09-18', evidence: 'x' }, now).valid, false);
  assert.equal(validateContactConsent({ phone: '11999999999', origin: 'Site', consentAt: '2026-09-01', evidence: 'lead-1' }, now).valid, true);
});

test('registro persiste estado atual e evento imutável com autor e unidade', async () => {
  await registerMessageConsents(db, { unitId: 'unit-a', actorId: 'admin-1', now: new Date('2026-09-17T12:00:00.000Z'), contacts: [{ phone: '11999990001', origin: 'Recepção', consentAt: '2026-09-10', evidence: 'Ficha 10' }] });
  const consent = await db.collection('message_contact_consents').doc(messageConsentId('unit-a', '11999990001')).get();
  assert.equal(consent.data()?.status, 'GRANTED');
  assert.equal(consent.data()?.unitId, 'unit-a');
  const events = await db.collection('message_consent_events').where('phoneHash', '==', messageConsentId('unit-a', '11999990001')).get();
  assert.equal(events.size, 1);
  assert.equal(events.docs[0].data().actorId, 'admin-1');
});

test('auditoria reconstrói a situação em qualquer data', () => {
  const events: MessageConsentEvent[] = [
    { action: 'OPT_IN', unitId: 'unit-a', phoneHash: 'x', timestamp: '2026-01-01T00:00:00.000Z', actorId: 'a' },
    { action: 'OPT_OUT', unitId: 'unit-a', phoneHash: 'x', timestamp: '2026-02-01T00:00:00.000Z', actorId: 'client' },
    { action: 'OPT_IN_RESTORED', unitId: 'unit-a', phoneHash: 'x', timestamp: '2026-03-01T00:00:00.000Z', actorId: 'a' },
  ];
  assert.equal(reconstructConsentAt(events, new Date('2026-01-15')).granted, true);
  assert.equal(reconstructConsentAt(events, new Date('2026-02-15')).granted, false);
  assert.equal(reconstructConsentAt(events, new Date('2026-03-15')).granted, true);
});

test('retenção anonimiza telefones antigos sem apagar métricas', async () => {
  await db.collection('message_campaign_recipients').doc('old-recipient').set({ normalizedPhone: '5511999990002', maskedPhone: '5511*****0002', processedAt: '2024-01-01T00:00:00.000Z', variables: { nome: 'Ana' }, personalizedMessage: 'Olá Ana', sentCount: 1 });
  await db.collection('message_dispatch_history').doc('old-history').set({ finishedAt: '2024-01-01T00:00:00.000Z', contacts: ['5511999990002'], deliveryDetails: [{ contact: '5511999990002' }], successCount: 1, total: 1 });
  await db.collection('message_contact_directory').doc('old-contact').set({ updatedAt: '2024-01-01T00:00:00.000Z', normalizedPhone: '5511999990002' });
  await db.collection('message_contact_consents').doc('old-consent').set({ updatedAt: '2024-01-01T00:00:00.000Z', normalizedPhone: '5511999990002' });
  const result = await applyMessagePhoneRetention(db, new Date('2026-09-17T12:00:00.000Z'), 365);
  assert.equal(result.anonymizedRecipients, 1);
  assert.equal(result.anonymizedHistories, 1);
  assert.equal(result.deletedDirectoryContacts, 1);
  assert.equal(result.deletedConsents, 1);
  const recipient = (await db.collection('message_campaign_recipients').doc('old-recipient').get()).data();
  assert.match(String(recipient?.normalizedPhone), /^anon_/);
  assert.equal(recipient?.personalizedMessage, '');
  assert.deepEqual(recipient?.variables, {});
  assert.equal(recipient?.sentCount, 1);
  const history = (await db.collection('message_dispatch_history').doc('old-history').get()).data();
  assert.deepEqual(history?.contacts, []);
  assert.equal(history?.successCount, 1);
  assert.equal((await db.collection('message_contact_directory').doc('old-contact').get()).exists, false);
  assert.equal((await db.collection('message_contact_consents').doc('old-consent').get()).exists, false);
});

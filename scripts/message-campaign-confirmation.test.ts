import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCampaignTestSend, highVolumeChallengePhrase, type HighVolumeChallengeDocument, validateHighVolumeChallenge } from '../message-campaign-confirmation';

const baseChallenge = (): HighVolumeChallengeDocument => ({
  id: 'challenge-1',
  campaignId: 'campaign-1',
  payloadHash: 'payload-1',
  unitId: 'unit-1',
  createdBy: 'admin-1',
  recipientCount: 75,
  phraseHash: '3f3dbb85619c6e3021500d529d3a72f1983b500854ffefe1120ed0b05adc7f7d',
  createdAt: '2026-09-18T12:00:00.000Z',
  expiresAt: '2026-09-18T12:10:00.000Z',
  usedAt: null,
});

const validation = { campaignId: 'campaign-1', payloadHash: 'payload-1', unitId: 'unit-1', actorId: 'admin-1', recipientCount: 75, answer: highVolumeChallengePhrase(75), now: new Date('2026-09-18T12:05:00.000Z') };

test('confirmação de alto volume rejeita texto incorreto', () => {
  assert.throws(() => validateHighVolumeChallenge(baseChallenge(), { ...validation, answer: 'ENVIAR' }), /texto de confirmação está incorreto/i);
});

test('confirmação de alto volume rejeita desafio expirado', () => {
  assert.throws(() => validateHighVolumeChallenge(baseChallenge(), { ...validation, now: new Date('2026-09-18T12:11:00.000Z') }), /expirou/i);
});

test('confirmação de alto volume aceita desafio correto e vinculado ao conteúdo', () => {
  assert.equal(validateHighVolumeChallenge(baseChallenge(), validation), true);
  assert.throws(() => validateHighVolumeChallenge(baseChallenge(), { ...validation, payloadHash: 'alterado' }), /não corresponde/i);
});

test('falha de envio de teste permanece vinculada à campanha', () => {
  const record = buildCampaignTestSend({ id: 'test-1', campaignId: 'campaign-1', unitId: 'unit-1', normalizedPhoneHash: 'hash', maskedPhone: '5511*****9999', message: 'Mensagem final', createdAt: '2026-09-18T12:00:00.000Z', createdBy: 'admin-1', error: 'WhatsApp indisponível' });
  assert.equal(record.status, 'FALHOU');
  assert.equal(record.campaignId, 'campaign-1');
  assert.equal(record.error, 'WhatsApp indisponível');
});

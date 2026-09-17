import assert from 'node:assert/strict';
import test from 'node:test';
import { planLegacyDispatchMigration } from './message-campaign-migration-core';

test('migração cria campanha e destinatários versionados e vinculados à unidade', () => {
  const plan = planLegacyDispatchMigration({ id: 'history-1', name: 'Retorno', unitId: 'unit-a', status: 'CONCLUIDO', message: 'Olá', total: 2, createdAt: '2026-09-01T10:00:00.000Z', deliveryDetails: [{ contact: '5511999999999', status: 'ENVIADO', processedAt: '2026-09-01T10:01:00.000Z' }, { contact: '5511888888888', status: 'FALHA', error: 'indisponível' }] });
  assert.equal(plan.campaign.schemaVersion, 1);
  assert.equal(plan.campaign.unitId, 'unit-a');
  assert.equal(plan.campaign.sentCount, 1);
  assert.equal(plan.campaign.failedCount, 1);
  assert.equal(plan.recipients.length, 2);
  assert.ok(plan.recipients.every(item => item.unitId === 'unit-a' && item.campaignId === plan.campaign.id && item.idempotencyKey.length === 64));
});

test('migração é determinística, remove contatos duplicados e não altera a entrada', () => {
  const source = { id: 'history-2', unitId: 'unit-b', contacts: ['(11) 99999-9999', '11999999999'], total: 2 };
  const before = structuredClone(source);
  const first = planLegacyDispatchMigration(source);
  const second = planLegacyDispatchMigration(source);
  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.equal(first.recipients.length, 1);
  assert.equal(first.recipients[0].maskedPhone.includes('999999999'), false);
});

test('histórico sem detalhes preserva totais e não inventa destinatários', () => {
  const plan = planLegacyDispatchMigration({ id: 'history-3', unitId: 'ALL', total: 10, successCount: 8, errorCount: 2, status: 'INTERROMPIDO' });
  assert.equal(plan.recipients.length, 0);
  assert.equal(plan.campaign.totalRecipients, 10);
  assert.equal(plan.campaign.sentCount, 8);
  assert.equal(plan.campaign.failedCount, 2);
  assert.equal(plan.campaign.pendingCount, 0);
  assert.equal(plan.campaign.status, 'CANCELADA');
});

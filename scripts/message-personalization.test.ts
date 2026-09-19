import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSavedMessage, materializeMessage } from '../message-personalization';
import { planMessageCampaignCreation } from '../message-campaign-creation';

test('materializa primeiro nome, segundo nome e variáveis com fallback seguro', () => {
  assert.equal(materializeMessage('Olá {{primeiro_nome}} {{segundo_nome}}, unidade {{Unidade}}.', { name: 'Ana Silva Souza', variables: { Unidade: 'Matriz' } }), 'Olá Ana Silva, unidade Matriz.');
  assert.equal(materializeMessage('Olá {{primeiro_nome}} {{segundo_nome}} {{campo_ausente}}.', {}), 'Olá cliente  .');
});

test('destinatários persistem mensagem materializada individualmente', () => {
  const plan = planMessageCampaignCreation({ requestIdempotencyKey: 'personalization-1', unitId: 'unit-a', name: 'Retorno', message: 'Olá {{primeiro_nome}}, sua unidade é {{unidade}}.', contacts: ['11999990001', '11999990002'], recipientData: [{ phone: '11999990001', name: 'Ana Silva', variables: { unidade: 'Matriz' } }, { phone: '11999990002', name: 'Bruno Souza', variables: { unidade: 'Damas' } }], createdBy: 'admin' });
  assert.deepEqual(plan.recipients.map(item=>item.personalizedMessage), ['Olá Ana, sua unidade é Matriz.', 'Olá Bruno, sua unidade é Damas.']);
  assert.equal(plan.recipients[0].variables.nome, 'Ana Silva');
});

test('rascunho e modelo exigem conteúdo e preservam vínculo com unidade', () => {
  const saved = buildSavedMessage({ id: 'draft-1', unitId: 'unit-a', name: 'Retorno', message: 'Olá', actorId: 'admin', kind: 'DRAFT', now: '2026-09-18T12:00:00.000Z' });
  assert.equal(saved.unitId, 'unit-a');
  assert.equal(saved.kind, 'DRAFT');
  assert.throws(() => buildSavedMessage({ id: 'bad', unitId: 'unit-a', name: '', message: '', actorId: 'admin', kind: 'TEMPLATE' }), /Informe nome e mensagem/);
});

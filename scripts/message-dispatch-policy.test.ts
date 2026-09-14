import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeDispatchUnit, safeInterruptionReason, waitForCampaignReady } from '../message-dispatch-policy';

test('perfil de unidade não controla disparos de outra unidade', () => {
  const user = { uid: 'reception-a', role: 'RECEPTION', unitId: 'unit-a' };
  assert.deepEqual(authorizeDispatchUnit(user, 'unit-a'), { allowed: true, unitId: 'unit-a' });
  assert.equal(authorizeDispatchUnit(user, 'unit-b').allowed, false);
  assert.equal(authorizeDispatchUnit(user, 'ALL').allowed, false);
});

test('gerência informa explicitamente o escopo da operação', () => {
  const admin = { uid: 'admin', role: 'ADMIN' };
  assert.deepEqual(authorizeDispatchUnit(admin, 'unit-b'), { allowed: true, unitId: 'unit-b' });
  assert.equal(authorizeDispatchUnit(admin, '').allowed, false);
});

test('interrupção sempre possui motivo auditável e limitado', () => {
  assert.equal(safeInterruptionReason(''), 'Interrompida manualmente pelo operador.');
  assert.equal(safeInterruptionReason(' Correção da lista '), 'Correção da lista');
  assert.equal(safeInterruptionReason('x'.repeat(500)).length, 300);
});


test('fila pausada só libera o próximo envio depois de retomar', async () => {
  const state = { isSending: true, campaignStatus: 'paused' };
  let release!: () => void;
  let ready = false;
  const pending = waitForCampaignReady(state, () => new Promise<void>(resolve => { release = resolve; })).then(result => { ready = result; });
  await Promise.resolve();
  assert.equal(ready, false);
  state.campaignStatus = 'running';
  release();
  await pending;
  assert.equal(ready, true);
});

test('cancelar durante a pausa impede o próximo envio', async () => {
  const state = { isSending: true, campaignStatus: 'paused' };
  const ready = await waitForCampaignReady(state, async () => { state.isSending = false; });
  assert.equal(ready, false);
});

test('campanha ativa libera envio e campanha encerrada bloqueia', async () => {
  assert.equal(await waitForCampaignReady({ isSending: true, campaignStatus: 'running' }), true);
  assert.equal(await waitForCampaignReady({ isSending: false, campaignStatus: 'stopped' }), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeDispatchUnit, safeInterruptionReason } from '../message-dispatch-policy';

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


import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialAuditEvent } from '../src/services/financialAudit';

test('evento financeiro preserva autoria, escopo e snapshots independentes', () => {
  const before = { amount: 100, optional: undefined };
  const event = createFinancialAuditEvent({
    actorAuthUid: 'uid-admin', actorId: 'uid-admin', actorName: 'Admin', actorRole: 'ADMIN',
    unitId: 'unit-a', occurredOn: '2026-09-11', action: 'UPDATED', entityType: 'TRANSACTION',
    entityId: 'transaction-1', previousValue: before, newValue: { amount: 120 },
  });
  before.amount = 999;
  assert.equal((event.previousValue as { amount: number }).amount, 100);
  assert.equal((event.previousValue as Record<string, unknown>).optional, undefined);
  assert.equal(event.actorAuthUid, 'uid-admin');
  assert.equal(event.unitId, 'unit-a');
  assert.match(event.id, /^financial_audit_/);
});


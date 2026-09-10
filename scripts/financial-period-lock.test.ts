import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFinancialPeriodOpen, findActiveClosing, isAuthorizedToReopen, validateReopening } from '../src/services/financialPeriodLock';
import type { CashClosing } from '../src/types';

const closing = (status: CashClosing['status'], date = '2026-09-10'): CashClosing => ({ id: `cash_closing_matriz_${date}`, unitId: 'matriz', date, openingBalance: 0, cashIncome: 100, cashOutflow: 20, expectedBalance: 80, countedBalance: 80, difference: 0, status, notes: 'snapshot persistido', closedAt: '2026-09-10T20:00:00.000Z', closedBy: 'admin' });

test('fechado e divergente bloqueiam dia e mês; reaberto libera', () => {
  assert.throws(() => assertFinancialPeriodOpen('matriz', '2026-09-10', [closing('CLOSED')]), /período financeiro está fechado/i);
  assert.throws(() => assertFinancialPeriodOpen('matriz', '2026-09', [closing('DIVERGENT')]), /período financeiro está fechado/i);
  assert.doesNotThrow(() => assertFinancialPeriodOpen('matriz', '2026-09-10', [closing('REOPENED')]));
});

test('isolamento mantém outra unidade e outro período abertos', () => {
  const closings = [closing('CLOSED')];
  assert.equal(findActiveClosing('filial', '2026-09-10', closings), undefined);
  assert.doesNotThrow(() => assertFinancialPeriodOpen('matriz', '2026-09-11', closings));
});

test('somente gerente e financeiro podem reabrir', () => {
  assert.equal(isAuthorizedToReopen('ADMIN'), true);
  assert.equal(isAuthorizedToReopen('FINANCIAL'), true);
  assert.equal(isAuthorizedToReopen('RECEPTION'), false);
  assert.throws(() => validateReopening('RECEPTION', 'Correção necessária'), /não possui permissão/i);
});

test('reabertura exige justificativa relevante', () => {
  assert.throws(() => validateReopening('ADMIN', 'erro'), /pelo menos 10 caracteres/i);
  assert.doesNotThrow(() => validateReopening('ADMIN', 'Correção do saldo contado'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialTransaction } from '../src/types';
import { buildCashFlowStatement, dfcGroupFor } from '../src/services/cashFlowStatement';

const transaction = (id: string, overrides: Partial<FinancialTransaction>): FinancialTransaction => ({ id, type: 'INCOME', category: 'Conta principal', description: id, amount: 100, date: '2026-09-10', unitId: 'matriz', status: 'RECEBIDO', movementNature: 'REVENUE', ...overrides });

test('classifica categorias existentes nos grupos profissionais da DFC', () => {
  assert.equal(dfcGroupFor(transaction('operacional', { classification: 'Venda de serviços' })), 'OPERATING');
  assert.equal(dfcGroupFor(transaction('investimento', { type: 'EXPENSE', status: 'PAGO', classification: 'Compra de equipamentos', movementNature: 'EXPENSE' })), 'INVESTING');
  assert.equal(dfcGroupFor(transaction('financiamento', { classification: 'Aporte dos sócios' })), 'FINANCING');
  assert.equal(dfcGroupFor(transaction('transferencia', { movementNature: 'INTERNAL_TRANSFER' })), null);
  assert.equal(dfcGroupFor(transaction('cortesia', { type: 'EXPENSE', status: 'PAGO', movementNature: 'NON_FINANCIAL' })), null);
});

test('considera somente caixa realizado, unidade e período selecionados', () => {
  const statement = buildCashFlowStatement([
    transaction('saldo anterior', { date: '2026-08-31', amount: 500 }),
    transaction('receita', { amount: 1_000, classification: 'Serviços', subclassification: 'Cortes' }),
    transaction('despesa', { type: 'EXPENSE', status: 'PAGO', amount: 300, classification: 'Fornecedores', movementNature: 'EXPENSE' }),
    transaction('pendente', { status: 'PENDENTE', amount: 900 }),
    transaction('outra unidade', { unitId: 'filial', amount: 2_000 }),
  ], { period: '2026-09', unitId: 'matriz' });
  assert.equal(statement.openingBalance, 500);
  assert.equal(statement.periodInflow, 1_000);
  assert.equal(statement.periodOutflow, 300);
  assert.equal(statement.netChange, 700);
  assert.equal(statement.closingBalance, 1_200);
  assert.equal(statement.transactionCount, 2);
});

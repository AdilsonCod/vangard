import assert from 'node:assert/strict';
import test from 'node:test';
import { inferFinancialSourceChannel, formatFinancialTransactionDate } from '../src/services/financialPresentation';
import { countObjectiveBatches, filterAuditItems, filterObjectiveBatches, filterReconciliationBatches } from '../src/services/reconciliationFilters';
import type { BatchConciliationItem, ConciliationItem } from '../src/types/reconciliation';
import type { FinancialTransaction } from '../src/types';

const transaction = (description: string, sourceChannel?: FinancialTransaction['sourceChannel']) => ({
  category: '', description, classification: '', sourceChannel,
} as FinancialTransaction);

const batch = (modalidade: string, status: string) => ({ modalidade, status } as BatchConciliationItem);
const item = (status: string) => ({ status } as ConciliationItem);

test('infere o canal financeiro sem sobrescrever o canal informado', () => {
  assert.equal(inferFinancialSourceChannel(transaction('Venda no gateway')), 'SUBSCRIPTION_GATEWAY');
  assert.equal(inferFinancialSourceChannel(transaction('Recebimento pix')), 'DIRECT_PIX');
  assert.equal(inferFinancialSourceChannel(transaction('Descrição livre', 'BANK')), 'BANK');
});

test('formata datas financeiras ISO e preserva valores inválidos', () => {
  assert.equal(formatFinancialTransactionDate('2026-09-11'), '11/09/2026');
  assert.equal(formatFinancialTransactionDate('sem data'), 'sem data');
  assert.equal(formatFinancialTransactionDate(), 'Não informado');
});

test('filtra lotes por modalidade e estado sem depender da interface', () => {
  const batches = [
    batch('Crédito', 'CONCILIADO'),
    batch('Débito', 'DIVERGENTE'),
    batch('Dinheiro', 'CAIXA_FISICO'),
  ];
  assert.equal(filterReconciliationBatches(batches, 'CREDITO', 'TODOS').length, 1);
  assert.equal(filterReconciliationBatches(batches, 'TODAS', 'DIVERGENTES').length, 1);
  assert.equal(filterReconciliationBatches(batches, 'TODAS', 'NAO_INTERMEDIADOS').length, 1);
  assert.equal(filterObjectiveBatches(batches, 'TODAS', 'PENDENTES').length, 1);
  assert.deepEqual(countObjectiveBatches(batches), { all: 3, reconciled: 1, divergent: 1, pending: 1 });
});

test('auditoria exclui conciliados no filtro geral e aceita um estado específico', () => {
  const items = [item('CONCILIADO'), item('DIVERGENTE'), item('PENDENTE')];
  assert.equal(filterAuditItems(items, 'TODAS').length, 2);
  assert.equal(filterAuditItems(items, 'DIVERGENTE').length, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { financialTransactionBatchId, financialTransactionInstallmentCount } from '../src/services/financialTransactionBatch';

test('a mesma tentativa de lote reutiliza exatamente os mesmos IDs', () => {
  const first = [0, 1, 2].map(index => financialTransactionBatchId('operacao-123', index, 0));
  const retry = [0, 1, 2].map(index => financialTransactionBatchId('operacao-123', index, 0));
  assert.deepEqual(retry, first);
  assert.equal(new Set(first).size, 3);
});

test('edição preserva o documento original e nunca cria parcelas novas', () => {
  assert.equal(financialTransactionInstallmentCount({ recurrence: 'MONTHLY', installments: 12 }, 'trans-original'), 1);
  assert.equal(financialTransactionBatchId('outra-operacao', 0, 0, 'trans-original'), 'trans-original');
  assert.equal(financialTransactionInstallmentCount({ recurrence: 'MONTHLY', installments: 3 }), 3);
});

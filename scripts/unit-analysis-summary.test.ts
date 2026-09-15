import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateUnitRevenueSummary } from '../src/utils/unitRevenueSummary';

test('não cria faturamento artificial quando o mês ainda não possui consolidado', () => {
  const summary = calculateUnitRevenueSummary({
    faturamentoTotal: 0,
    valorCortesias: 25,
    valorVendasInternas: 95,
  });

  assert.equal(summary.faturamentoTotal, 0);
});

test('preserva o total oficial de registros antigos sem base de faturamento', () => {
  const summary = calculateUnitRevenueSummary({
    faturamentoTotal: 1_000,
    valorCortesias: 50,
    valorVendasInternas: 25,
  });

  assert.equal(summary.baseFaturamento, 1_025);
  assert.equal(summary.faturamentoTotal, 1_000);
});

test('recalcula o total quando a base de faturamento está registrada', () => {
  const summary = calculateUnitRevenueSummary({
    baseFaturamento: 1_000,
    faturamentoTotal: 0,
    valorCortesias: 50,
    valorVendasInternas: 25,
  });

  assert.equal(summary.faturamentoTotal, 975);
});

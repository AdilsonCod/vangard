import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCommercialDiscount, calculateCommissionByRevenue, calculateFee, calculatePaymentTotals, calculateReversalEffect, calculateTotalRevenue, replaceImportedRevenue, summarizeCashMovements } from '../src/services/financialEngine';
import type { CommissionBracket, FinancialTransaction } from '../src/types';

let sequence = 0;
const transaction = (partial: Partial<FinancialTransaction>): FinancialTransaction => ({ id: `t-${sequence += 1}`, type: 'INCOME', category: 'Teste', description: 'Teste', amount: 0, date: '2026-09-10', unitId: 'matriz', status: 'RECEBIDO', ...partial });

test('faturamento total soma avulso, assinaturas e produtos e trata zero', () => { assert.equal(calculateTotalRevenue(100, 50.155, 25.155), 175.32); assert.equal(calculateTotalRevenue(undefined, null, 0), 0); });
test('substituição de importação troca o componente sem acumular', () => { const first = replaceImportedRevenue({ standaloneRevenue: 100, subscriptionRevenue: 20, productRevenue: 10 }, 'productRevenue', 40); assert.equal(first.totalRevenue, 160); const second = replaceImportedRevenue(first.components, 'standaloneRevenue', 80); assert.deepEqual(second, { components: { standaloneRevenue: 80, subscriptionRevenue: 20, productRevenue: 40 }, totalRevenue: 140 }); });
test('desconto reduz receita sem ficar negativo e taxa retorna líquido', () => { assert.equal(applyCommercialDiscount(100, 25), 75); assert.equal(applyCommercialDiscount(20, 30), 0); assert.deepEqual(calculateFee(1000, 2.39), { gross: 1000, percentage: 2.39, fee: 23.9, net: 976.1 }); });
test('comissão respeita os limites inclusivos da faixa', () => { const brackets: CommissionBracket[] = [{ id: 'a', unitId: 'matriz', minimumRevenue: 0, maximumRevenue: 999.99, percentage: 30 }, { id: 'b', unitId: 'matriz', minimumRevenue: 1000, maximumRevenue: 2000, percentage: 40 }]; assert.equal(calculateCommissionByRevenue(999.99, brackets).commission, 300); assert.equal(calculateCommissionByRevenue(1000, brackets).commission, 400); assert.equal(calculateCommissionByRevenue(2000.01, brackets).commission, 0); });
test('pagamento soma comissões e aplica descontos uma única vez', () => { assert.deepEqual(calculatePaymentTotals({ commissionAvulso: 100, commissionProductGeneral: 20, commissionProductAvant: 10, commissionSubscriptions: 30, discount: 999, discounts: [{ description: 'Vale', value: 15 }] }), { grossCommission: 160, discounts: 15, netPayment: 145 }); });
test('venda interna vinculada como desconto deduz o valor líquido a pagar do profissional', () => {
  const internalSaleDiscount = { description: 'Venda interna: Pomada Matte', value: 45, internalSaleId: 'sale-123' };
  const paymentTotals = calculatePaymentTotals({ commissionAvulso: 500, commissionProductGeneral: 50, commissionProductAvant: 0, commissionSubscriptions: 0, discount: 0, discounts: [internalSaleDiscount] });
  assert.equal(paymentTotals.grossCommission, 550);
  assert.equal(paymentTotals.discounts, 45);
  assert.equal(paymentTotals.netPayment, 505);
});
test('caixa separa receita, despesa, repasse, transferência e itens não financeiros', () => { const summary = summarizeCashMovements([transaction({ amount: 100, movementNature: 'REVENUE' }), transaction({ type: 'EXPENSE', status: 'PAGO', amount: 30, movementNature: 'EXPENSE' }), transaction({ amount: 20, movementNature: 'PASS_THROUGH' }), transaction({ type: 'EXPENSE', status: 'PAGO', amount: 12, movementNature: 'PASS_THROUGH' }), transaction({ amount: 50, movementNature: 'INTERNAL_TRANSFER' }), transaction({ type: 'EXPENSE', status: 'PAGO', amount: 50, movementNature: 'INTERNAL_TRANSFER' }), transaction({ type: 'EXPENSE', status: 'PAGO', amount: 10, movementNature: 'COMMERCIAL_DISCOUNT' }), transaction({ amount: 999, status: 'PENDENTE', movementNature: 'REVENUE' })]); assert.deepEqual(summary, { cashIn: 170, cashOut: 92, cashBalance: 78, recognizedRevenue: 100, recognizedExpenses: 30, commercialDiscounts: 10, passThroughReceived: 20, passThroughPaid: 12, passThroughBalance: 8, internalTransferNet: 0 }); });
test('estorno gera apenas o efeito inverso ainda não revertido', () => { assert.equal(calculateReversalEffect(100), -100); assert.equal(calculateReversalEffect(100, 40), -60); assert.equal(calculateReversalEffect(0), 0); });

test('cenário completo mantém os mesmos totais para visão geral, financeiro, relatório, análise, conciliação e pagamentos', () => {
  const revenue = calculateTotalRevenue(8000, 1500, 500);
  const reportRevenue = applyCommercialDiscount(revenue, 200);
  const cash = summarizeCashMovements([
    transaction({ amount: 9800, movementNature: 'REVENUE' }),
    transaction({ type: 'EXPENSE', status: 'PAGO', amount: 1200, movementNature: 'EXPENSE' }),
    transaction({ amount: 300, movementNature: 'PASS_THROUGH' }),
    transaction({ type: 'EXPENSE', status: 'PAGO', amount: 300, movementNature: 'PASS_THROUGH' }),
    transaction({ type: 'EXPENSE', status: 'PAGO', amount: 200, movementNature: 'COMMERCIAL_DISCOUNT' }),
  ]);
  const payment = calculatePaymentTotals({ commissionAvulso: 3000, commissionProductGeneral: 100, commissionProductAvant: 0, commissionSubscriptions: 500, discount: 100, discounts: [] });
  const moduleResults = {
    visaoGeral: { receita: cash.recognizedRevenue - cash.commercialDiscounts, despesa: cash.recognizedExpenses },
    financeiro: { receita: cash.recognizedRevenue - cash.commercialDiscounts, despesa: cash.recognizedExpenses },
    relatorio: reportRevenue,
    analise: revenue - 200,
    conciliacao: calculateFee(10000, 2).net,
    pagamentos: payment.netPayment,
  };
  assert.deepEqual(moduleResults.visaoGeral, moduleResults.financeiro);
  assert.equal(moduleResults.relatorio, moduleResults.analise);
  assert.equal(moduleResults.relatorio, 9800);
  assert.equal(moduleResults.conciliacao, 9800);
  assert.equal(moduleResults.pagamentos, 3500);
});

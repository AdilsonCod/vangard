import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialTransaction, SubscriptionPlan, User } from '../src/types';
import { filterSubscriptionSources, plansAvailableToUser, receivableMatchesPlans } from '../src/services/subscriptionPlans';

const plans: SubscriptionPlan[] = [
  { id: 'basic-a', unitId: 'unit-a', name: 'Plano Basic', isActive: true, createdAt: '2026-09-16' },
  { id: 'vip-a', unitId: 'unit-a', name: 'Plano VIP', isActive: true, createdAt: '2026-09-16' },
  { id: 'vip-b', unitId: 'unit-b', name: 'Plano VIP B', isActive: true, createdAt: '2026-09-16' },
];
const manager = { id: 'admin', role: 'ADMIN', unit: 'ALL' } as User;
const receptionA = { id: 'reception-a', role: 'RECEPTION', unit: 'unit-a' } as User;

test('filtro processa somente o plano selecionado', () => {
  const result = filterSubscriptionSources(
    [
      { id: '1', codigo: '1', nomeCliente: 'A', plano: 'Plano Basic', vencimento: '', valor: 100, status: 'PAGO', dataStatusAtual: '2026-09-01', codigoAprovacao: '', tid: '', descricaoStatus: '' },
      { id: '2', codigo: '2', nomeCliente: 'B', plano: 'Plano VIP', vencimento: '', valor: 200, status: 'PAGO', dataStatusAtual: '2026-09-01', codigoAprovacao: '', tid: '', descricaoStatus: '' },
    ],
    [
      { id: 'p1', aReceber: '', dataVenda: '2026-09-01', parcela: '', transacao: '1', tid: '', operacao: 'Crédito', bandeira: '', valorBruto: 100, mdrTaxaPerc: 2, mdrValor: 2, antecipacao: 0, valorLiquido: 98, statusTransacao: '', dMais31: '' },
      { id: 'p2', aReceber: '', dataVenda: '2026-09-01', parcela: '', transacao: '2', tid: '', operacao: 'Crédito', bandeira: '', valorBruto: 200, mdrTaxaPerc: 2, mdrValor: 4, antecipacao: 0, valorLiquido: 196, statusTransacao: '', dMais31: '' },
    ], plans.filter(plan => plan.unitId === 'unit-a'), new Set(['vip-a']),
  );
  assert.deepEqual(result.clube.map(item => item.id), ['2']);
  assert.deepEqual(result.previsao.map(item => item.id), ['p2']);
});

test('plano cadastrado mantém vínculo obrigatório com sua unidade', () => {
  const newPlan: SubscriptionPlan = { id: 'new', unitId: 'unit-a', name: 'Plano Família', isActive: true, createdAt: new Date().toISOString() };
  assert.equal(newPlan.unitId, 'unit-a');
  assert.equal(plansAvailableToUser([...plans, newPlan], receptionA, 'unit-a').some(plan => plan.id === 'new'), true);
});

test('isolamento bloqueia planos de outra unidade e gerente pode selecionar a unidade explicitamente', () => {
  assert.deepEqual(plansAvailableToUser(plans, receptionA, 'unit-b'), []);
  assert.deepEqual(plansAvailableToUser(plans, receptionA, 'unit-a').map(plan => plan.id), ['basic-a', 'vip-a']);
  assert.deepEqual(plansAvailableToUser(plans, manager, 'unit-b').map(plan => plan.id), ['vip-b']);
});

test('recebível de assinatura é filtrado pelo plano selecionado', () => {
  const transaction = { id: 'tx', type: 'INCOME', category: 'Assinaturas', description: 'Mensalidade Plano VIP', amount: 200, date: '2026-09-01', unitId: 'unit-a', status: 'PENDENTE', paymentMethod: 'SUBSCRIPTION' } as FinancialTransaction;
  assert.equal(receivableMatchesPlans(transaction, plans, new Set(['vip-a'])), true);
  assert.equal(receivableMatchesPlans(transaction, plans, new Set(['basic-a'])), false);
});

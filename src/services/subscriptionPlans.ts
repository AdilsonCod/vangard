import type { ConciliationItem, GatewayClubeTransacao, PrevisaoRecebivel } from '../types/reconciliation';
import type { FinancialTransaction, SubscriptionPlan, User } from '../types';
import { authorizedUnitIds, canUseGlobalScope } from './firestoreScope';

const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function plansAvailableToUser(plans: SubscriptionPlan[], user: User | null, unitId: string) {
  if (!user || !unitId || unitId === 'ALL') return [];
  if (!canUseGlobalScope(user) && !authorizedUnitIds(user).includes(unitId)) return [];
  return plans.filter(plan => plan.unitId === unitId && plan.isActive !== false);
}

export function textMatchesPlan(text: unknown, plan: SubscriptionPlan) {
  const source = normalize(text);
  const name = normalize(plan.name);
  return Boolean(source && name && (source === name || source.includes(name)));
}

export function filterSubscriptionSources(
  clube: GatewayClubeTransacao[],
  previsao: PrevisaoRecebivel[],
  plans: SubscriptionPlan[],
  selectedIds: Set<string>,
) {
  const selected = plans.filter(plan => selectedIds.has(plan.id));
  const filteredClube = clube.filter(item => selected.some(plan => textMatchesPlan(item.plano, plan)));
  const selectedReferences = new Set(filteredClube.flatMap(item => [item.codigo, item.tid].map(normalize).filter(Boolean)));
  return {
    clube: filteredClube,
    previsao: previsao.filter(item => selectedReferences.has(normalize(item.transacao)) || selectedReferences.has(normalize(item.tid))),
  };
}

export function conciliationItemMatchesPlans(item: ConciliationItem, plans: SubscriptionPlan[], selectedIds: Set<string>) {
  const selected = plans.filter(plan => selectedIds.has(plan.id));
  return selected.some(plan => textMatchesPlan(item.modalidadeOuPlano, plan));
}

export function receivableMatchesPlans(transaction: FinancialTransaction, plans: SubscriptionPlan[], selectedIds: Set<string>) {
  if (transaction.subscriptionPlanId && selectedIds.has(transaction.subscriptionPlanId)) return true;
  const selected = plans.filter(plan => selectedIds.has(plan.id));
  const searchable = `${transaction.itemName || ''} ${transaction.category || ''} ${transaction.description || ''}`;
  return selected.some(plan => textMatchesPlan(searchable, plan));
}

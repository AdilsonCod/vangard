import type { ConciliationItem, GatewayClubeTransacao, PrevisaoRecebivel } from '../types/reconciliation';
import type { FinancialTransaction, SubscriptionPlan, User } from '../types';
import { authorizedUnitIds, canUseGlobalScope } from './firestoreScope';

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, 'e')
  .replace(/[^a-z0-9]/g, '');

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

export function matchSubscriptionPlan(text: unknown, plans: SubscriptionPlan[]) {
  const source = normalize(text);
  if (!source) return undefined;
  const candidates = plans
    .map(plan => ({ plan, normalizedName: normalize(plan.name) }))
    .filter(candidate => candidate.normalizedName && source.includes(candidate.normalizedName));
  const exact = candidates.find(candidate => candidate.normalizedName === source);
  if (exact) return exact.plan;
  return candidates.sort((a, b) => b.normalizedName.length - a.normalizedName.length)[0]?.plan;
}

export function filterSubscriptionSources(
  clube: GatewayClubeTransacao[],
  previsao: PrevisaoRecebivel[],
  plans: SubscriptionPlan[],
  selectedIds: Set<string>,
) {
  const filteredClube = clube.filter(item => {
    const matchedPlan = matchSubscriptionPlan(item.plano, plans);
    return Boolean(matchedPlan && selectedIds.has(matchedPlan.id));
  });
  const selectedReferences = new Set(filteredClube.flatMap(item => [item.codigo, item.tid].map(normalize).filter(Boolean)));
  return {
    clube: filteredClube,
    previsao: previsao.filter(item => selectedReferences.has(normalize(item.transacao)) || selectedReferences.has(normalize(item.tid))),
  };
}

export function conciliationItemMatchesPlans(item: ConciliationItem, plans: SubscriptionPlan[], selectedIds: Set<string>) {
  const matchedPlan = matchSubscriptionPlan(item.modalidadeOuPlano, plans);
  return Boolean(matchedPlan && selectedIds.has(matchedPlan.id));
}

export function receivableMatchesPlans(transaction: FinancialTransaction, plans: SubscriptionPlan[], selectedIds: Set<string>) {
  if (transaction.subscriptionPlanId && selectedIds.has(transaction.subscriptionPlanId)) return true;
  const searchable = `${transaction.itemName || ''} ${transaction.category || ''} ${transaction.description || ''}`;
  const matchedPlan = matchSubscriptionPlan(searchable, plans);
  return Boolean(matchedPlan && selectedIds.has(matchedPlan.id));
}

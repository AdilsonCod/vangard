import type { ConciliationItem } from '../types/reconciliation';

const DIRECTLY_SETTLEABLE_STATUSES = new Set([
  'CONCILIADO_REDE',
  'CONCILIADO_PIX_BANCO'
]);

/**
 * Define quais resultados representam dinheiro efetivamente recebido e podem
 * ser lançados no Caixa. Previsões D+31 conciliadas são deliberadamente
 * excluídas até que exista uma liquidação efetiva.
 */
export function isSettlementEligible(item: ConciliationItem): boolean {
  if (!Number.isFinite(item.valorLiquido) || item.valorLiquido === 0) return false;

  if (DIRECTLY_SETTLEABLE_STATUSES.has(item.status)) return true;

  return item.status === 'CONCILIADO' && item.regra === 'REGRA_2_PDV_REDE';
}

export function buildSettlementTransactionId(unitId: string, itemId: string): string {
  const safeUnit = (unitId || 'ALL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeItem = itemId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `reconciliation_${safeUnit}_${safeItem}`;
}

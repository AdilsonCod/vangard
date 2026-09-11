import { BatchConciliationItem, ConciliationItem, StatusDivergencia } from '../types/reconciliation';

export type ReconciliationBatchStatusFilter = 'TODOS' | 'CONCILIADOS' | 'DIVERGENTES' | 'NAO_INTERMEDIADOS';
export type ReconciliationObjectiveStatus = 'TODOS' | 'CONCILIADOS' | 'DIVERGENCIAS' | 'PENDENTES';
export type ReconciliationAuditStatus = 'TODAS' | StatusDivergencia;

const divergentStatuses = new Set(['DIVERGENTE', 'NAO_ENCONTRADO_ADQUIRENTE', 'NAO_ENCONTRADO_PDV']);
const nonIntermediatedStatuses = new Set(['PIX_CONTA_BANCARIA', 'CAIXA_FISICO', 'ASSINATURA_CLUBE', 'SALDO_NAO_INTERMEDIADO']);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function matchesBatchModality(batch: BatchConciliationItem, modality: string): boolean {
  if (modality === 'TODAS') return true;
  const normalizedBatch = normalize(batch.modalidade);
  const normalizedFilter = normalize(modality);
  if (normalizedFilter === 'OUTROS') return !['CREDITO', 'DEBITO', 'PIX', 'DINHEIRO', 'ASSINATURA'].includes(normalizedBatch);
  return normalizedBatch === normalizedFilter;
}

export function filterReconciliationBatches(
  batches: BatchConciliationItem[],
  modality: string,
  status: ReconciliationBatchStatusFilter,
): BatchConciliationItem[] {
  return batches.filter(batch => {
    if (!matchesBatchModality(batch, modality)) return false;
    if (status === 'CONCILIADOS') return batch.status === 'CONCILIADO';
    if (status === 'DIVERGENTES') return divergentStatuses.has(batch.status);
    if (status === 'NAO_INTERMEDIADOS') return nonIntermediatedStatuses.has(batch.status);
    return true;
  });
}

export function filterObjectiveBatches(
  batches: BatchConciliationItem[],
  modality: string,
  status: ReconciliationObjectiveStatus,
): BatchConciliationItem[] {
  return batches.filter(batch => {
    if (!matchesBatchModality(batch, modality)) return false;
    const divergent = divergentStatuses.has(batch.status);
    const reconciled = batch.status === 'CONCILIADO';
    if (status === 'CONCILIADOS') return reconciled;
    if (status === 'DIVERGENCIAS') return divergent;
    if (status === 'PENDENTES') return !reconciled && !divergent;
    return true;
  });
}

export function filterAuditItems(items: ConciliationItem[], status: ReconciliationAuditStatus): ConciliationItem[] {
  return items.filter(item => status === 'TODAS' ? item.status !== 'CONCILIADO' : item.status === status);
}

export function countObjectiveBatches(batches: BatchConciliationItem[]) {
  return {
    all: batches.length,
    reconciled: batches.filter(batch => batch.status === 'CONCILIADO').length,
    divergent: batches.filter(batch => divergentStatuses.has(batch.status)).length,
    pending: batches.filter(batch => batch.status !== 'CONCILIADO' && !divergentStatuses.has(batch.status)).length,
  };
}

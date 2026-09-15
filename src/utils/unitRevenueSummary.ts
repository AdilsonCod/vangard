export interface UnitRevenueSummaryInput {
  baseFaturamento?: number;
  faturamentoTotal?: number;
  valorCortesias: number;
  valorVendasInternas: number;
}

export function calculateUnitRevenueSummary({
  baseFaturamento,
  faturamentoTotal,
  valorCortesias,
  valorVendasInternas,
}: UnitRevenueSummaryInput) {
  const persistedTotal = Number(faturamentoTotal) || 0;
  const effectiveBase = typeof baseFaturamento === 'number'
    ? baseFaturamento
    : persistedTotal + valorCortesias - valorVendasInternas;

  return {
    baseFaturamento: effectiveBase,
    faturamentoTotal: typeof baseFaturamento === 'number'
      ? Math.max(0, effectiveBase - valorCortesias + valorVendasInternas)
      : Math.max(0, persistedTotal),
  };
}

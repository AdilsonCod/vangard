export type FinancialAmountInput = number | string | null | undefined;

const DECIMAL_AMOUNT_PATTERN = /^\d*(?:[.,]\d{0,2})?$/;

export function isValidFinancialAmountInput(value: string): boolean {
  return DECIMAL_AMOUNT_PATTERN.test(value);
}

export function parseFinancialAmount(value: FinancialAmountInput): number {
  const normalized = String(value ?? '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

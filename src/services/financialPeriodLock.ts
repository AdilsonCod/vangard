import type { CashClosing, Role } from '../types';

export const FINANCIAL_PERIOD_CLOSED_MESSAGE = 'Este período financeiro está fechado. Reabra o período antes de realizar alterações.';

export function isAuthorizedToReopen(role: Role | string | null | undefined) {
  return role === 'ADMIN' || role === 'FINANCIAL';
}

export function isClosingActive(closing: CashClosing) {
  return closing.status === 'CLOSED' || closing.status === 'DIVERGENT';
}

export function findActiveClosing(unitId: string, dateOrMonth: string, closings: CashClosing[]) {
  return closings.find(closing => closing.unitId === unitId && isClosingActive(closing) && (
    dateOrMonth.length === 7 ? closing.date.startsWith(dateOrMonth) : closing.date === dateOrMonth
  ));
}

export function assertFinancialPeriodOpen(unitId: string, dateOrMonth: string, closings: CashClosing[]) {
  if (!unitId || unitId === 'ALL' || !dateOrMonth) return;
  if (findActiveClosing(unitId, dateOrMonth.slice(0, 10), closings)) throw new Error(FINANCIAL_PERIOD_CLOSED_MESSAGE);
}

export function validateReopening(role: Role | string | null | undefined, reason: string) {
  if (!isAuthorizedToReopen(role)) throw new Error('Seu perfil não possui permissão para reabrir períodos financeiros.');
  if (reason.trim().length < 10) throw new Error('Informe uma justificativa com pelo menos 10 caracteres para reabrir o período.');
}

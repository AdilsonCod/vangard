import type { FinancialAuditEvent, Role } from '../types';

type AuditInput = Omit<FinancialAuditEvent, 'id' | 'createdAt'> & { actorRole: Role };

const snapshot = (value: unknown) => value === undefined
  ? undefined
  : JSON.parse(JSON.stringify(value)) as unknown;

export const createFinancialAuditEvent = (input: AuditInput): FinancialAuditEvent => ({
  ...input,
  id: `financial_audit_${Date.now()}_${crypto.randomUUID()}`,
  createdAt: new Date().toISOString(),
  previousValue: snapshot(input.previousValue),
  newValue: snapshot(input.newValue),
  metadata: snapshot(input.metadata) as Record<string, unknown> | undefined,
});

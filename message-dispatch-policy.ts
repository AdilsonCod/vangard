import type { VerifiedFirebaseUser } from './server-auth';

export type DispatchUnitDecision = { allowed: true; unitId: string } | { allowed: false; status: 400 | 403; error: string };

export function authorizeDispatchUnit(user: VerifiedFirebaseUser | undefined, requestedUnit: unknown): DispatchUnitDecision {
  if (!user) return { allowed: false, status: 403, error: 'Usuário autenticado não identificado.' };
  const requested = typeof requestedUnit === 'string' ? requestedUnit.trim() : '';
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN') return requested ? { allowed: true, unitId: requested } : { allowed: false, status: 400, error: 'Informe a unidade da operação.' };
  if (!user.unitId) return { allowed: false, status: 403, error: 'Seu perfil não possui uma unidade vinculada.' };
  if (requested && requested !== user.unitId) return { allowed: false, status: 403, error: 'Você não possui permissão para operar esta unidade.' };
  return { allowed: true, unitId: user.unitId };
}

export const safeInterruptionReason = (value: unknown) => {
  const reason = typeof value === 'string' ? value.trim().slice(0, 300) : '';
  return reason || 'Interrompida manualmente pelo operador.';
};


import { collection, documentId, query, where, type QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';

export function authorizedUnitIds(user: User | null): string[] {
  if (!user) return [];
  const configured = (user as User & { unitIds?: unknown }).unitIds;
  const values = Array.isArray(configured) ? configured.filter((value): value is string => typeof value === 'string' && value !== 'ALL') : [];
  if (user.unit && user.unit !== 'ALL') values.push(user.unit);
  return [...new Set(values)];
}

export function canUseGlobalScope(user: User | null) {
  return user?.role === 'ADMIN';
}

export function scopedCollectionQuery(
  collectionName: string,
  user: User | null,
  options: { includeGlobal?: boolean; constraints?: QueryConstraint[] } = {},
) {
  const base = collection(db, collectionName);
  const extra = options.constraints || [];
  if (canUseGlobalScope(user)) return query(base, ...extra);

  const units = authorizedUnitIds(user);
  if (!units.length) return query(base, where(documentId(), '==', '__escopo_sem_unidade__'), ...extra);
  const permitted = options.includeGlobal ? [...units, 'ALL'] : units;
  const unitConstraint = permitted.length === 1
    ? where('unitId', '==', permitted[0])
    : where('unitId', 'in', permitted.slice(0, 10));
  return query(base, unitConstraint, ...extra);
}

export function defaultUnitFor(user: User | null) {
  return canUseGlobalScope(user) ? 'ALL' : authorizedUnitIds(user)[0] || '';
}

export function assertAuthorizedUnit(user: User | null, unitId: string) {
  if (canUseGlobalScope(user)) return;
  if (!authorizedUnitIds(user).includes(unitId)) {
    throw new Error('A unidade informada não pertence ao seu escopo autorizado.');
  }
}

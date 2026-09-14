import type { CatalogItem, Role } from '../types';

export function isCatalogItemVisibleToRole(item: CatalogItem, role: Role, unit?: string | null): boolean {
  if (role === 'ADMIN') return true;
  const roleAllowed = Array.isArray(item.visibleToRoles) && item.visibleToRoles.includes(role);
  const unitAllowed = !item.unit || item.unit === 'ALL' || (!!unit && item.unit === unit);
  return roleAllowed && unitAllowed;
}

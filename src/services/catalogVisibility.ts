import type { CatalogItem, Role } from '../types';

export function isCatalogItemVisibleToRole(item: CatalogItem, role: Role): boolean {
  if (role === 'ADMIN') return true;
  return Array.isArray(item.visibleToRoles) && item.visibleToRoles.includes(role);
}

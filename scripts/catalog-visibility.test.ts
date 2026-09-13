import assert from 'node:assert/strict';
import test from 'node:test';
import { isCatalogItemVisibleToRole } from '../src/services/catalogVisibility';
import type { CatalogItem } from '../src/types';

const item = (visibleToRoles?: CatalogItem['visibleToRoles']): CatalogItem => ({ id:'item-1', name:'Item', type:'SERVICE', visibleToRoles });

test('item sem perfil selecionado é visível somente para administração', () => {
  assert.equal(isCatalogItemVisibleToRole(item(), 'ADMIN'), true);
  assert.equal(isCatalogItemVisibleToRole(item([]), 'ADMIN'), true);
  assert.equal(isCatalogItemVisibleToRole(item(), 'BARBER'), false);
  assert.equal(isCatalogItemVisibleToRole(item([]), 'MANICURE'), false);
});

test('item com perfis selecionados aparece apenas para os perfis marcados e administração', () => {
  const catalogItem = item(['BARBER']);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'BARBER'), true);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'MANICURE'), false);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'ADMIN'), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isCatalogItemVisibleToRole } from '../src/services/catalogVisibility';
import type { CatalogItem } from '../src/types';

const item = (visibleToRoles?: CatalogItem['visibleToRoles']): CatalogItem => ({ id:'item-1', name:'Item', type:'SERVICE', visibleToRoles });

test('item sem perfil selecionado é visível somente para administração', () => {
  assert.equal(isCatalogItemVisibleToRole(item(), 'ADMIN', 'unit-a'), true);
  assert.equal(isCatalogItemVisibleToRole(item([]), 'ADMIN', 'unit-a'), true);
  assert.equal(isCatalogItemVisibleToRole(item(), 'BARBER', 'unit-a'), false);
  assert.equal(isCatalogItemVisibleToRole(item([]), 'MANICURE', 'unit-a'), false);
});

test('item com perfis selecionados aparece apenas para os perfis marcados e administração', () => {
  const catalogItem = item(['BARBER']);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'BARBER', 'unit-a'), true);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'MANICURE', 'unit-a'), false);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'ADMIN', 'unit-b'), true);
});

test('item de uma unidade não aparece para perfis de outra unidade', () => {
  const catalogItem = { ...item(['BARBER']), unit:'unit-a' };
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'BARBER', 'unit-a'), true);
  assert.equal(isCatalogItemVisibleToRole(catalogItem, 'BARBER', 'unit-b'), false);
  assert.equal(isCatalogItemVisibleToRole({ ...catalogItem, unit:'ALL' }, 'BARBER', 'unit-b'), true);
});

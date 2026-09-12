import assert from 'node:assert/strict';
import test from 'node:test';
import { commitCatalogMutation, planCategoryMutation, planSubcategoryMutation } from '../src/services/catalogMutationPlan';

test('excluir categoria planeja remoção das filhas e desvinculação dos itens no mesmo lote', () => {
  const operations = planCategoryMutation(
    [{ id: 'cat-a', name: 'A', type: 'SERVICE' }, { id: 'cat-b', name: 'B', type: 'PRODUCT' }],
    [{ id: 'cat-b', name: 'B atualizada', type: 'PRODUCT' }],
    [{ id: 'sub-a', name: 'Filha', categoryId: 'cat-a' }],
    [{ id: 'item-a', name: 'Item', type: 'cat-a', subcategoryId: 'sub-a' }],
  );
  assert.ok(operations.some(item => item.action === 'delete' && item.collection === 'categories' && item.id === 'cat-a'));
  assert.ok(operations.some(item => item.action === 'delete' && item.collection === 'subcategories' && item.id === 'sub-a'));
  const catalogUpdate = operations.find(item => item.action === 'set' && item.collection === 'catalog' && item.id === 'item-a');
  assert.deepEqual(catalogUpdate && 'data' in catalogUpdate ? catalogUpdate.data : null, { id: 'item-a', name: 'Item', type: 'SERVICE', subcategoryId: '' });
});

test('excluir subcategoria preserva o item e limpa apenas sua referência', () => {
  const operations = planSubcategoryMutation(
    [{ id: 'sub-a', name: 'Filha', categoryId: 'cat-a' }],
    [],
    [{ id: 'item-a', name: 'Item', type: 'cat-a', subcategoryId: 'sub-a', price: 50 }],
  );
  assert.equal(operations.filter(item => item.action === 'delete').length, 1);
  const catalogUpdate = operations.find(item => item.action === 'set' && item.collection === 'catalog');
  assert.deepEqual(catalogUpdate && 'data' in catalogUpdate ? catalogUpdate.data : null, { id: 'item-a', name: 'Item', type: 'cat-a', subcategoryId: '', price: 50 });
});

test('salvamento gera uma única lista determinística de operações sem alterar as entradas', () => {
  const categories = [{ id: 'cat-a', name: 'A', type: 'SERVICE' as const }];
  const snapshot = structuredClone(categories);
  const operations = planCategoryMutation(categories, categories, [], []);
  assert.deepEqual(categories, snapshot);
  assert.deepEqual(operations, [{ action: 'set', collection: 'categories', id: 'cat-a', data: categories[0] }]);
});

test('falha no commit não aplica parcialmente as operações enfileiradas', async () => {
  const persisted = new Map<string, unknown>([['categories/cat-a', { name: 'Original' }]]);
  const staged: Array<() => void> = [];
  await assert.rejects(() => commitCatalogMutation(
    [{ action: 'set', collection: 'categories', id: 'cat-a', data: { id: 'cat-a', name: 'Alterada' } }],
    {
      delete: (collection, id) => staged.push(() => persisted.delete(`${collection}/${id}`)),
      set: (collection, id, data) => staged.push(() => persisted.set(`${collection}/${id}`, data)),
      commit: async () => { throw new Error('Falha simulada do Firestore'); },
    },
  ), /Falha simulada/);
  assert.deepEqual(persisted.get('categories/cat-a'), { name: 'Original' });
});

test('commit bem-sucedido publica o lote completo de uma só vez', async () => {
  const persisted = new Map<string, unknown>();
  const staged: Array<() => void> = [];
  await commitCatalogMutation(
    [
      { action: 'set', collection: 'categories', id: 'cat-a', data: { id: 'cat-a', name: 'A' } },
      { action: 'set', collection: 'subcategories', id: 'sub-a', data: { id: 'sub-a', name: 'Filha', categoryId: 'cat-a' } },
    ],
    {
      delete: (collection, id) => staged.push(() => persisted.delete(`${collection}/${id}`)),
      set: (collection, id, data) => staged.push(() => persisted.set(`${collection}/${id}`, data)),
      commit: async () => staged.forEach(apply => apply()),
    },
  );
  assert.equal(persisted.size, 2);
});

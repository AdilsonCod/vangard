import type { CatalogItem, Category, Subcategory } from '../types';

export type CatalogMutation =
  | { action: 'delete'; collection: 'categories' | 'subcategories'; id: string }
  | { action: 'set'; collection: 'categories'; id: string; data: Category }
  | { action: 'set'; collection: 'subcategories'; id: string; data: Subcategory }
  | { action: 'set'; collection: 'catalog'; id: string; data: CatalogItem };

export interface AtomicCatalogWriter {
  delete(collection: CatalogMutation['collection'], id: string): void;
  set(collection: CatalogMutation['collection'], id: string, data: Category | Subcategory | CatalogItem): void;
  commit(): Promise<void>;
}

export async function commitCatalogMutation(operations: CatalogMutation[], writer: AtomicCatalogWriter): Promise<void> {
  if (operations.length > 490) throw new Error('A operação excede o limite seguro de alterações simultâneas. Divida a atualização em partes menores.');
  operations.forEach(operation => {
    if (operation.action === 'delete') writer.delete(operation.collection, operation.id);
    else writer.set(operation.collection, operation.id, operation.data);
  });
  await writer.commit();
}

export function planCategoryMutation(currentCategories: Category[], nextCategories: Category[], subcategories: Subcategory[], catalog: CatalogItem[]): CatalogMutation[] {
  const valid = nextCategories.filter(item => item?.id);
  const nextIds = new Set(valid.map(item => item.id));
  const removedIds = new Set(currentCategories.filter(item => item?.id && !nextIds.has(item.id)).map(item => item.id));
  const operations: CatalogMutation[] = [];

  removedIds.forEach(id => operations.push({ action: 'delete', collection: 'categories', id }));
  subcategories.filter(item => removedIds.has(item.categoryId)).forEach(item => operations.push({ action: 'delete', collection: 'subcategories', id: item.id }));
  catalog.filter(item => removedIds.has(item.type)).forEach(item => operations.push({ action: 'set', collection: 'catalog', id: item.id, data: { ...item, type: 'SERVICE', subcategoryId: '' } }));
  valid.forEach(item => operations.push({ action: 'set', collection: 'categories', id: item.id, data: { id: item.id, name: item.name || '', ...(item.type ? { type: item.type } : {}) } }));
  return operations;
}

export function planSubcategoryMutation(currentSubcategories: Subcategory[], nextSubcategories: Subcategory[], catalog: CatalogItem[]): CatalogMutation[] {
  const valid = nextSubcategories.filter(item => item?.id);
  const nextIds = new Set(valid.map(item => item.id));
  const removedIds = new Set(currentSubcategories.filter(item => item?.id && !nextIds.has(item.id)).map(item => item.id));
  const operations: CatalogMutation[] = [];

  removedIds.forEach(id => operations.push({ action: 'delete', collection: 'subcategories', id }));
  catalog.filter(item => item.subcategoryId && removedIds.has(item.subcategoryId)).forEach(item => operations.push({ action: 'set', collection: 'catalog', id: item.id, data: { ...item, subcategoryId: '' } }));
  valid.forEach(item => operations.push({ action: 'set', collection: 'subcategories', id: item.id, data: { id: item.id, name: item.name || '', categoryId: item.categoryId || '' } }));
  return operations;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { planUnitIdMigration, type MigrationDocument } from './unit-id-migration-core';

const privateCollections = new Set(['payments', 'reports_manual_weeks', 'smart_links', 'smart_link_clicks', 'gdvEntries']);
const base: MigrationDocument[] = [
  { collection: 'systemUnits', id: 'unit-a', data: { name: 'A' } },
  { collection: 'systemUnits', id: 'unit-b', data: { name: 'B' } },
  { collection: 'users', id: 'barber-a', data: { unit: 'unit-a', authUid: 'auth-a' } },
];

test('resolve aliases e proprietários somente a partir de evidência explícita', () => {
  const plan = planUnitIdMigration([
    ...base,
    { collection: 'payments', id: 'pay', data: { userId: 'barber-a' } },
    { collection: 'reports_manual_weeks', id: 'week', data: { unit: 'unit-b' } },
  ], privateCollections);
  assert.deepEqual(plan.map(item => item.resolution.status === 'resolved' ? item.resolution.unitId : null), ['unit-a', 'unit-b']);
});

test('preserva documentos já corrigidos e torna a segunda execução idempotente', () => {
  const first = planUnitIdMigration([...base, { collection: 'payments', id: 'pay', data: { userId: 'auth-a' } }], privateCollections);
  assert.equal(first[0].resolution.status, 'resolved');
  const unitId = first[0].resolution.status === 'resolved' ? first[0].resolution.unitId : '';
  const second = planUnitIdMigration([...base, { collection: 'payments', id: 'pay', data: { userId: 'auth-a', unitId } }], privateCollections);
  assert.equal(second[0].resolution.status, 'already-valid');
});

test('não escolhe silenciosamente entre unidades conflitantes ou agregadas', () => {
  const plan = planUnitIdMigration([
    ...base,
    { collection: 'payments', id: 'conflict', data: { userId: 'barber-a', unit: 'unit-b' } },
    { collection: 'gdvEntries', id: 'multi', data: { units: { 'unit-a': {}, 'unit-b': {} } } },
  ], privateCollections);
  assert.equal(plan[0].resolution.status, 'unresolved');
  assert.deepEqual(plan[0].resolution.candidates, ['unit-a', 'unit-b']);
  assert.equal(plan[1].resolution.status, 'unresolved');
});

test('propaga a unidade do link para seus logs de clique', () => {
  const plan = planUnitIdMigration([
    ...base,
    { collection: 'smart_links', id: 'link', data: { ownerId: 'auth-a' } },
    { collection: 'smart_link_clicks', id: 'click', data: { linkId: 'link' } },
  ], privateCollections);
  assert.equal(plan[1].resolution.status, 'resolved');
  assert.equal(plan[1].resolution.status === 'resolved' && plan[1].resolution.unitId, 'unit-a');
});

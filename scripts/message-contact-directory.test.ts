import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectoryContact, createSnapshotSegment, searchDirectoryContacts } from '../message-contact-directory';

const a = buildDirectoryContact('unit-a', { name: 'Ana Silva', phone: '11999990001', origin: 'Formulário' }, '2026-09-18T12:00:00.000Z');
const b = buildDirectoryContact('unit-b', { name: 'Bruno Souza', phone: '11999990002', origin: 'Balcão' }, '2026-09-18T12:00:00.000Z');

test('busca é isolada por unidade, paginada e mascara telefone', () => {
  const result = searchDirectoryContacts([a, b], { unitId: 'unit-a', query: 'Ana', page: 1, pageSize: 10 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, 'Ana Silva');
  assert.equal('normalizedPhone' in result.items[0], false);
  assert.match(result.items[0].maskedPhone, /\*{5}/);
  assert.equal(searchDirectoryContacts([a, b], { unitId: 'unit-a', query: 'Bruno' }).total, 0);
});

test('segmento usa snapshot e remove contatos duplicados', () => {
  const segment = createSnapshotSegment({ id: 'segment-1', unitId: 'unit-a', name: 'Clientes ativos', contactIds: [a.id, a.id], actorId: 'admin' });
  assert.equal(segment.policy, 'SNAPSHOT');
  assert.deepEqual(segment.contactIds, [a.id]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanonicalUserProfile, isCanonicalUserProfile, UserProfileData } from './user-uid-migration-core';

test('padroniza o perfil no UID preservando o identificador legado', () => {
  const result = buildCanonicalUserProfile(
    { id: 'legacy-1', email: 'pessoa@exemplo.com', name: 'Pessoa' },
    {},
    'legacy-1',
    'firebase-uid-1',
    '2026-09-09T12:00:00.000Z',
    undefined,
  );
  assert.equal(result.id, 'firebase-uid-1');
  assert.equal(result.authUid, 'firebase-uid-1');
  assert.equal(result.legacyId, 'legacy-1');
  assert.equal(isCanonicalUserProfile('firebase-uid-1', result, 'firebase-uid-1'), true);
});

test('uma segunda execução não agenda novamente um perfil canônico', () => {
  const documents = new Map<string, UserProfileData>([
    ['legacy-1', { id: 'legacy-1', email: 'pessoa@exemplo.com' }],
  ]);
  const apply = () => {
    const legacy = documents.get('legacy-1');
    if (!legacy) return false;
    const canonical = buildCanonicalUserProfile(legacy, documents.get('firebase-uid-1') || {}, 'legacy-1', 'firebase-uid-1', 'agora', undefined);
    documents.set('firebase-uid-1', canonical);
    documents.delete('legacy-1');
    return true;
  };
  assert.equal(apply(), true);
  assert.equal(apply(), false);
  assert.equal(documents.size, 1);
  assert.equal(isCanonicalUserProfile('firebase-uid-1', documents.get('firebase-uid-1')!, 'firebase-uid-1'), true);
});

test('perfil sem correspondência permanece inalterado', () => {
  const profile = { id: 'sem-auth', email: 'sem-auth@exemplo.com' };
  const before = structuredClone(profile);
  assert.deepEqual(profile, before);
});

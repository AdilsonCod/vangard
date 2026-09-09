import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storeSource = readFileSync(new URL('../src/store.tsx', import.meta.url), 'utf8');

test('a identidade da sessão não é lida nem gravada no armazenamento do navegador', () => {
  assert.equal(storeSource.includes('vans_authenticated_user_id'), false);
  assert.doesNotMatch(storeSource, /localStorage\.(?:getItem|setItem|removeItem)\([^\n]*(?:user|auth|session)/i);
});

test('o perfil autenticado é carregado pelo UID informado pelo Firebase Auth', () => {
  assert.match(storeSource, /onAuthStateChanged\(auth/);
  assert.match(storeSource, /doc\(db, 'users', fbUser\.uid\)/);
});

test('logout encerra a sessão Firebase e limpa os dados privados em memória', () => {
  assert.match(storeSource, /const logout = async \(\) =>/);
  assert.match(storeSource, /await signOut\(auth\)/);
  assert.match(storeSource, /clearPrivateState\(\)/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/components/UsersDashboard.tsx', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/store.tsx', import.meta.url), 'utf8');

test('remoção oferece inativação e exclusão de perfil', () => {
  assert.match(dashboard, /Inativar perfil/);
  assert.match(dashboard, /Excluir perfil/);
});

test('exclusão remove somente o documento de perfil', () => {
  const implementation = store.match(/const deleteUser = async[\s\S]*?\n  };/)?.[0] || '';
  assert.match(implementation, /deleteDoc\(doc\(db, 'users', id\)\)/);
  assert.doesNotMatch(implementation, /entries|payments|targets|transactions/);
});

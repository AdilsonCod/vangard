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

test('preservação de dados é informada e aplicada a todos os perfis', () => {
  assert.match(dashboard, /Todos os dados operacionais e históricos do usuário foram preservados/);
  assert.doesNotMatch(dashboard, /existingUser\.role === 'BARBER'/);
});

test('cadastro exige e valida o e-mail do usuário', () => {
  assert.match(dashboard, /placeholder="E-mail obrigatório"/);
  assert.match(dashboard, /type="email"[\s\S]*?required[\s\S]*?autoComplete="email"/);
  assert.match(dashboard, /O e-mail é obrigatório/);
  assert.match(dashboard, /Informe um e-mail válido/);
  assert.match(store, /O e-mail é obrigatório para cadastrar um usuário/);
  assert.match(store, /O e-mail é obrigatório para atualizar um usuário/);
});

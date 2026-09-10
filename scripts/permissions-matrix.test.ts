import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const matrix = readFileSync(new URL('../.Docs/PERMISSOES.md', import.meta.url), 'utf8');

test('a matriz referencia o PRD e contempla todos os perfis', () => {
  assert.match(matrix, /\[PRD\]\(\.\/prd\.md\)/);
  for (const role of ['Administrador', 'Gerência', 'Financeiro', 'Marketing', 'Recepção', 'Barbeiro/profissional']) {
    assert.match(matrix, new RegExp(role));
  }
});

test('a matriz define ações e módulos sensíveis', () => {
  for (const action of ['Ler ou listar', 'Criar', 'Editar', 'Excluir', 'Efetivar', 'Administrar']) {
    assert.match(matrix, new RegExp(action));
  }
  for (const moduleName of ['Caixa', 'Conciliação', 'Pagamentos', 'Importações', 'Mural', 'Disparo', 'Links inteligentes', 'Marketing', 'Auditoria']) {
    assert.match(matrix, new RegExp(moduleName));
  }
});

test('a matriz diferencia interface de autorização e cobre múltiplas unidades', () => {
  assert.match(matrix, /Ocultar menu, botão, aba, campo ou rota no React \*\*não é autorização\*\*/);
  assert.match(matrix, /Servidor\/API/);
  assert.match(matrix, /Firestore/);
  assert.match(matrix, /Recepção possui exatamente uma unidade operacional e não pode selecionar `ALL`/);
  assert.match(matrix, /Leituras devem ser filtradas na consulta/);
});

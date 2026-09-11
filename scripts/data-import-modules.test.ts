import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAdminTab, getAdminNavigation } from '../src/config/adminNavigation';
import { detectImportTypeFromFilename, findImportHeaderIndex, parseImportCurrency, parseImportWholeNumber } from '../src/services/dataImportParsing';

test('identifica os formatos conhecidos pelo nome do arquivo', () => {
  assert.equal(detectImportTypeFromFilename('Matriz ass agosto.pdf'), 'DPOTE_PDF');
  assert.equal(detectImportTypeFromFilename('serviços barbeiros agosto.csv'), 'SERVICOS');
  assert.equal(detectImportTypeFromFilename('Relatório09_Dados.csv'), 'RELATORIO_09');
  assert.equal(detectImportTypeFromFilename('Relatório17_Dados.csv'), 'RELATORIO_17');
  assert.equal(detectImportTypeFromFilename('Relatório33_Dados.csv'), 'RELATORIO_33');
  assert.equal(detectImportTypeFromFilename('arquivo-generico.csv'), null);
});

test('normaliza valores monetários brasileiros e números inteiros', () => {
  assert.equal(parseImportCurrency('R$ 1.234,56'), 1234.56);
  assert.equal(parseImportCurrency('(R$ 99,90)'), -99.9);
  assert.equal(parseImportCurrency('1,234.56'), 1234.56);
  assert.equal(parseImportWholeNumber('154 un'), 154);
});

test('localiza a linha de cabeçalho mais provável', () => {
  const matrix = [['Relatório mensal'], ['emitido em', '11/09/2026'], ['Profissional', 'Serviço', 'Quantidade', 'Valor Total']];
  assert.equal(findImportHeaderIndex(matrix), 2);
});

test('menu administrativo respeita as permissões por perfil', () => {
  assert.equal(canAccessAdminTab('RECEPTION', 'MESSAGES'), true);
  assert.equal(canAccessAdminTab('RECEPTION', 'PAYMENTS'), false);
  assert.equal(canAccessAdminTab('FINANCIAL', 'FINANCE_RECEBIMENTOS'), true);
  assert.equal(canAccessAdminTab('MARKETING', 'SMART_LINKS'), true);
  assert.ok(getAdminNavigation('ADMIN').length > getAdminNavigation('RECEPTION').length);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { detectMessageContactMapping, mapMessageContactRows, validateMessageContactContent, validateMessageContactFile } from '../src/services/messageContactImport';

const source = [
  { Nome: 'Ana Silva', Telefone: '(11) 99999-0001', Origem: 'Formulário', 'Data consentimento': '2026-09-01', Evidência: 'Aceite 1', Cidade: 'São Paulo' },
  { Nome: 'Ana duplicada', Telefone: '5511999990001', Origem: 'Formulário', 'Data consentimento': '2026-09-01', Evidência: 'Aceite 2', Cidade: 'São Paulo' },
  { Nome: 'Inválido', Telefone: '123', Origem: '', 'Data consentimento': '', Evidência: '', Cidade: 'Santos' },
];

for (const extension of ['csv', 'xlsx', 'xls', 'ods'] as const) {
  test(`processa arquivo ${extension.toUpperCase()} com cabeçalhos detectados`, () => {
    const sheet = XLSX.utils.json_to_sheet(source);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Contatos');
    const data = XLSX.write(workbook, { type: 'buffer', bookType: extension === 'csv' ? 'csv' : extension });
    validateMessageContactFile({ name: `contatos.${extension}`, size: data.byteLength });
    validateMessageContactContent(extension, data);
    const parsed = XLSX.read(data, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(parsed.Sheets[parsed.SheetNames[0]], { defval: '', raw: false });
    const mapping = detectMessageContactMapping(Object.keys(rows[0]));
    mapping.variableColumns = ['Cidade'];
    const result = mapMessageContactRows(rows, mapping);
    assert.equal(result.contacts.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.invalid.length, 1);
    assert.equal(result.contacts[0].name, 'Ana Silva');
    assert.equal(result.contacts[0].variables.Cidade, 'São Paulo');
  });
}

test('rejeita arquivo vazio, grande, malformado e mapeamento sem telefone', () => {
  assert.throws(() => validateMessageContactFile({ name: 'vazio.csv', size: 0 }), /vazio/i);
  assert.throws(() => validateMessageContactFile({ name: 'grande.xlsx', size: 11 * 1024 * 1024 }), /10 MB/i);
  assert.throws(() => validateMessageContactFile({ name: 'contatos.txt', size: 10 }), /Formato não suportado/i);
  assert.throws(() => validateMessageContactContent('xlsx', new TextEncoder().encode('conteúdo inválido')), /malformado/i);
  assert.throws(() => validateMessageContactContent('xls', new TextEncoder().encode('conteúdo inválido')), /malformado/i);
  assert.throws(() => mapMessageContactRows([{ Nome: 'Ana' }], { name: 'Nome', phone: '', origin: '', consentAt: '', evidence: '', variableColumns: [] }), /telefone/i);
});

test('arquivo sem registros produz prévia vazia', () => {
  const result = mapMessageContactRows([], { name: '', phone: 'Telefone', origin: '', consentAt: '', evidence: '', variableColumns: [] });
  assert.deepEqual(result, { contacts: [], invalid: [], duplicates: [], totalRows: 0 });
});

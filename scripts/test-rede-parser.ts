import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { strToU8, zipSync } from 'fflate';
import { parseRedeFile } from '../src/utils/reconciliationEngine';
import { buildSettlementTransactionId, isSettlementEligible } from '../src/utils/reconciliationSettlement';
import type { ConciliationItem } from '../src/types/reconciliation';
import { formatFinancialPeriod, getFinancialPeriod, getLatestFinancialPeriod } from '../src/utils/financialPeriods';
import { hydrateXlsxSharedStrings } from '../src/utils/xlsxSharedStrings';
import { isValidFinancialAmountInput, parseFinancialAmount } from '../src/utils/financialAmount';
import { sanitizeFirestoreData } from '../src/utils/firestoreData';

function createParserFile(bytes: Uint8Array, name: string): File {
  const copy = Uint8Array.from(bytes);
  return {
    name,
    arrayBuffer: async () => copy.buffer
  } as File;
}

function testSharedStringRecovery() {
  const archive = zipSync({
    'xl/sharedStrings.xml': strToU8(
      '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si ><t >modalidade</t></si></sst>'
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0"?><workbook><sheets><sheet name="pagamentos" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'
    )
  });
  const workbook = {
    SheetNames: ['pagamentos'],
    Sheets: { pagamentos: { A1: { t: 's', v: undefined }, '!ref': 'A1' } }
  } as unknown as XLSX.WorkBook;

  assert.equal(hydrateXlsxSharedStrings(workbook, archive), 1);
  assert.equal(workbook.Sheets.pagamentos.A1.v, 'modalidade');
}

async function testOfficialSummaryCsv() {
  const docsPath = path.resolve('.Docs');
  const fileName = fs.readdirSync(docsPath).find(name => name.startsWith('Rede_Rel_Recebimentos'));
  assert.ok(fileName, 'Relatório oficial da Rede não encontrado em .Docs');

  const bytes = fs.readFileSync(path.join(docsPath, fileName));
  const result = await parseRedeFile(createParserFile(bytes, fileName));

  assert.equal(result.pagamentos.length, 0, 'A capa CSV não pode gerar transações falsas');
  assert.equal(result.resumoInfo?.isOnlyResumo, true, 'A capa deve ser identificada como resumo');
  assert.equal(result.resumoInfo?.liquidoRecebido, 82_850.63, 'O líquido do resumo deve ser lido');
  assert.equal(result.resumoInfo?.cobrancas, 0, 'As cobranças do resumo devem ser lidas');
  assert.equal(result.resumoInfo?.aReceber, 0, 'O total a receber do resumo deve ser lido');
}

async function testWorkbookWithPaymentsSheet() {
  const workbook = XLSX.utils.book_new();

  const resumoRows = [
    ['PERÍODO: 01/08/2026 A 31/08/2026'],
    [],
    ['RESUMO CONCILIAÇÃO:'],
    ['', 'Líquido recebido no período', '', 'Cobranças no período', '', 'A receber no período'],
    ['', 'R$ 82.850,63', '', 'R$ 0,00', '', 'R$ 0,00'],
    [],
    ['Pagamentos: são os valores recebidos e/ou previstos a receber a nível de parcelas considerando vendas canceladas.']
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resumoRows), 'Resumo');

  const pagamentosRows: unknown[][] = Array.from({ length: 125 }, (_, index) =>
    index === 0 ? ['RELATÓRIO DE RECEBIMENTOS - REDE'] : []
  );
  pagamentosRows.push([
    'Data do Pagamento',
    'Data Original da Venda',
    'Número do NSU',
    'Código de Autorização',
    'Produto',
    'Bandeira',
    'Valor Bruto da Parcela Original',
    'Taxa Administrativa (%)',
    'Valor da Taxa',
    'Valor Líquido da Parcela',
    'Status'
  ]);
  pagamentosRows.push([
    '05/08/2026', '03/08/2026', '123456', 'AUTH01', 'Crédito à vista', 'Visa',
    'R$ 100,00', '2,50%', '-R$ 2,50', 'R$ 97,50', 'Pago'
  ]);
  pagamentosRows.push([
    '06/08/2026', '04/08/2026', '654321', 'AUTH02', 'Débito', 'Mastercard',
    70, 0.015, -1.05, 68.95, 'Liquidado'
  ]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(pagamentosRows), 'Pagamentos');

  const workbookBytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const result = await parseRedeFile(createParserFile(new Uint8Array(workbookBytes), 'Rede_Rel_Recebimentos.xlsx'));

  assert.equal(result.pagamentos.length, 2, 'As transações da aba Pagamentos devem ser extraídas');
  assert.equal(result.resumoInfo?.nomeAbaProcessada, 'Pagamentos');
  assert.equal(result.resumoInfo?.isOnlyResumo, false);
  assert.equal(result.pagamentos[0].valorBruto, 100);
  assert.equal(result.pagamentos[0].valorMdr, 2.5);
  assert.equal(result.pagamentos[0].valorLiquido, 97.5);
  assert.equal(result.pagamentos[0].taxaMdrPerc, 2.5);
  assert.equal(result.pagamentos[0].modalidade, 'CREDITO');
  assert.equal(result.pagamentos[1].modalidade, 'DEBITO');
  assert.equal(result.pagamentos[1].taxaMdrPerc, 1.5);
  assert.equal(result.pagamentos[1].dataVenda, '2026-08-04');
}

function testSettlementEligibility() {
  const baseItem: ConciliationItem = {
    id: 'batch_2026-08-05|Crédito',
    regra: 'REGRA_2_PDV_REDE',
    dataVenda: '2026-08-05',
    identificador: 'Lote 2026-08-05',
    clienteOuDesc: 'Fechamento Lote',
    modalidadeOuPlano: 'Crédito',
    valorBruto: 100,
    valorMdrRetido: 2.5,
    valorLiquido: 97.5,
    mdrTaxaEfetiva: 2.5,
    diferencaTaxa: 0,
    status: 'CONCILIADO',
    statusDescricao: 'Conciliado'
  };

  assert.equal(isSettlementEligible(baseItem), true);
  assert.equal(isSettlementEligible({ ...baseItem, status: 'CONCILIADO_REDE' }), true);
  assert.equal(isSettlementEligible({ ...baseItem, status: 'CONCILIADO_PIX_BANCO' }), true);
  assert.equal(isSettlementEligible({ ...baseItem, status: 'DIVERGENCIA_TAXA' }), false);
  assert.equal(isSettlementEligible({ ...baseItem, status: 'PENDENTE_LIQUIDACAO' }), false);
  assert.equal(isSettlementEligible({ ...baseItem, valorLiquido: 0 }), false);
  assert.equal(
    isSettlementEligible({ ...baseItem, regra: 'REGRA_1_CLUBE_PREVISAO' }),
    false,
    'Previsão D+31 não deve entrar no Caixa antes da liquidação efetiva'
  );
  assert.equal(
    buildSettlementTransactionId('Matriz Sudoeste', baseItem.id),
    'reconciliation_Matriz_Sudoeste_batch_2026-08-05_Cr_dito'
  );
}

function testFinancialPeriodSelection() {
  assert.equal(getFinancialPeriod('2026-08-31'), '2026-08');
  assert.equal(getFinancialPeriod('31/08/2026'), null);
  assert.equal(
    getLatestFinancialPeriod([
      { date: '2026-07-31' },
      { date: '2026-08-01' },
      { date: '2026-08-31' }
    ]),
    '2026-08'
  );
  assert.equal(formatFinancialPeriod('2026-08'), '08/2026');
}

function testFinancialAmountInput() {
  assert.equal(isValidFinancialAmountInput('123456'), true);
  assert.equal(isValidFinancialAmountInput('123456,78'), true);
  assert.equal(isValidFinancialAmountInput('123456.78'), true);
  assert.equal(isValidFinancialAmountInput('123456,789'), false);
  assert.equal(isValidFinancialAmountInput('123456.789'), false);
  assert.equal(parseFinancialAmount('123456,78'), 123456.78);
  assert.equal(parseFinancialAmount(123456.789), 123456.79);
}

function testFirestoreDataSanitization() {
  const input = {
    id: 'report_1',
    optional: undefined,
    summary: { total: 10, missing: undefined },
    items: [{ id: 'item_1', note: undefined }, undefined]
  };
  const sanitized = sanitizeFirestoreData(input);

  assert.deepEqual(sanitized, {
    id: 'report_1',
    summary: { total: 10 },
    items: [{ id: 'item_1' }]
  });
}

await testOfficialSummaryCsv();
await testWorkbookWithPaymentsSheet();
testSharedStringRecovery();
testSettlementEligibility();
testFinancialPeriodSelection();
testFinancialAmountInput();
testFirestoreDataSanitization();
console.log('Rede parser: testes concluídos com sucesso.');

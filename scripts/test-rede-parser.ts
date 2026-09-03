import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { parseRedeFile } from '../src/utils/reconciliationEngine';

function createParserFile(bytes: Uint8Array, name: string): File {
  const copy = Uint8Array.from(bytes);
  return {
    name,
    arrayBuffer: async () => copy.buffer
  } as File;
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
    70, 1.5, -1.05, 68.95, 'Liquidado'
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
  assert.equal(result.pagamentos[0].modalidade, 'CREDITO');
  assert.equal(result.pagamentos[1].modalidade, 'DEBITO');
  assert.equal(result.pagamentos[1].dataVenda, '2026-08-04');
}

await testOfficialSummaryCsv();
await testWorkbookWithPaymentsSheet();
console.log('Rede parser: testes concluídos com sucesso.');

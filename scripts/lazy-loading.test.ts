import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadXlsx, loadPdfJs, loadPdfExporter } from '../src/services/lazyLibraries';

test('dist/index.html não faz modulepreload de bibliotecas pesadas de planilha, pdf ou exportação', () => {
  const indexPath = path.resolve(process.cwd(), 'dist', 'index.html');
  assert.ok(fs.existsSync(indexPath), 'dist/index.html deve existir após o build');

  const html = fs.readFileSync(indexPath, 'utf-8');

  // Regex para capturar tags <link rel="modulepreload" ...>
  const preloadMatches = html.match(/<link\s+[^>]*rel=["']modulepreload["'][^>]*>/gi) || [];

  for (const tag of preloadMatches) {
    assert.doesNotMatch(tag, /vendor-xlsx/i, 'index.html não pode pré-carregar vendor-xlsx');
    assert.doesNotMatch(tag, /vendor-export/i, 'index.html não pode pré-carregar vendor-export');
    assert.doesNotMatch(tag, /vendor-pdf/i, 'index.html não pode pré-carregar vendor-pdf');
    assert.doesNotMatch(tag, /pdf\.worker/i, 'index.html não pode pré-carregar pdf.worker');
  }
});

test('serviço loadXlsx carrega XLSX sob demanda com sucesso', async () => {
  const XLSX = await loadXlsx();
  assert.ok(XLSX, 'XLSX deve ser carregado com sucesso');
  assert.equal(typeof XLSX.read, 'function');
  assert.equal(typeof XLSX.utils.sheet_to_json, 'function');

  // Testar criação de workbook simples em memória
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([{ teste: 'ok', valor: 123 }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert.ok(buffer && buffer.length > 0, 'Buffer gerado com sucesso');
});

test('serviço loadPdfJs carrega pdfjs-dist sob demanda com sucesso', async () => {
  const pdfjs = await loadPdfJs();
  assert.ok(pdfjs, 'PDF.js deve ser carregado com sucesso');
  assert.equal(typeof pdfjs.getDocument, 'function');
  assert.ok(pdfjs.GlobalWorkerOptions.workerSrc, 'WorkerSrc deve estar configurado');
});

test('serviço loadPdfExporter carrega jspdf e html-to-image sob demanda com sucesso', async () => {
  const { jsPDF, toCanvas } = await loadPdfExporter();
  assert.ok(jsPDF, 'jsPDF deve ser carregado');
  assert.equal(typeof jsPDF, 'function');
  assert.ok(toCanvas, 'toCanvas deve ser carregado');
  assert.equal(typeof toCanvas, 'function');

  const doc = new jsPDF();
  doc.text('Teste', 10, 10);
  assert.ok(doc.output('arraybuffer').byteLength > 0);
});

test('erros de carregamento exibem mensagens amigáveis em português', async () => {
  const formatErrorMessage = (lib: string, err: any) =>
    `Não foi possível carregar o módulo de ${lib}. Verifique sua conexão com a internet e tente novamente. (Detalhes: ${err?.message || err})`;

  const msg = formatErrorMessage('planilhas (Excel)', new Error('Failed to fetch dynamically imported module'));
  assert.match(msg, /Não foi possível carregar o módulo de planilhas/);
  assert.match(msg, /Verifique sua conexão com a internet/);
});

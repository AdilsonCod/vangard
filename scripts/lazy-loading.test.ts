import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRetryableLoader } from '../src/services/retryableLoader';
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


test('falha de download é recuperável, preserva causa e permite nova tentativa compartilhada', async () => {
  let attempts = 0;
  const failure = new Error('Network unavailable');
  const module = { loaded: true };
  const load = createRetryableLoader(async () => {
    attempts++;
    if (attempts === 1) throw failure;
    return module;
  }, 'Não foi possível carregar o módulo. Tente novamente.');
  const first = load();
  assert.equal(load(), first, 'requisições simultâneas compartilham a promessa');
  await assert.rejects(first, error => error instanceof Error && error.cause === failure && /Tente novamente/.test(error.message));
  assert.equal(await load(), module);
  assert.equal(await load(), module);
  assert.equal(attempts, 2, 'sucesso é reutilizado sem baixar outra vez');
});

test('grafo estático completo da entrada exclui PDF, XLSX e exportadores', () => {
  const manifest = JSON.parse(fs.readFileSync('dist/.vite/manifest.json', 'utf8'));
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    assert.ok(chunk, 'chunk deve constar no manifest: ' + key);
    assert.doesNotMatch(chunk.file, /vendor-(xlsx|pdf|export)|pdf.worker/);
    for (const dependency of chunk.imports || []) visit(dependency);
  };
  assert.ok(manifest['index.html']?.isEntry);
  visit('index.html');
  const bytes = [...visited].reduce((sum, key) => sum + fs.statSync(path.join('dist', manifest[key].file)).size, 0);
  console.log('JavaScript inicial, incluindo dependências estáticas: ' + bytes + ' bytes em ' + visited.size + ' arquivos.');
});

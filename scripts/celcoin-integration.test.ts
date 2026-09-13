import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decryptCelcoinCredentials, encryptCelcoinCredentials, fetchCelcoinTransactions, normalizeCelcoinTransaction, testCelcoinConnection } from '../celcoin-service';

const interfaceSource = readFileSync(new URL('../src/components/CelcoinIntegration.tsx', import.meta.url), 'utf8');

test('normaliza valores em centavos e campos de conciliação', () => {
  const item = normalizeCelcoinTransaction({ galaxPayId: 42, value: 12550, payday: '2026-09-20', status: 'pending', statusDescription: 'Pendente', Pix: {} });
  assert.equal(item?.id, 'celcoin_42');
  assert.equal(item?.amount, 125.5);
  assert.equal(item?.paymentMethod, 'PIX');
});

test('interface permite configurar sem persistir o segredo no navegador', () => {
  assert.match(interfaceSource, /Configurar conexão/);
  assert.match(interfaceSource, /Galax ID/);
  assert.match(interfaceSource, /Galax Hash/);
  assert.match(interfaceSource, /Salvar configuração e conectar/);
  assert.doesNotMatch(interfaceSource, /localStorage|sessionStorage|indexedDB/);
});

test('credenciais persistentes são cifradas e recuperadas apenas no servidor', () => {
  const previous = process.env.CELCOIN_CONFIG_ENCRYPTION_KEY;
  process.env.CELCOIN_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    const encrypted = encryptCelcoinCredentials({ id: '43129', hash: 'hash-secreto', environment: 'production', webhookToken: 'webhook', publicToken: 'public' });
    assert.doesNotMatch(JSON.stringify(encrypted), /43129|hash-secreto|webhook|public/);
    assert.deepEqual(decryptCelcoinCredentials(encrypted), { id: '43129', hash: 'hash-secreto', environment: 'production', webhookToken: 'webhook', publicToken: 'public' });
  } finally {
    if (previous === undefined) delete process.env.CELCOIN_CONFIG_ENCRYPTION_KEY; else process.env.CELCOIN_CONFIG_ENCRYPTION_KEY = previous;
  }
});

test('autentica com escopo somente leitura e separa recebíveis futuros', async () => {
  const original = { id: process.env.CELCOIN_GALAX_ID, hash: process.env.CELCOIN_GALAX_HASH, env: process.env.CELCOIN_ENVIRONMENT };
  process.env.CELCOIN_GALAX_ID = '123'; process.env.CELCOIN_GALAX_HASH = 'segredo'; process.env.CELCOIN_ENVIRONMENT = 'sandbox';
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith('/token')) return Response.json({ access_token: 'token-teste', expires_in: 600 });
    return Response.json({ Transactions: [{ galaxPayId: 7, value: 9900, payday: '2099-01-10', status: 'pending', statusDescription: 'Pendente' }] });
  }) as typeof fetch;
  try {
    await testCelcoinConnection(fetcher);
    const report = await fetchCelcoinTransactions({ from: '2099-01-01', to: '2099-01-31' }, fetcher);
    assert.equal(report.transactions.length, 1);
    assert.equal(report.receivables.length, 1);
    assert.match(String(calls[0].init?.body), /transactions\.read/);
    assert.doesNotMatch(JSON.stringify(report), /segredo|token-teste/);
  } finally {
    if (original.id === undefined) delete process.env.CELCOIN_GALAX_ID; else process.env.CELCOIN_GALAX_ID = original.id;
    if (original.hash === undefined) delete process.env.CELCOIN_GALAX_HASH; else process.env.CELCOIN_GALAX_HASH = original.hash;
    if (original.env === undefined) delete process.env.CELCOIN_ENVIRONMENT; else process.env.CELCOIN_ENVIRONMENT = original.env;
  }
});

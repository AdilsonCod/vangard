import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCelcoinTransactions, normalizeCelcoinTransaction, testCelcoinConnection } from '../celcoin-service';

test('normaliza valores em centavos e campos de conciliação', () => {
  const item = normalizeCelcoinTransaction({ galaxPayId: 42, value: 12550, payday: '2026-09-20', status: 'pending', statusDescription: 'Pendente', Pix: {} });
  assert.equal(item?.id, 'celcoin_42');
  assert.equal(item?.amount, 125.5);
  assert.equal(item?.paymentMethod, 'PIX');
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

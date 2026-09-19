import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PRODUCTION_MESSAGE_SERVICE_URL, messageReconnectDelay, resolveMessageServiceUrl } from '../src/services/messageServiceConfig';

test('produção usa o serviço persistente mesmo sem variável de build', () => {
  assert.equal(resolveMessageServiceUrl('', false), DEFAULT_PRODUCTION_MESSAGE_SERVICE_URL);
});

test('configuração explícita prevalece e remove barra final', () => {
  assert.equal(resolveMessageServiceUrl('https://mensagens.exemplo.com/', false), 'https://mensagens.exemplo.com');
  assert.equal(resolveMessageServiceUrl(undefined, true), 'http://127.0.0.1:3101');
});

test('reconexão usa espera progressiva limitada', () => {
  assert.deepEqual([0, 1, 2, 3, 8].map(messageReconnectDelay), [2_000, 4_000, 8_000, 15_000, 15_000]);
});

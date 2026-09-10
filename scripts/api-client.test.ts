import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createAuthenticatedApiClient } from '../src/services/apiClient';

test('envia o Firebase ID Token no cabeçalho Authorization', async () => {
  let authorization = '';
  const client = createAuthenticatedApiClient({
    currentUser: () => ({ getIdToken: async () => 'valid-token' }),
    logout: async () => undefined,
    fetcher: async (_input, init) => {
      authorization = new Headers(init?.headers).get('Authorization') || '';
      return Response.json({ ok: true });
    },
  });

  await client.json('/api/test');
  assert.equal(authorization, 'Bearer valid-token');
});

test('renova o token uma vez quando a API retorna 401', async () => {
  const refreshFlags: boolean[] = [];
  let requests = 0;
  const client = createAuthenticatedApiClient({
    currentUser: () => ({ getIdToken: async force => {
      refreshFlags.push(Boolean(force));
      return force ? 'refreshed-token' : 'expired-token';
    } }),
    logout: async () => undefined,
    fetcher: async (_input, init) => {
      requests += 1;
      const token = new Headers(init?.headers).get('Authorization');
      return token === 'Bearer refreshed-token'
        ? Response.json({ ok: true })
        : Response.json({ error: 'Token expirado.' }, { status: 401 });
    },
  });

  assert.deepEqual(await client.json('/api/test'), { ok: true });
  assert.deepEqual(refreshFlags, [false, true]);
  assert.equal(requests, 2);
});

test('encerra a sessão após uma segunda resposta 401', async () => {
  let logoutCalls = 0;
  const client = createAuthenticatedApiClient({
    currentUser: () => ({ getIdToken: async () => 'rejected-token' }),
    logout: async () => { logoutCalls += 1; },
    fetcher: async () => Response.json({}, { status: 401 }),
  });

  await assert.rejects(() => client.json('/api/test'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.match(error.message, /sessão expirou/i);
    return true;
  });
  assert.equal(logoutCalls, 1);
});

test('sessão ausente e acesso negado produzem mensagens controladas em português', async () => {
  const absent = createAuthenticatedApiClient({
    currentUser: () => null,
    logout: async () => undefined,
    fetcher: async () => Response.json({}),
  });
  await assert.rejects(() => absent.json('/api/test'), /Sua sessão expirou/);

  const denied = createAuthenticatedApiClient({
    currentUser: () => ({ getIdToken: async () => 'valid-token' }),
    logout: async () => undefined,
    fetcher: async () => Response.json({ error: 'Seu perfil não possui permissão para esta operação.' }, { status: 403 }),
  });
  await assert.rejects(() => denied.json('/api/test'), /não possui permissão/);
});

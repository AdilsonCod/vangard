import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { createRequireAuth, requireRoles, type VerifiedFirebaseUser } from '../server-auth';

let server: Server;
let baseUrl = '';

const identities: Record<string, VerifiedFirebaseUser> = {
  admin: { uid: 'admin-uid', email: 'admin@example.com', role: 'ADMIN' },
  marketing: { uid: 'marketing-uid', email: 'marketing@example.com', role: 'MARKETING' },
  reception: { uid: 'reception-uid', email: 'reception@example.com', role: 'RECEPTION' },
  barber: { uid: 'barber-uid', email: 'barber@example.com', role: 'BARBER' },
  norole: { uid: 'no-role-uid', email: 'norole@example.com' },
};

before(async () => {
  const app = express();
  app.use(express.json());
  const authenticate = createRequireAuth(async token => {
    const identity = identities[token];
    if (!identity) throw new Error('invalid token');
    return identity;
  });
  const marketingOnly = requireRoles('ADMIN', 'MARKETING');
  const communication = requireRoles('ADMIN', 'MARKETING', 'RECEPTION');

  app.post('/api/analyze-marketing', authenticate, marketingOnly, (_req, res) => res.json({ ok: true }));
  app.post('/api/generate-post-idea', authenticate, marketingOnly, (_req, res) => res.json({ ok: true }));
  app.post('/api/message-dispatch/start', authenticate, communication, (_req, res) => res.json({ ok: true }));
  app.get('/api/smart-links/link/simulate', authenticate, communication, (_req, res) => res.json({ ok: true }));

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Porta de teste indisponível.'));
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
    server.once('error', reject);
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function request(path: string, token?: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method: path.includes('simulate') ? 'GET' : 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('token ausente ou inválido recebe HTTP 401', async () => {
  assert.equal((await request('/api/analyze-marketing')).status, 401);
  assert.equal((await request('/api/analyze-marketing', 'invalid')).status, 401);
});

test('token válido sem função autorizada recebe HTTP 403', async () => {
  assert.equal((await request('/api/analyze-marketing', 'barber')).status, 403);
  assert.equal((await request('/api/analyze-marketing', 'norole')).status, 403);
});

test('função enviada no corpo não eleva a permissão do token', async () => {
  const response = await request('/api/generate-post-idea', 'barber', { role: 'ADMIN' });
  assert.equal(response.status, 403);
});

test('Administração e Marketing acessam as APIs de IA', async () => {
  assert.equal((await request('/api/analyze-marketing', 'admin')).status, 200);
  assert.equal((await request('/api/generate-post-idea', 'marketing')).status, 200);
});

test('Recepção acessa mensagens e links, mas não as APIs de IA', async () => {
  assert.equal((await request('/api/message-dispatch/start', 'reception')).status, 200);
  assert.equal((await request('/api/smart-links/link/simulate', 'reception')).status, 200);
  assert.equal((await request('/api/analyze-marketing', 'reception')).status, 403);
});

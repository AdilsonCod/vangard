import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createMessageServiceApp, messageServiceReleaseInfo } from '../message-service-app';

test('metadados de release priorizam versão e commit da infraestrutura', () => {
  assert.deepEqual(messageServiceReleaseInfo({ MESSAGE_SERVICE_VERSION: '2.4.1', RAILWAY_GIT_COMMIT_SHA: 'abc123' }), { version: '2.4.1', commit: 'abc123' });
  assert.deepEqual(messageServiceReleaseInfo({ npm_package_version: '1.0.0' }), { version: '1.0.0', commit: 'local' });
});

test('endpoint público de saúde identifica somente o serviço, sem expor segredos', async () => {
  const server = createMessageServiceApp().listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'message-dispatch');
    assert.equal(typeof body.version, 'string');
    assert.equal(typeof body.commit, 'string');
    assert.equal('secret' in body, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

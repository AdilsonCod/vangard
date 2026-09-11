import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafePublicUrl, isPrivateNetworkAddress } from '../smart-link-security';

const publicDns = async () => [{ address: '93.184.216.34' }];

test('aceita somente HTTPS público sem credenciais', async () => {
  assert.equal((await assertSafePublicUrl('https://example.com/campanha', publicDns)).hostname, 'example.com');
  await assert.rejects(() => assertSafePublicUrl('http://example.com', publicDns), /HTTPS/);
  await assert.rejects(() => assertSafePublicUrl('javascript:alert(1)', publicDns), /HTTPS/);
  await assert.rejects(() => assertSafePublicUrl('https://user:pass@example.com', publicDns), /credenciais/);
});

test('bloqueia nomes e endereços de redes internas', async () => {
  for (const url of ['https://localhost', 'https://servico.local', 'https://painel.internal']) {
    await assert.rejects(() => assertSafePublicUrl(url, publicDns), /internos/);
  }
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.1.2', '192.168.0.2', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  await assert.rejects(() => assertSafePublicUrl('https://example.com', async () => [{ address: '10.1.2.3' }]), /internos/);
});


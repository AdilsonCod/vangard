import assert from 'node:assert/strict';
import test from 'node:test';
import { messageDisconnectReason, messageQrExpiresAt, messageQrIsExpired } from '../message-session-lifecycle';

test('QR possui validade determinística e expira no limite', () => {
  const now = new Date('2026-09-16T12:00:00.000Z'); const expires = messageQrExpiresAt(now, 60_000);
  assert.equal(expires, '2026-09-16T12:01:00.000Z'); assert.equal(messageQrIsExpired(expires, new Date('2026-09-16T12:00:59.999Z')), false); assert.equal(messageQrIsExpired(expires, new Date('2026-09-16T12:01:00.000Z')), true);
});

test('motivo real da queda é preservado e código é usado como fallback', () => {
  assert.equal(messageDisconnectReason(new Error('Conexão substituída pelo aparelho')), 'Conexão substituída pelo aparelho');
  assert.equal(messageDisconnectReason(undefined, 515), 'Conexão encerrada pelo WhatsApp (código 515).');
});

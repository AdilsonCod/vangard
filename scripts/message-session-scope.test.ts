import assert from 'node:assert/strict';
import test from 'node:test';
import { UnitSessionRegistry, whatsappSessionVaultPath } from '../message-session-scope';

test('cada unidade recebe cofre e instância independentes', () => {
  const registry = new UnitSessionRegistry(unitId => ({ unitId, connected: false }));
  const a = registry.get('unit-a'); const b = registry.get('unit-b');
  a.connected = true;
  assert.notEqual(a, b); assert.equal(b.connected, false); assert.equal(registry.get('unit-a'), a);
  assert.notEqual(whatsappSessionVaultPath('data/whatsapp/session.enc', 'unit-a'), whatsappSessionVaultPath('data/whatsapp/session.enc', 'unit-b'));
});

test('identificador de unidade não permite escapar do diretório de sessões', () => {
  const path = whatsappSessionVaultPath('data/whatsapp/session.enc', '../../outra-unidade');
  assert.match(path.replace(/\\/g, '/'), /^data\/whatsapp\/sessions\/[a-f0-9]{32}\.enc$/);
});

test('escopo consolidado é rejeitado para evitar compartilhamento de sessão', () => {
  const registry = new UnitSessionRegistry(unitId => ({ unitId }));
  assert.throws(() => registry.get('ALL'), /unidade específica/);
});

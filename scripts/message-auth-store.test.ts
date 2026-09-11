import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { useEncryptedAuthState } from '../message-auth-store';

test('sessão Baileys persiste cifrada e pode ser restaurada após reinício', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'vans-message-vault-'));
  const vault = path.join(directory, 'session.enc');
  process.env.MESSAGE_AUTH_ENCRYPTION_KEY = 'teste-local-com-mais-de-trinta-e-dois-caracteres';
  try {
    const first = await useEncryptedAuthState(vault);
    first.state.creds.registered = true;
    await first.saveCreds();
    const raw = await readFile(vault, 'utf8');
    assert.equal(raw.includes('registered'), false);
    assert.equal(JSON.parse(raw).algorithm, 'aes-256-gcm');

    const restored = await useEncryptedAuthState(vault);
    assert.equal(restored.state.creds.registered, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


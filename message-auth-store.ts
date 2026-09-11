import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BufferJSON, initAuthCreds, proto, type AuthenticationState, type SignalDataTypeMap } from '@whiskeysockets/baileys';

type VaultPayload = { creds: AuthenticationState['creds']; keys: Record<string, Record<string, unknown>> };
type EncryptedEnvelope = { version: 1; algorithm: 'aes-256-gcm'; iv: string; tag: string; ciphertext: string };

const encryptionKey = () => {
  const secret = process.env.MESSAGE_AUTH_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error('MESSAGE_AUTH_ENCRYPTION_KEY deve ter pelo menos 32 caracteres.');
  return createHash('sha256').update(secret, 'utf8').digest();
};

const encrypt = (payload: VaultPayload): EncryptedEnvelope => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = JSON.stringify(payload, BufferJSON.replacer);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
};

const decrypt = (envelope: EncryptedEnvelope): VaultPayload => {
  if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') throw new Error('Formato do cofre de sessão não suportado.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext, BufferJSON.reviver) as VaultPayload;
};

export async function useEncryptedAuthState(vaultPath: string) {
  let payload: VaultPayload;
  try {
    payload = decrypt(JSON.parse(await readFile(vaultPath, 'utf8')) as EncryptedEnvelope);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    payload = { creds: initAuthCreds(), keys: {} };
  }

  let pendingWrite = Promise.resolve();
  const persist = () => {
    pendingWrite = pendingWrite.then(async () => {
      await mkdir(path.dirname(vaultPath), { recursive: true });
      const temporaryPath = `${vaultPath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(encrypt(payload)), { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, vaultPath);
    });
    return pendingWrite;
  };

  const state: AuthenticationState = {
    creds: payload.creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const values: Record<string, SignalDataTypeMap[T]> = {};
        for (const id of ids) {
          let value = payload.keys[type]?.[id] as SignalDataTypeMap[T] | undefined;
          if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value) as SignalDataTypeMap[T];
          if (value) values[id] = value;
        }
        return values;
      },
      set: async data => {
        for (const category of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
          payload.keys[category] ||= {};
          const entries = data[category];
          if (!entries) continue;
          for (const [id, value] of Object.entries(entries)) {
            if (value == null) delete payload.keys[category][id];
            else payload.keys[category][id] = value;
          }
        }
        await persist();
      },
    },
  };

  return { state, saveCreds: persist, persist };
}


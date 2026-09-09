import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AuthSessionGateway,
  canAccessProtectedContent,
  endAuthenticatedSession,
  restoreAuthenticatedSession,
  startAuthenticatedSession,
} from '../src/services/authSession';
import type { User } from '../src/types';

const profile = (id = 'firebase-uid'): User => ({
  id,
  authUid: id,
  name: 'Pessoa Teste',
  email: 'pessoa@exemplo.com',
  role: 'BARBER',
  unit: 'UNIT_1',
  isActive: true,
});

const gateway = (overrides: Partial<AuthSessionGateway> = {}) => ({
  signIn: async () => ({ uid: 'firebase-uid' }),
  signOut: async () => undefined,
  readProfile: async () => profile(),
  ...overrides,
});

test('login válido retorna exclusivamente o perfil associado ao UID autenticado', async () => {
  const session = await startAuthenticatedSession(gateway(), ' PESSOA@EXEMPLO.COM ', 'senha-valida');
  assert.equal(session?.id, 'firebase-uid');
  assert.equal(session?.authUid, 'firebase-uid');
  assert.equal(canAccessProtectedContent(session), true);
});

test('credenciais inválidas não iniciam sessão protegida', async () => {
  let signedOut = false;
  const session = await startAuthenticatedSession(gateway({
    signIn: async () => { throw new Error('auth/invalid-credential'); },
    signOut: async () => { signedOut = true; },
  }), 'pessoa@exemplo.com', 'incorreta');
  assert.equal(session, null);
  assert.equal(signedOut, true);
  assert.equal(canAccessProtectedContent(session), false);
});

test('recarregamento restaura uma sessão Firebase válida pelo UID', async () => {
  const session = await restoreAuthenticatedSession({ uid: 'firebase-uid' }, async uid => profile(uid));
  assert.equal(session?.id, 'firebase-uid');
  assert.equal(canAccessProtectedContent(session), true);
});

test('adulterar armazenamento local não troca a identidade autenticada', async () => {
  const browserStorage = new Map([['vans_authenticated_user_id', 'uid-atacante']]);
  const session = await restoreAuthenticatedSession({ uid: 'uid-real' }, async uid => profile(uid));
  assert.equal(browserStorage.get('vans_authenticated_user_id'), 'uid-atacante');
  assert.equal(session?.id, 'uid-real');
});

test('logout limpa a sessão e impede acesso protegido subsequente', async () => {
  let current: User | null = profile();
  let signedOut = false;
  await endAuthenticatedSession(async () => { signedOut = true; }, () => { current = null; });
  assert.equal(signedOut, true);
  assert.equal(current, null);
  assert.equal(canAccessProtectedContent(current), false);
});

test('perfil inativo ou inexistente é recusado', async () => {
  const inactive = await restoreAuthenticatedSession({ uid: 'firebase-uid' }, async () => ({ ...profile(), isActive: false }));
  const missing = await restoreAuthenticatedSession({ uid: 'firebase-uid' }, async () => null);
  assert.equal(inactive, null);
  assert.equal(missing, null);
});

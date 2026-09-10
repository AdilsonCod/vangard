import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, before } from 'node:test';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'vans-task-8-rules';
let environment: RulesTestEnvironment;

const baseProfile = {
  id: 'barber-uid',
  authUid: 'barber-uid',
  name: 'Profissional',
  email: 'profissional@exemplo.com',
  role: 'BARBER',
  unit: 'UNIT_1',
  isActive: true,
};

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8088,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'barber-uid'), baseProfile);
    await setDoc(doc(db, 'users', 'admin-uid'), {
      ...baseProfile,
      id: 'admin-uid',
      authUid: 'admin-uid',
      email: 'admin@exemplo.com',
      role: 'ADMIN',
    });
  });
});

after(async () => environment?.cleanup());

test('usuário comum edita somente os campos pessoais permitidos', async () => {
  const db = environment.authenticatedContext('barber-uid').firestore();
  await assertSucceeds(updateDoc(doc(db, 'users', 'barber-uid'), {
    name: 'Nome atualizado',
    notes: 'Anotação pessoal',
  }));
  const snapshot = await assertSucceeds(getDoc(doc(db, 'users', 'barber-uid')));
  assert.equal(snapshot.data()?.name, 'Nome atualizado');
});

test('usuário comum não altera função, unidade, status, UID ou permissões', async () => {
  const db = environment.authenticatedContext('barber-uid').firestore();
  for (const forbiddenChange of [
    { role: 'ADMIN' },
    { unit: 'UNIT_2' },
    { isActive: false },
    { authUid: 'outro-uid' },
    { permissions: ['GLOBAL'] },
  ]) {
    await assertFails(updateDoc(doc(db, 'users', 'barber-uid'), forbiddenChange));
  }
});

test('administrador autorizado gerencia os campos protegidos', async () => {
  const db = environment.authenticatedContext('admin-uid', { role: 'ADMIN' }).firestore();
  await assertSucceeds(updateDoc(doc(db, 'users', 'barber-uid'), {
    role: 'RECEPTION',
    unit: 'UNIT_2',
    isActive: false,
  }));
});

test('usuário comum não cria nem exclui perfis', async () => {
  const db = environment.authenticatedContext('barber-uid').firestore();
  await assertFails(setDoc(doc(db, 'users', 'intruso'), { ...baseProfile, id: 'intruso', authUid: 'intruso' }));
  await assertFails(deleteDoc(doc(db, 'users', 'barber-uid')));
});

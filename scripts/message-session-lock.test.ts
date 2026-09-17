import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { acquireMessageSessionLock, releaseMessageSessionLock, renewMessageSessionLock } from '../message-session-lock';

let app: App;
let db: Firestore;

before(() => {
  app = initializeApp({ projectId: 'vans-message-session-lock-test', credential: applicationDefault() }, 'message-session-lock-test');
  db = getFirestore(app);
});

after(async () => deleteApp(app));

test('duas instâncias não assumem simultaneamente a mesma unidade', async () => {
  const now = new Date('2026-09-16T12:00:00.000Z');
  const [a, b] = await Promise.all([
    acquireMessageSessionLock(db, 'unit-exclusive', 'instance-a', now),
    acquireMessageSessionLock(db, 'unit-exclusive', 'instance-b', now),
  ]);
  assert.equal([a, b].filter(Boolean).length, 1);
});

test('proprietário renova e outra instância recupera somente após expiração', async () => {
  const first = await acquireMessageSessionLock(db, 'unit-recovery', 'instance-a', new Date('2026-09-16T12:00:00.000Z'), 60_000);
  assert.ok(first);
  assert.equal(await renewMessageSessionLock(db, 'unit-recovery', 'instance-b', first.fencingToken, new Date('2026-09-16T12:00:10.000Z')), false);
  assert.equal(await renewMessageSessionLock(db, 'unit-recovery', 'instance-a', first.fencingToken, new Date('2026-09-16T12:00:10.000Z'), 60_000), true);
  assert.equal(await acquireMessageSessionLock(db, 'unit-recovery', 'instance-b', new Date('2026-09-16T12:00:30.000Z')), null);
  const recovered = await acquireMessageSessionLock(db, 'unit-recovery', 'instance-b', new Date('2026-09-16T12:01:11.000Z'));
  assert.equal(recovered?.ownerId, 'instance-b');
  assert.ok((recovered?.fencingToken || 0) > first.fencingToken);
});

test('lock antigo não pode renovar nem liberar depois da troca de proprietário', async () => {
  const first = await acquireMessageSessionLock(db, 'unit-fencing', 'instance-a', new Date('2026-09-16T12:00:00.000Z'), 1_000);
  assert.ok(first);
  const second = await acquireMessageSessionLock(db, 'unit-fencing', 'instance-b', new Date('2026-09-16T12:00:02.000Z'));
  assert.ok(second);
  assert.equal(await renewMessageSessionLock(db, 'unit-fencing', 'instance-a', first.fencingToken, new Date('2026-09-16T12:00:03.000Z')), false);
  assert.equal(await releaseMessageSessionLock(db, 'unit-fencing', 'instance-a', first.fencingToken), false);
  assert.equal(await releaseMessageSessionLock(db, 'unit-fencing', 'instance-b', second.fencingToken), true);
});

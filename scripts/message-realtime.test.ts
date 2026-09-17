import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createRequireAuth, requireRoles } from '../server-auth';
import { MessageRealtimeBroker, encodeSseEvent } from '../message-realtime';

test('eventos são entregues somente aos assinantes da mesma unidade', () => {
  const broker = new MessageRealtimeBroker<{ value: number }>();
  const unitA: number[] = [];
  const unitB: number[] = [];
  broker.subscribe('unit-a', event => unitA.push(event.data.value));
  broker.subscribe('unit-b', event => unitB.push(event.data.value));
  broker.publish('unit-a', 'progress', { value: 1 });
  assert.deepEqual(unitA, [1]);
  assert.deepEqual(unitB, []);
});

test('reconexão recebe snapshot atual e cursor monotônico', () => {
  const broker = new MessageRealtimeBroker<{ status: string }>();
  const first = broker.publish('unit-a', 'connection', { status: 'connecting' });
  const second = broker.publish('unit-a', 'connection', { status: 'connected' });
  const snapshot = broker.snapshot('unit-a', { status: 'connected' });
  assert.equal(second.id, first.id + 1);
  assert.equal(snapshot.id, second.id);
  assert.match(encodeSseEvent(snapshot), /event: snapshot/);
  assert.match(encodeSseEvent(snapshot), /"status":"connected"/);
});

test('queda remove assinante sem afetar os demais', () => {
  const broker = new MessageRealtimeBroker<number>();
  const received: number[] = [];
  const unsubscribe = broker.subscribe('unit-a', event => received.push(event.data));
  broker.publish('unit-a', 'progress', 1);
  unsubscribe();
  broker.publish('unit-a', 'progress', 2);
  assert.deepEqual(received, [1]);
});

test('middleware exige token válido e perfil autorizado', async () => {
  const app = express();
  const auth = createRequireAuth(async token => {
    if (token !== 'valid') throw new Error('invalid');
    return { uid: 'user', role: 'RECEPTION', unitId: 'unit-a' };
  });
  app.get('/events', auth, requireRoles('ADMIN', 'MARKETING', 'RECEPTION'), (_req, res) => res.sendStatus(204));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/events`;
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await fetch(base, { headers: { Authorization: 'Bearer valid' } })).status, 204);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

test('Firebase Admin grava, consulta e remove dados no Emulator e recusa token malformado', async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Execute pelo comando test:admin-sdk; o teste exige Emulator local.');
  const app = initializeApp({ projectId: 'demo-vans-admin-sdk' }, 'admin-sdk-compatibility');
  const db = getFirestore(app);
  const record = db.collection('compatibility_checks').doc('task-37');
  try {
    await record.set({ unitId: 'TEST_UNIT', amount: 125 });
    assert.deepEqual((await record.get()).data(), { unitId: 'TEST_UNIT', amount: 125 });
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(record);
      transaction.update(record, { amount: snapshot.data()!.amount + 25 });
    });
    const result = await db.collection('compatibility_checks').where('unitId', '==', 'TEST_UNIT').get();
    assert.equal(result.size, 1);
    assert.equal(result.docs[0].data().amount, 150);
    await assert.rejects(getAuth(app).verifyIdToken('invalid-token'), /Decoding Firebase ID token failed/);
    await record.delete();
    assert.equal((await record.get()).exists, false);
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
});

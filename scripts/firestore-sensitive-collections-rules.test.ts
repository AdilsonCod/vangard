import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'vans-task-9-rules';
let environment: RulesTestEnvironment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8088,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });

  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const profile of [
      { id: 'admin', role: 'ADMIN', unitId: 'unit-a' },
      { id: 'finance', role: 'FINANCIAL', unitId: 'unit-a' },
      { id: 'marketing', role: 'MARKETING', unitId: 'unit-a' },
      { id: 'reception', role: 'RECEPTION', unitId: 'unit-a' },
      { id: 'barber', role: 'BARBER', unitId: 'unit-a' },
    ]) {
      await setDoc(doc(db, 'users', profile.id), profile);
    }
    await setDoc(doc(db, 'auditLogs', 'seed'), { action: 'SEEDED_FOR_TEST' });
  });
});

after(async () => environment?.cleanup());

const authDb = (uid: string, role: string) =>
  environment.authenticatedContext(uid, { role }).firestore();

test('coleções financeiras permitem Financeiro e negam Barbeiro', async () => {
  const finance = authDb('finance', 'FINANCIAL');
  const barber = authDb('barber', 'BARBER');
  const cases = [
    ['commissionConfigs', 'unit-a'],
    ['dataImportJobs', 'job-1'],
    ['reconciliation_reports', 'report-1'],
    ['reports_manual_weeks', 'week-1'],
  ] as const;

  for (const [collectionName, id] of cases) {
    await assertSucceeds(setDoc(doc(finance, collectionName, id), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
    await assertFails(setDoc(doc(barber, collectionName, `${id}-denied`), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
  }
});

test('coleções de marketing permitem Marketing e negam Barbeiro', async () => {
  const marketing = authDb('marketing', 'MARKETING');
  const barber = authDb('barber', 'BARBER');
  const collections = [
    'marketing_campaigns',
    'marketing_traffic',
    'marketing_organic',
    'social_posts',
    'social_library',
  ];

  for (const collectionName of collections) {
    await assertSucceeds(setDoc(doc(marketing, collectionName, 'allowed'), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
    await assertFails(setDoc(doc(barber, collectionName, 'denied'), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
  }
});

test('coleções de mensagens permitem Recepção e negam Barbeiro', async () => {
  const reception = authDb('reception', 'RECEPTION');
  const barber = authDb('barber', 'BARBER');
  const collections = [
    'message_contact_lists',
    'message_dispatch_history',
    'dispatch_audit',
  ];

  for (const collectionName of collections) {
    await assertSucceeds(setDoc(doc(reception, collectionName, 'allowed'), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
    await assertFails(setDoc(doc(barber, collectionName, 'denied'), {
      unitId: 'unit-a',
      marker: collectionName,
    }));
  }
});

test('links inteligentes preservam resolução pública e restringem a gestão', async () => {
  const marketing = authDb('marketing', 'MARKETING');
  const barber = authDb('barber', 'BARBER');
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertSucceeds(setDoc(doc(marketing, 'smart_links', 'promo'), {
    shortCode: 'promo',
    destinationUrl: 'https://example.com',
    totalClicks: 0,
    isActive: true,
  }));
  await assertFails(setDoc(doc(barber, 'smart_links', 'denied'), {
    shortCode: 'denied',
    destinationUrl: 'https://example.com',
  }));
  await assertSucceeds(getDoc(doc(anonymous, 'smart_links', 'promo')));

  const click = {
    linkId: 'promo',
    shortCode: 'promo',
    destinationUrl: 'https://example.com',
    phase: 'ACTIVE',
    cycleNumber: null,
    timestamp: new Date(0).toISOString(),
    device: 'Desktop',
    referrer: '',
    simulated: false,
  };
  await assertSucceeds(setDoc(doc(marketing, 'smart_link_clicks', 'allowed'), click));
  await assertFails(getDoc(doc(barber, 'smart_link_clicks', 'allowed')));
});

test('auditoria permite leitura administrativa, nega leitura comum e toda escrita cliente', async () => {
  const admin = authDb('admin', 'ADMIN');
  const barber = authDb('barber', 'BARBER');

  const snapshot = await assertSucceeds(getDoc(doc(admin, 'auditLogs', 'seed')));
  assert.equal(snapshot.exists(), true);
  await assertFails(getDoc(doc(barber, 'auditLogs', 'seed')));
  await assertFails(setDoc(doc(admin, 'auditLogs', 'client-write'), { action: 'INVALID' }));
});

test('coleções não inventariadas são negadas até para administrador', async () => {
  const admin = authDb('admin', 'ADMIN');
  await assertFails(setDoc(doc(admin, 'unknown_private_collection', 'item'), { value: 1 }));
  await assertFails(getDoc(doc(admin, 'unknown_private_collection', 'item')));
});

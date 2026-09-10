import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';

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
      { id: 'finance-b', role: 'FINANCIAL', unitId: 'unit-b' },
      { id: 'marketing-b', role: 'MARKETING', unitId: 'unit-b' },
      { id: 'reception-b', role: 'RECEPTION', unitId: 'unit-b' },
    ]) {
      await setDoc(doc(db, 'users', profile.id), profile);
    }
    await setDoc(doc(db, 'auditLogs', 'seed'), { action: 'SEEDED_FOR_TEST' });
    const closing = { id: 'cash_closing_unit-a_2026-09-10', unitId: 'unit-a', date: '2026-09-10', status: 'CLOSED', openingBalance: 0, cashIncome: 100, cashOutflow: 0, expectedBalance: 100, countedBalance: 100, difference: 0, closedAt: new Date(0).toISOString(), closedBy: 'finance' };
    await setDoc(doc(db, 'cashClosings', closing.id), closing);
    await setDoc(doc(db, 'financialPeriodLocks', 'unit-a_2026-09-10'), { unitId: 'unit-a', period: '2026-09-10', closingId: closing.id, active: true });
    await setDoc(doc(db, 'financialPeriodLocks', 'unit-a_2026-09'), { unitId: 'unit-a', period: '2026-09', closingId: closing.id, active: true });
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

test('período fechado bloqueia alterações e reabertura exige financeiro, justificativa e lote atômico', async () => {
  const finance = authDb('finance', 'FINANCIAL');
  const reception = authDb('reception', 'RECEPTION');
  const transactionData = { unitId: 'unit-a', date: '2026-09-10', type: 'INCOME', status: 'RECEBIDO', amount: 100, category: 'Venda', description: 'Venda', movementNature: 'REVENUE' };
  await assertFails(setDoc(doc(finance, 'transactions', 'locked'), transactionData));

  const invalidBatch = writeBatch(reception);
  invalidBatch.update(doc(reception, 'cashClosings', 'cash_closing_unit-a_2026-09-10'), { status: 'REOPENED', reopeningReason: 'Correção necessária', reopenedBy: 'reception' });
  invalidBatch.update(doc(reception, 'financialPeriodLocks', 'unit-a_2026-09-10'), { active: false });
  await assertFails(invalidBatch.commit());

  const batch = writeBatch(finance);
  batch.update(doc(finance, 'cashClosings', 'cash_closing_unit-a_2026-09-10'), { status: 'REOPENED', reopeningReason: 'Correção do saldo contado', reopenedBy: 'finance', reopenedAt: new Date().toISOString() });
  batch.update(doc(finance, 'financialPeriodLocks', 'unit-a_2026-09-10'), { active: false });
  batch.update(doc(finance, 'financialPeriodLocks', 'unit-a_2026-09'), { active: false });
  batch.set(doc(finance, 'financialPeriodEvents', 'reopen-test'), { action: 'REOPENED', unitId: 'unit-a', date: '2026-09-10', actorId: 'finance', actorRole: 'FINANCIAL', reason: 'Correção do saldo contado', createdAt: new Date().toISOString() });
  await assertSucceeds(batch.commit());
  await assertSucceeds(setDoc(doc(finance, 'transactions', 'unlocked'), transactionData));
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
    unitId: 'unit-a',
    shortCode: 'promo',
    destinationUrl: 'https://example.com',
    totalClicks: 0,
    isActive: true,
  }));
  await assertFails(setDoc(doc(barber, 'smart_links', 'denied'), {
    shortCode: 'denied',
    destinationUrl: 'https://example.com',
  }));
  await assertFails(getDoc(doc(anonymous, 'smart_links', 'promo')));

  const click = {
    linkId: 'promo',
    unitId: 'unit-a',
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

test('perfis da Unidade B não acessam documentos privados da Unidade A', async () => {
  const financeA = authDb('finance', 'FINANCIAL');
  const financeB = authDb('finance-b', 'FINANCIAL');
  const marketingA = authDb('marketing', 'MARKETING');
  const marketingB = authDb('marketing-b', 'MARKETING');
  const receptionA = authDb('reception', 'RECEPTION');
  const receptionB = authDb('reception-b', 'RECEPTION');

  await assertSucceeds(setDoc(doc(financeA, 'reconciliation_reports', 'unit-a-report'), { unitId: 'unit-a' }));
  await assertFails(getDoc(doc(financeB, 'reconciliation_reports', 'unit-a-report')));
  await assertSucceeds(setDoc(doc(financeB, 'reconciliation_reports', 'unit-b-report'), { unitId: 'unit-b' }));
  const ownReports = await assertSucceeds(getDocs(query(collection(financeB, 'reconciliation_reports'), where('unitId', '==', 'unit-b'))));
  assert.deepEqual(ownReports.docs.map(item => item.id), ['unit-b-report']);
  await assertFails(getDocs(collection(financeB, 'reconciliation_reports')));

  await assertSucceeds(setDoc(doc(marketingA, 'marketing_campaigns', 'unit-a-campaign'), { unitId: 'unit-a' }));
  await assertFails(getDoc(doc(marketingB, 'marketing_campaigns', 'unit-a-campaign')));

  await assertSucceeds(setDoc(doc(receptionA, 'message_contact_lists', 'unit-a-list'), { unitId: 'unit-a' }));
  await assertFails(getDoc(doc(receptionB, 'message_contact_lists', 'unit-a-list')));
});

test('administrador mantém visão consolidada das unidades autorizadas globalmente', async () => {
  const admin = authDb('admin', 'ADMIN');
  const reports = await assertSucceeds(getDocs(collection(admin, 'reconciliation_reports')));
  const ids = reports.docs.map(item => item.id);
  assert.equal(ids.includes('unit-a-report'), true);
  assert.equal(ids.includes('unit-b-report'), true);
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

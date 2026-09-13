import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

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
      { id: 'manicure', role: 'MANICURE', unitId: 'unit-a' },
      { id: 'finance-b', role: 'FINANCIAL', unitId: 'unit-b' },
      { id: 'marketing-b', role: 'MARKETING', unitId: 'unit-b' },
      { id: 'reception-b', role: 'RECEPTION', unitId: 'unit-b' },
      { id: 'barber-b', role: 'BARBER', unitId: 'unit-b' },
      { id: 'manicure-b', role: 'MANICURE', unitId: 'unit-b' },
      { id: 'inactive-admin', role: 'ADMIN', unitId: 'unit-a', isActive: false },
    ]) {
      await setDoc(doc(db, 'users', profile.id), profile);
    }
    await setDoc(doc(db, 'auditLogs', 'seed'), { action: 'SEEDED_FOR_TEST' });
    await setDoc(doc(db, 'loginAudit', 'login-seed'), { userId: 'admin', action: 'login_sucesso', timestamp: new Date(0).toISOString() });
    await setDoc(doc(db, 'dataAudit', 'data-seed'), { userId: 'admin', action: 'alteracao_campo', timestamp: new Date(0).toISOString() });
    const closing = { id: 'cash_closing_unit-a_2026-09-10', unitId: 'unit-a', date: '2026-09-10', status: 'CLOSED', openingBalance: 0, cashIncome: 100, cashOutflow: 0, expectedBalance: 100, countedBalance: 100, difference: 0, closedAt: new Date(0).toISOString(), closedBy: 'finance' };
    await setDoc(doc(db, 'cashClosings', closing.id), closing);
    await setDoc(doc(db, 'financialPeriodLocks', 'unit-a_2026-09-10'), { unitId: 'unit-a', period: '2026-09-10', closingId: closing.id, active: true });
    await setDoc(doc(db, 'financialPeriodLocks', 'unit-a_2026-09'), { unitId: 'unit-a', period: '2026-09', closingId: closing.id, active: true });
    await setDoc(doc(db, 'smart_links', 'promo'), { unitId: 'unit-a', shortCode: 'promo', destinationUrl: 'https://example.com', totalClicks: 0, isActive: true });
    await setDoc(doc(db, 'smart_link_clicks', 'allowed'), { linkId: 'promo', unitId: 'unit-a', shortCode: 'promo', destinationUrl: 'https://example.com', phase: 'ACTIVE', timestamp: new Date(0).toISOString(), device: 'Desktop', simulated: false });
    await setDoc(doc(db, 'transactions', 'unit-a-transaction'), { unitId: 'unit-a', date: '2026-09-09', type: 'INCOME', status: 'RECEBIDO', amount: 100 });
    await setDoc(doc(db, 'marketing_campaigns', 'unit-a-campaign-seed'), { unitId: 'unit-a', name: 'Campanha A' });
    await setDoc(doc(db, 'message_contact_lists', 'unit-a-list-seed'), { unitId: 'unit-a', name: 'Lista A' });
    await setDoc(doc(db, 'entries', 'barber-entry'), { unitId: 'unit-a', userId: 'barber', date: '2026-09-09' });
    await setDoc(doc(db, 'entries', 'manicure-entry'), { unitId: 'unit-a', userId: 'manicure', date: '2026-09-09' });
    await setDoc(doc(db, 'notifications', 'admin-notification'), { userId: 'admin', title: 'Aviso da gerência', read: false });
    await setDoc(doc(db, 'notifications', 'finance-notification'), { userId: 'finance', title: 'Aviso financeiro', read: false });
  });
});

after(async () => environment?.cleanup());

const authDb = (uid: string, role: string) =>
  environment.authenticatedContext(uid, { role }).firestore();

test('matriz dos seis perfis aplica permissões reais por função', async () => {
  const admin = authDb('admin', 'ADMIN');
  const finance = authDb('finance', 'FINANCIAL');
  const marketing = authDb('marketing', 'MARKETING');
  const reception = authDb('reception', 'RECEPTION');
  const barber = authDb('barber', 'BARBER');
  const manicure = authDb('manicure', 'MANICURE');

  await assertSucceeds(getDoc(doc(admin, 'transactions', 'unit-a-transaction')));
  await assertSucceeds(getDoc(doc(finance, 'transactions', 'unit-a-transaction')));
  await assertFails(getDoc(doc(marketing, 'transactions', 'unit-a-transaction')));
  await assertSucceeds(getDoc(doc(marketing, 'marketing_campaigns', 'unit-a-campaign-seed')));
  await assertFails(getDoc(doc(reception, 'marketing_campaigns', 'unit-a-campaign-seed')));
  await assertSucceeds(getDoc(doc(reception, 'message_contact_lists', 'unit-a-list-seed')));
  await assertFails(getDoc(doc(barber, 'message_contact_lists', 'unit-a-list-seed')));
  await assertSucceeds(getDoc(doc(barber, 'entries', 'barber-entry')));
  await assertFails(getDoc(doc(barber, 'entries', 'manicure-entry')));
  await assertSucceeds(getDoc(doc(manicure, 'entries', 'manicure-entry')));
  await assertFails(getDoc(doc(manicure, 'entries', 'barber-entry')));
});

test('todos os perfis não administrativos permanecem isolados da outra unidade', async () => {
  for (const [uid, role, collectionName, documentId] of [
    ['finance-b', 'FINANCIAL', 'transactions', 'unit-a-transaction'],
    ['marketing-b', 'MARKETING', 'marketing_campaigns', 'unit-a-campaign-seed'],
    ['reception-b', 'RECEPTION', 'message_contact_lists', 'unit-a-list-seed'],
    ['barber-b', 'BARBER', 'entries', 'barber-entry'],
    ['manicure-b', 'MANICURE', 'entries', 'manicure-entry'],
  ] as const) {
    await assertFails(getDoc(doc(authDb(uid, role), collectionName, documentId)));
  }
});

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
  await assertFails(setDoc(doc(reception, 'message_dispatch_history', 'server-only'), { unitId: 'unit-a' }));
  await assertFails(setDoc(doc(reception, 'dispatch_audit', 'server-only'), { unitId: 'unit-a' }));
});

test('links inteligentes preservam resolução pública e restringem a gestão', async () => {
  const marketing = authDb('marketing', 'MARKETING');
  const barber = authDb('barber', 'BARBER');
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(marketing, 'smart_links', 'client-write-denied'), {
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
  await assertFails(setDoc(doc(marketing, 'smart_link_clicks', 'client-write-denied'), click));
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

test('usuário pode excluir a própria notificação sem acessar notificações alheias', async () => {
  const admin = authDb('admin', 'ADMIN');
  const finance = authDb('finance', 'FINANCIAL');

  await assertFails(deleteDoc(doc(admin, 'notifications', 'finance-notification')));
  await assertSucceeds(deleteDoc(doc(admin, 'notifications', 'admin-notification')));
  await assertSucceeds(deleteDoc(doc(finance, 'notifications', 'finance-notification')));
});

test('auditoria permite leitura administrativa, nega leitura comum e toda escrita cliente', async () => {
  const admin = authDb('admin', 'ADMIN');
  const barber = authDb('barber', 'BARBER');

  const snapshot = await assertSucceeds(getDoc(doc(admin, 'auditLogs', 'seed')));
  assert.equal(snapshot.exists(), true);
  await assertFails(getDoc(doc(barber, 'auditLogs', 'seed')));
  await assertFails(setDoc(doc(admin, 'auditLogs', 'client-write'), { action: 'INVALID' }));
});

test('novos históricos são legíveis somente pela gerência e imutáveis no cliente', async () => {
  const admin = authDb('admin', 'ADMIN');
  const finance = authDb('finance', 'FINANCIAL');
  for (const [collectionName, id] of [['loginAudit', 'login-seed'], ['dataAudit', 'data-seed']] as const) {
    await assertSucceeds(getDoc(doc(admin, collectionName, id)));
    await assertFails(getDoc(doc(finance, collectionName, id)));
    await assertFails(setDoc(doc(admin, collectionName, 'forged'), { action: 'forged' }));
    await assertFails(updateDoc(doc(admin, collectionName, id), { action: 'forged' }));
    await assertFails(deleteDoc(doc(admin, collectionName, id)));
  }
});

test('trilha financeira aceita inclusão atribuída ao autor e permanece imutável', async () => {
  const admin = authDb('admin', 'ADMIN');
  const finance = authDb('finance', 'FINANCIAL');
  const financeB = authDb('finance-b', 'FINANCIAL');
  const event = { actorAuthUid: 'finance', actorId: 'finance', actorName: 'Financeiro', actorRole: 'FINANCIAL', unitId: 'unit-a', occurredOn: '2026-09-11', createdAt: new Date().toISOString(), action: 'CREATED', entityType: 'TRANSACTION', entityId: 'transaction-1' };

  await assertSucceeds(setDoc(doc(finance, 'financialAuditEvents', 'event-1'), event));
  await assertSucceeds(getDoc(doc(admin, 'financialAuditEvents', 'event-1')));
  await assertFails(getDoc(doc(finance, 'financialAuditEvents', 'event-1')));
  await assertFails(setDoc(doc(financeB, 'financialAuditEvents', 'event-cross-unit'), { ...event, actorAuthUid: 'finance-b', actorId: 'finance-b' }));
  await assertFails(setDoc(doc(finance, 'financialAuditEvents', 'event-forged'), { ...event, actorAuthUid: 'admin', actorId: 'admin' }));
  await assertFails(updateDoc(doc(admin, 'financialAuditEvents', 'event-1'), { action: 'DELETED' }));
  await assertFails(deleteDoc(doc(admin, 'financialAuditEvents', 'event-1')));
});

test('coleções não inventariadas são negadas até para administrador', async () => {
  const admin = authDb('admin', 'ADMIN');
  await assertFails(setDoc(doc(admin, 'unknown_private_collection', 'item'), { value: 1 }));
  await assertFails(getDoc(doc(admin, 'unknown_private_collection', 'item')));
});

test('claims isoladas e perfis inativos não concedem privilégios', async () => {
  const missingProfile = authDb('claim-only-admin', 'ADMIN');
  const inactiveAdmin = authDb('inactive-admin', 'ADMIN');
  await assertFails(getDocs(collection(missingProfile, 'reconciliation_reports')));
  await assertFails(getDocs(collection(inactiveAdmin, 'reconciliation_reports')));
  await assertFails(setDoc(doc(missingProfile, 'systemUnits', 'forged'), { name: 'Forjada' }));
  await assertFails(setDoc(doc(inactiveAdmin, 'systemUnits', 'inactive'), { name: 'Inativa' }));
});

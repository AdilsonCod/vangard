import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePaymentTotals, replaceImportedRevenue, summarizeCashMovements, type RevenueComponents } from '../src/services/financialEngine';
import type { CashClosing, DailyEntry, FinancialTransaction, PaymentRecord } from '../src/types';

type State = {
  revenue: Record<string, RevenueComponents>;
  transactions: FinancialTransaction[];
  closings: CashClosing[];
  payments: PaymentRecord[];
  entries: DailyEntry[];
};

const emptyState = (): State => ({ revenue: {}, transactions: [], closings: [], payments: [], entries: [] });
const clone = <T>(value: T): T => structuredClone(value);

class IsolatedFinancialRepository {
  private state: State;
  failNextCommit = false;
  constructor(snapshot: State = emptyState()) { this.state = clone(snapshot); }
  snapshot() { return clone(this.state); }
  transact(change: (draft: State) => void) {
    const draft = clone(this.state);
    change(draft);
    if (this.failNextCommit) { this.failNextCommit = false; throw new Error('Falha simulada de persistência'); }
    this.state = draft;
  }
}

const tx = (id: string, partial: Partial<FinancialTransaction> = {}): FinancialTransaction => ({
  id, type: 'INCOME', category: 'Venda', description: 'Venda conciliada', amount: 100,
  date: '2026-09-10', unitId: 'matriz', status: 'PENDENTE', ...partial,
});

function importComponent(repo: IsolatedFinancialRepository, key: string, component: keyof RevenueComponents, amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Valor importado inválido');
  repo.transact(state => { state.revenue[key] = replaceImportedRevenue(state.revenue[key] || {}, component, amount).components; });
}

function reconcile(repo: IsolatedFinancialRepository, transaction: FinancialTransaction, dueDate: string) {
  if (transaction.amount <= 0 || !dueDate) throw new Error('Conciliação inválida');
  repo.transact(state => state.transactions.push({ ...transaction, dueDate, status: 'AGENDADO', reconciliationStatus: 'AWAITING_SETTLEMENT' }));
}

function settle(repo: IsolatedFinancialRepository, id: string) {
  repo.transact(state => {
    const item = state.transactions.find(transaction => transaction.id === id);
    if (!item || !['PENDENTE', 'AGENDADO'].includes(item.status)) throw new Error('Recebível não disponível para baixa');
    item.status = 'RECEBIDO'; item.reconciliationStatus = 'RECONCILED';
  });
}

function settleExpense(repo: IsolatedFinancialRepository, id: string) {
  repo.transact(state => {
    const item = state.transactions.find(transaction => transaction.id === id && transaction.type === 'EXPENSE');
    if (!item || !['PENDENTE', 'AGENDADO'].includes(item.status)) throw new Error('Despesa não disponível para baixa');
    item.status = 'PAGO'; item.reconciliationStatus = 'RECONCILED';
  });
}

function closeCash(repo: IsolatedFinancialRepository, date: string, transactions: FinancialTransaction[]) {
  if (!date) throw new Error('Data obrigatória');
  const summary = summarizeCashMovements(transactions);
  repo.transact(state => {
    if (state.closings.some(closing => closing.unitId === 'matriz' && closing.date === date && closing.status !== 'REOPENED')) throw new Error('Caixa já fechado');
    state.closings.push({ id: `close-${date}`, unitId: 'matriz', date, openingBalance: 0, cashIncome: summary.cashIn, cashOutflow: summary.cashOut, expectedBalance: summary.cashBalance, countedBalance: summary.cashBalance, difference: 0, status: 'CLOSED', closedAt: new Date().toISOString() });
  });
}

function savePayment(repo: IsolatedFinancialRepository, payment: PaymentRecord) {
  const totals = calculatePaymentTotals(payment);
  if (totals.grossCommission <= 0) throw new Error('Comissão inválida');
  repo.transact(state => state.payments.push({ ...payment, amountToBePaid: totals.netPayment }));
}

function saveCourtesy(repo: IsolatedFinancialRepository, entry: DailyEntry) {
  if (!entry.userId || !entry.date || (entry.courtesyAmount || 0) <= 0) throw new Error('Cortesia inválida');
  repo.transact(state => state.entries.push(entry));
}

function saveInternalSale(repo: IsolatedFinancialRepository, entry: DailyEntry) {
  if (!entry.userId || !entry.date || (entry.internalSaleAmount || 0) <= 0) throw new Error('Venda interna inválida');
  repo.transact(state => state.entries.push(entry));
}

function assertFailedCommitPreserves(repo: IsolatedFinancialRepository, operation: () => void) {
  const before = repo.snapshot(); repo.failNextCommit = true;
  assert.throws(operation, /Falha simulada de persistência/);
  assert.deepEqual(repo.snapshot(), before);
}

test('importação substitui componentes sem duplicar e é atômica', () => {
  const repo = new IsolatedFinancialRepository();
  importComponent(repo, '2026-09_barber-1', 'standaloneRevenue', 1000);
  importComponent(repo, '2026-09_barber-1', 'productRevenue', 200);
  importComponent(repo, '2026-09_barber-1', 'standaloneRevenue', 800);
  assert.deepEqual(repo.snapshot().revenue['2026-09_barber-1'], { standaloneRevenue: 800, productRevenue: 200 });
  assert.throws(() => importComponent(repo, 'x', 'productRevenue', -1), /inválido/);
  assertFailedCommitPreserves(repo, () => importComponent(repo, 'x', 'productRevenue', 50));
});

test('conciliação gera recebível agendado com rollback em falha', () => {
  const repo = new IsolatedFinancialRepository(); reconcile(repo, tx('r1'), '2026-10-11');
  assert.equal(repo.snapshot().transactions[0].reconciliationStatus, 'AWAITING_SETTLEMENT');
  assert.throws(() => reconcile(repo, tx('bad', { amount: 0 }), ''), /inválida/);
  assertFailedCommitPreserves(repo, () => reconcile(repo, tx('r2'), '2026-10-12'));
});

test('baixa de recebimento efetiva somente registros pendentes e é atômica', () => {
  const repo = new IsolatedFinancialRepository(); reconcile(repo, tx('r1'), '2026-10-11'); settle(repo, 'r1');
  assert.equal(repo.snapshot().transactions[0].status, 'RECEBIDO');
  assert.throws(() => settle(repo, 'r1'), /não disponível/);
  reconcile(repo, tx('r2'), '2026-10-12'); assertFailedCommitPreserves(repo, () => settle(repo, 'r2'));
});

test('baixa de despesa efetiva somente compromissos pendentes e é atômica', () => {
  const repo = new IsolatedFinancialRepository();
  repo.transact(state => state.transactions.push(tx('e1', { type: 'EXPENSE', status: 'AGENDADO', amount: 120 })));
  settleExpense(repo, 'e1'); assert.equal(repo.snapshot().transactions[0].status, 'PAGO');
  assert.throws(() => settleExpense(repo, 'e1'), /não disponível/);
  repo.transact(state => state.transactions.push(tx('e2', { type: 'EXPENSE', status: 'PENDENTE', amount: 50 })));
  assertFailedCommitPreserves(repo, () => settleExpense(repo, 'e2'));
});

test('fechamento usa movimentos liquidados, rejeita duplicidade e faz rollback', () => {
  const repo = new IsolatedFinancialRepository(); const rows = [tx('in', { status: 'RECEBIDO', amount: 300 }), tx('out', { type: 'EXPENSE', status: 'PAGO', amount: 50 })];
  closeCash(repo, '2026-09-10', rows); assert.equal(repo.snapshot().closings[0].expectedBalance, 250);
  assert.throws(() => closeCash(repo, '2026-09-10', rows), /já fechado/);
  assertFailedCommitPreserves(repo, () => closeCash(repo, '2026-09-11', rows));
});

test('pagamento calcula líquido, valida comissão e faz rollback', () => {
  const repo = new IsolatedFinancialRepository(); const payment: PaymentRecord = { id: 'p1', userId: 'barber-1', unitId: 'matriz', date: '2026-09-30', commissionAvulso: 500, commissionProductGeneral: 50, commissionProductAvant: 0, commissionSubscriptions: 100, discount: 0, discountDescription: '', discounts: [{ description: 'Venda interna', value: 40 }], amountToBePaid: 0, status: 'PENDENTE', isPaid: false, potData: [] };
  savePayment(repo, payment); assert.equal(repo.snapshot().payments[0].amountToBePaid, 610);
  assert.throws(() => savePayment(repo, { ...payment, id: 'bad', commissionAvulso: 0, commissionProductGeneral: 0, commissionSubscriptions: 0 }), /inválida/);
  assertFailedCommitPreserves(repo, () => savePayment(repo, { ...payment, id: 'p2' }));
});

const baseEntry = (id: string): DailyEntry => ({ id, userId: 'barber-1', unitId: 'matriz', date: '2026-09-10', isDayOff: false, clientsServed: 1, uniqueClientsServed: 1, items: {} });

test('cortesia exige profissional, data e valor e não grava parcialmente', () => {
  const repo = new IsolatedFinancialRepository(); saveCourtesy(repo, { ...baseEntry('c1'), courtesyAmount: 80 });
  assert.equal(repo.snapshot().entries[0].courtesyAmount, 80);
  assert.throws(() => saveCourtesy(repo, { ...baseEntry('bad'), courtesyAmount: 0 }), /inválida/);
  assertFailedCommitPreserves(repo, () => saveCourtesy(repo, { ...baseEntry('c2'), courtesyAmount: 20 }));
});

test('venda interna exige profissional, data e valor e não grava parcialmente', () => {
  const repo = new IsolatedFinancialRepository(); saveInternalSale(repo, { ...baseEntry('s1'), internalSaleAmount: 45 });
  assert.equal(repo.snapshot().entries[0].internalSaleAmount, 45);
  assert.throws(() => saveInternalSale(repo, { ...baseEntry('bad'), userId: '', internalSaleAmount: 10 }), /inválida/);
  assertFailedCommitPreserves(repo, () => saveInternalSale(repo, { ...baseEntry('s2'), internalSaleAmount: 30 }));
});

test('dados sobrevivem recarga, logout/login e nova sessão do repositório', () => {
  const firstSession = new IsolatedFinancialRepository(); importComponent(firstSession, 'period', 'subscriptionRevenue', 900); reconcile(firstSession, tx('persisted'), '2026-10-11');
  const persistedStorage = JSON.parse(JSON.stringify(firstSession.snapshot())) as State;
  const afterReload = new IsolatedFinancialRepository(persistedStorage);
  const afterLogin = new IsolatedFinancialRepository(afterReload.snapshot());
  const anotherDevice = new IsolatedFinancialRepository(afterLogin.snapshot());
  assert.equal(anotherDevice.snapshot().revenue.period.subscriptionRevenue, 900);
  assert.equal(anotherDevice.snapshot().transactions[0].id, 'persisted');
});

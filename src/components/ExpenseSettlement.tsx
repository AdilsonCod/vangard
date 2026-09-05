import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  DollarSign,
  Filter,
  ReceiptText,
  Scissors,
  Square,
} from 'lucide-react';
import { useStore } from '../store';
import { FinancialTransaction, PaymentRecord } from '../types';

type ScheduledExpense = {
  key: string;
  source: 'TRANSACTION' | 'COMMISSION';
  transaction?: FinancialTransaction;
  payment?: PaymentRecord;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  unitId: string;
  status: 'PENDENTE' | 'AGENDADO';
  supplier?: string;
};

const formatDate = (date: string) => date.split('-').reverse().join('/');
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ExpenseSettlement() {
  const {
    transactions,
    payments,
    users,
    systemUnits,
    updateTransaction,
    updatePayment,
    addTransaction,
  } = useStore();
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const expenses = useMemo<ScheduledExpense[]>(() => {
    const scheduledTransactions: ScheduledExpense[] = transactions
      .filter(transaction => transaction.type === 'EXPENSE' && (transaction.status === 'PENDENTE' || transaction.status === 'AGENDADO'))
      .map(transaction => ({
        key: `transaction:${transaction.id}`,
        source: 'TRANSACTION',
        transaction,
        description: transaction.description,
        category: transaction.category || 'Outras despesas',
        amount: transaction.amount,
        dueDate: transaction.dueDate || transaction.date,
        unitId: transaction.unitId,
        status: transaction.status as 'PENDENTE' | 'AGENDADO',
        supplier: transaction.supplier,
      }));

    const scheduledCommissions: ScheduledExpense[] = payments
      .filter(payment => payment.status !== 'PAGO' && !payment.isPaid && payment.amountToBePaid > 0)
      .map(payment => {
        const barber = users.find(user => user.id === payment.userId);
        return {
          key: `commission:${payment.id}`,
          source: 'COMMISSION',
          payment,
          description: `Comissão - ${barber?.name || 'Profissional não identificado'}`,
          category: 'Comissões',
          amount: payment.amountToBePaid,
          dueDate: payment.date,
          unitId: barber?.unit || 'ALL',
          status: payment.status === 'AGENDADO' ? 'AGENDADO' : 'PENDENTE',
          supplier: barber?.name,
        };
      });

    return [...scheduledTransactions, ...scheduledCommissions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [payments, transactions, users]);

  const categories = useMemo(() => Array.from(new Set(expenses.map(expense => expense.category))).sort(), [expenses]);

  const filteredExpenses = useMemo(() => expenses.filter(expense =>
    (filterUnit === 'ALL' || expense.unitId === filterUnit) &&
    (filterCategory === 'ALL' || expense.category === filterCategory)
  ), [expenses, filterCategory, filterUnit]);

  const groups = useMemo(() => {
    const byDate = new Map<string, ScheduledExpense[]>();
    filteredExpenses.forEach(expense => {
      const group = byDate.get(expense.dueDate) || [];
      group.push(expense);
      byDate.set(expense.dueDate, group);
    });
    return Array.from(byDate.entries()).map(([date, items]) => ({
      date,
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredExpenses]);

  const totals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      overdue: filteredExpenses.filter(expense => expense.dueDate < today).reduce((sum, expense) => sum + expense.amount, 0),
      scheduled: filteredExpenses.filter(expense => expense.status === 'AGENDADO').reduce((sum, expense) => sum + expense.amount, 0),
      commissions: filteredExpenses.filter(expense => expense.source === 'COMMISSION').reduce((sum, expense) => sum + expense.amount, 0),
    };
  }, [filteredExpenses]);

  const selectedExpenses = useMemo(() => expenses.filter(expense => selectedKeys.has(expense.key)), [expenses, selectedKeys]);
  const selectedTotal = selectedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const toggleExpansion = (date: string) => {
    setExpandedDates(current => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleExpense = (key: string) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (items: ScheduledExpense[]) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      const allSelected = items.every(item => next.has(item.key));
      items.forEach(item => allSelected ? next.delete(item.key) : next.add(item.key));
      return next;
    });
  };

  const openSettlement = (items?: ScheduledExpense[]) => {
    if (items) setSelectedKeys(new Set(items.map(item => item.key)));
    setSettlementDate(new Date().toISOString().split('T')[0]);
    setFeedback(null);
    setIsSettlementOpen(true);
  };

  const handleSettlement = async () => {
    if (selectedExpenses.length === 0 || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      for (const expense of selectedExpenses) {
        if (expense.source === 'TRANSACTION' && expense.transaction) {
          await updateTransaction({
            ...expense.transaction,
            status: 'PAGO',
            date: settlementDate,
            reconciliationStatus: expense.transaction.reconciliationStatus || 'NOT_APPLICABLE',
          });
          continue;
        }

        if (expense.source === 'COMMISSION' && expense.payment) {
          const payment = expense.payment;
          const paidPayment: PaymentRecord = { ...payment, status: 'PAGO', isPaid: true };
          await updatePayment(paidPayment);
          await addTransaction({
            id: `commission_payment_${payment.id}`,
            type: 'EXPENSE',
            category: 'Comissões',
            description: `${expense.description} - ${formatDate(settlementDate)}`,
            amount: expense.amount,
            date: settlementDate,
            dueDate: payment.date,
            unitId: expense.unitId,
            status: 'PAGO',
            supplier: expense.supplier,
            classification: 'COMISSOES',
            sourceChannel: 'OTHER',
            paymentMethod: 'OTHER',
            movementNature: 'EXPENSE',
            reconciliationStatus: 'NOT_APPLICABLE',
            sourceReference: payment.id,
          });
        }
      }

      const settledCount = selectedExpenses.length;
      setSelectedKeys(new Set());
      setIsSettlementOpen(false);
      setFeedback(`${settledCount} despesa(s) baixada(s) e registrada(s) no Caixa.`);
    } catch (error) {
      console.error('Erro ao baixar despesas:', error);
      setFeedback('Não foi possível concluir todas as baixas. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-600">Contas a pagar</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white">
              <ReceiptText className="h-6 w-6 text-red-500" /> Baixa de Despesas
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Boletos, compras de insumos, comissões e demais pagamentos agendados.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <Filter className="h-4 w-4 text-gray-400" />
              <select value={filterUnit} onChange={event => setFilterUnit(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none">
                <option value="ALL">Todas as unidades</option>
                {systemUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <select value={filterCategory} onChange={event => setFilterCategory(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-800 lg:w-auto">
              <option value="ALL">Todas as categorias</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <button type="button" onClick={() => openSettlement()} disabled={selectedKeys.size === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:w-auto">
              <CheckSquare className="h-4 w-4" /> Dar baixa ({selectedKeys.size})
            </button>
          </div>
        </div>
      </section>

      {feedback && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">{feedback}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total pendente', value: totals.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Despesas atrasadas', value: totals.overdue, color: 'text-red-600 dark:text-red-400' },
          { label: 'Pagamentos agendados', value: totals.scheduled, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Comissões pendentes', value: totals.commissions, color: 'text-amber-600 dark:text-amber-400' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">{card.label}</p>
            <p className={`mt-1 text-xl font-black ${card.color}`}>{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-zinc-800">
          <h3 className="font-black text-gray-900 dark:text-white">Vencimentos agrupados por data</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Abra uma data para conferir os detalhes ou faça a baixa do lote inteiro.</p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-zinc-800 lg:hidden">
          {groups.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-500">Nenhuma despesa pendente ou agendada.</p>
          ) : groups.map(group => {
            const expanded = expandedDates.has(group.date);
            const allSelected = group.items.every(item => selectedKeys.has(item.key));
            const overdue = group.date < today;
            return (
              <article key={group.date} className="p-4">
                <button type="button" onClick={() => toggleExpansion(group.date)} className="block w-full rounded-xl text-left" aria-expanded={expanded}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-sm font-black text-gray-900 dark:text-white">{formatDate(group.date)}</span>
                      <span className="mt-1 block text-xs text-gray-500">{group.items.length} {group.items.length === 1 ? 'despesa' : 'despesas'} neste lote</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>
                        {overdue ? 'Vencido' : 'Programado'}
                      </span>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
                    </span>
                  </span>
                  <span className="mt-4 flex items-end justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-zinc-800/60">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Total do lote</span>
                    <span className="whitespace-nowrap text-lg font-black text-red-600 dark:text-red-400">{formatCurrency(group.total)}</span>
                  </span>
                </button>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => toggleGroup(group.items)} className={`min-w-0 rounded-xl border px-3 py-2.5 text-xs font-black ${allSelected ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300' : 'border-gray-200 text-gray-600 dark:border-zinc-700 dark:text-zinc-300'}`}>
                    {allSelected ? 'Selecionado' : 'Selecionar lote'}
                  </button>
                  <button type="button" onClick={() => openSettlement(group.items)} className="min-w-0 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-black text-white hover:bg-red-700">Dar baixa</button>
                </div>

                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-zinc-800">
                    {group.items.map(expense => {
                      const selected = selectedKeys.has(expense.key);
                      const unitName = expense.unitId === 'ALL' ? 'Todas as unidades' : systemUnits.find(unit => unit.id === expense.unitId)?.name || expense.unitId;
                      return (
                        <button key={expense.key} type="button" onClick={() => toggleExpense(expense.key)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20' : 'border-gray-100 bg-gray-50/60 dark:border-zinc-800 dark:bg-zinc-950/30'}`}>
                          {selected ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2 text-sm font-bold text-gray-900 dark:text-white">
                              {expense.source === 'COMMISSION' ? <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> : <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
                              <span className="min-w-0 break-words">{expense.description}</span>
                            </span>
                            <span className="mt-1 block break-words text-[11px] text-gray-500">{expense.category}{expense.supplier ? ` · ${expense.supplier}` : ''}</span>
                            <span className="mt-1 block break-words text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{unitName}</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-sm font-black text-red-600 dark:text-red-400">{formatCurrency(expense.amount)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] table-fixed text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <tr>
                <th className="w-14 px-4 py-3"></th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="w-32 px-4 py-3 text-center">Itens</th>
                <th className="w-48 px-4 py-3 text-right">Total</th>
                <th className="w-40 px-4 py-3 text-center">Situação</th>
                <th className="w-52 px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {groups.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-500">Nenhuma despesa pendente ou agendada.</td></tr>
              ) : groups.map(group => {
                const expanded = expandedDates.has(group.date);
                const allSelected = group.items.every(item => selectedKeys.has(item.key));
                const overdue = group.date < today;
                return (
                  <React.Fragment key={group.date}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => toggleExpansion(group.date)} aria-label="Mostrar despesas" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => toggleExpansion(group.date)} className="text-left">
                          <span className="block font-black text-gray-900 dark:text-white">{formatDate(group.date)}</span>
                          <span className="text-[11px] text-gray-500">Clique para abrir o lote</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-black">{group.items.length}</td>
                      <td className="px-4 py-3 text-right text-base font-black text-red-600 dark:text-red-400">{formatCurrency(group.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${overdue ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'}`}>
                          {overdue ? 'Vencido' : 'Programado'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => toggleGroup(group.items)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-black ${allSelected ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300' : 'border-gray-200 text-gray-600 dark:border-zinc-700 dark:text-zinc-300'}`}>{allSelected ? 'Selecionado' : 'Selecionar'}</button>
                          <button type="button" onClick={() => openSettlement(group.items)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-700">Dar baixa</button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50/70 p-0 dark:bg-zinc-950/30">
                          <div className="border-l-4 border-red-400 px-5 py-3">
                            <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                              {group.items.map(expense => {
                                const selected = selectedKeys.has(expense.key);
                                const unitName = expense.unitId === 'ALL' ? 'Todas as unidades' : systemUnits.find(unit => unit.id === expense.unitId)?.name || expense.unitId;
                                return (
                                  <button key={expense.key} type="button" onClick={() => toggleExpense(expense.key)} className="grid w-full grid-cols-[32px_minmax(0,1fr)_150px_140px] items-center gap-3 py-3 text-left hover:bg-white/70 dark:hover:bg-zinc-800/50">
                                    {selected ? <CheckSquare className="h-4 w-4 text-red-500" /> : <Square className="h-4 w-4 text-gray-400" />}
                                    <span className="min-w-0">
                                      <span className="flex items-center gap-2 truncate text-sm font-bold text-gray-900 dark:text-white">
                                        {expense.source === 'COMMISSION' ? <Scissors className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <ReceiptText className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                                        {expense.description}
                                      </span>
                                      <span className="block truncate text-[11px] text-gray-500">{expense.category}{expense.supplier ? ` · ${expense.supplier}` : ''}</span>
                                    </span>
                                    <span className="truncate text-xs font-semibold text-gray-500 dark:text-zinc-400">{unitName}</span>
                                    <span className="text-right text-sm font-black text-red-600 dark:text-red-400">{formatCurrency(expense.amount)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isSettlementOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsSettlementOpen(false)}>
          <div role="dialog" aria-modal="true" onClick={event => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="bg-red-600 p-5 text-white">
              <h3 className="flex items-center gap-2 text-lg font-black"><CheckCircle className="h-5 w-5" /> Confirmar baixa de despesas</h3>
              <p className="mt-1 text-sm text-red-100">{selectedExpenses.length} item(ns) · {formatCurrency(selectedTotal)}</p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase text-gray-500 dark:text-zinc-400">Data efetiva do pagamento</span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <input type="date" value={settlementDate} onChange={event => setSettlementDate(event.target.value)} className="flex-1 bg-transparent text-sm font-bold outline-none" />
                </div>
              </label>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-zinc-800/60">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Quantidade</span><strong>{selectedExpenses.length}</strong></div>
                <div className="mt-2 flex justify-between text-base"><span className="font-bold">Total da baixa</span><strong className="text-red-600 dark:text-red-400">{formatCurrency(selectedTotal)}</strong></div>
              </div>
              <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> As despesas serão marcadas como pagas e registradas no Caixa na data informada.</p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-800/30 sm:flex-row">
              <button type="button" onClick={() => setIsSettlementOpen(false)} className="w-full flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold dark:border-zinc-700">Cancelar</button>
              <button type="button" onClick={handleSettlement} disabled={isSaving} className="w-full flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">{isSaving ? 'Salvando...' : 'Confirmar baixa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

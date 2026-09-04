import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  Edit2, Filter, Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart, Line
} from 'recharts';
import { FinancialTransaction } from '../types';
import { BankReconciliation } from './BankReconciliation';
import { ReceivablesReconciliation } from './ReceivablesReconciliation';
import { FintechReconciliation } from './FintechReconciliation';
import { getLatestFinancialPeriod } from '../utils/financialPeriods';

export function FinancialDashboard({ currentTab = 'RESUMO' }: { currentTab?: 'RESUMO' | 'CAIXA' | 'CONCILIACAO' | 'RECEBIMENTOS' | 'CONCILIACAO_FINTECH' }) {
  const { entries, payments, gdvEntries, monthlyBarberStats, users, systemUnits, transactions, addTransaction, updateTransaction, deleteTransaction } = useStore();
  
  const activeTab = currentTab;
  
  // Date selection
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  
  const monthStr = `${selectedYear}-${selectedMonth}`;
  const hasAutoSelectedTransactionPeriod = useRef(false);

  const selectFinancialPeriod = (period: string) => {
    const [year, month] = period.split('-');
    if (!year || !month) return;
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const handleFintechSettlement = (dates: string[]) => {
    const latestPeriod = getLatestFinancialPeriod(dates.map(date => ({ date })));
    if (latestPeriod) {
      selectFinancialPeriod(latestPeriod);
      hasAutoSelectedTransactionPeriod.current = true;
    }
  };

  const [conciliacaoSubTab, setConciliacaoSubTab] = useState<'FINTECH' | 'OFX'>('FINTECH');

  // List Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterSubclass, setFilterSubclass] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (
      activeTab !== 'CAIXA' ||
      hasAutoSelectedTransactionPeriod.current ||
      filterDateFrom ||
      filterDateTo ||
      transactions.length === 0
    ) {
      return;
    }

    if (transactions.some(transaction => transaction.date?.startsWith(monthStr))) {
      hasAutoSelectedTransactionPeriod.current = true;
      return;
    }

    const latestPeriod = getLatestFinancialPeriod(transactions);
    if (latestPeriod) selectFinancialPeriod(latestPeriod);
    hasAutoSelectedTransactionPeriod.current = true;
  }, [activeTab, filterDateFrom, filterDateTo, monthStr, transactions]);

  // Transaction form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transForms, setTransForms] = useState<Partial<FinancialTransaction>[]>([{
    type: 'EXPENSE',
    category: '',
    description: '',
    amount: 0,
    unitId: 'ALL',
    status: 'PENDENTE',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'NONE',
    installments: 1,
    supplier: '',
    classification: '',
    subclassification: ''
  }]);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'INCOME'|'EXPENSE'>('EXPENSE');
  const [newCategoryBank, setNewCategoryBank] = useState('');
  const [newCategoryAgency, setNewCategoryAgency] = useState('');
  const [newCategoryAccount, setNewCategoryAccount] = useState('');
  const [newCategoryPix, setNewCategoryPix] = useState('');

  const { financialCategories, addFinancialCategory, deleteFinancialCategory, suppliers, addSupplier, deleteSupplier, finClassifications, addFinClassification, deleteFinClassification, finSubclassifications, addFinSubclassification, deleteFinSubclassification } = useStore();
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassType, setNewClassType] = useState<'INCOME'|'EXPENSE'>('EXPENSE');
  const [newSubclassName, setNewSubclassName] = useState('');
  const [selectedClassForSub, setSelectedClassForSub] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const handleAddRow = () => {
    setTransForms([...transForms, {
      type: 'EXPENSE',
      category: '',
      description: '',
      amount: 0,
      unitId: 'ALL',
      status: 'PENDENTE',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      recurrence: 'NONE',
      installments: 1,
      supplier: '',
      classification: '',
      subclassification: ''
    }]);
  };

  const handleRemoveRow = (index: number) => {
    setTransForms(transForms.filter((_, i) => i !== index));
  };

  const handleSaveTransaction = async () => {
    for (const transForm of transForms) {
      if (!transForm.category || !transForm.amount) {
        alert('Por favor, preencha o tipo de conta bancária e o valor.');
        return;
      }
      
      const installments = (transForm.recurrence !== 'NONE' && transForm.installments && transForm.installments > 1) ? transForm.installments : 1;
      
      for (let i = 0; i < installments; i++) {
        const id = (editingId && installments === 1) ? editingId : `trans_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
        
        let nextDate = transForm.date || new Date().toISOString().split('T')[0];
        let nextDueDate = transForm.dueDate || new Date().toISOString().split('T')[0];
        
        if (i > 0) {
          const [y, m, d] = nextDate.split('-').map(Number);
          const dObj = new Date(y, m - 1, d);
          
          const [y2, m2, d2] = nextDueDate.split('-').map(Number);
          const dObj2 = new Date(y2, m2 - 1, d2);
          
          if (transForm.recurrence === 'MONTHLY') {
            dObj.setMonth(dObj.getMonth() + i);
            dObj2.setMonth(dObj2.getMonth() + i);
          } else if (transForm.recurrence === 'WEEKLY') {
            dObj.setDate(dObj.getDate() + (i * 7));
            dObj2.setDate(dObj2.getDate() + (i * 7));
          } else if (transForm.recurrence === 'CUSTOM') {
            const customValue = transForm.customIntervalValue || 1;
            if (transForm.customIntervalType === 'DAYS') {
              dObj.setDate(dObj.getDate() + (i * customValue));
              dObj2.setDate(dObj2.getDate() + (i * customValue));
            } else if (transForm.customIntervalType === 'WEEKS') {
              dObj.setDate(dObj.getDate() + (i * customValue * 7));
              dObj2.setDate(dObj2.getDate() + (i * customValue * 7));
            } else if (transForm.customIntervalType === 'MONTHS') {
              dObj.setMonth(dObj.getMonth() + (i * customValue));
              dObj2.setMonth(dObj2.getMonth() + (i * customValue));
            }
          }

          nextDate = dObj.getFullYear() + '-' + String(dObj.getMonth()+1).padStart(2, '0') + '-' + String(dObj.getDate()).padStart(2, '0');
          nextDueDate = dObj2.getFullYear() + '-' + String(dObj2.getMonth()+1).padStart(2, '0') + '-' + String(dObj2.getDate()).padStart(2, '0');
        }

        let desc = transForm.description || transForm.category;
        if (installments > 1) {
          desc = `${desc} (${i + 1}/${installments})`;
        }
        
        const t: any = {
          id,
          type: transForm.type as 'INCOME' | 'EXPENSE',
          category: transForm.category,
          description: desc,
          amount: Number(transForm.amount),
          date: nextDate,
          dueDate: nextDueDate,
          unitId: transForm.unitId as string,
          status: transForm.status as 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'AGENDADO',
          recurrence: installments > 1 ? transForm.recurrence : 'NONE',
          installments: installments > 1 ? installments : 1,
          installmentIndex: installments > 1 ? i + 1 : 1,
          customIntervalType: transForm.customIntervalType || null,
          customIntervalValue: transForm.customIntervalValue || null,
          supplier: transForm.supplier || '',
          classification: transForm.classification || '',
          subclassification: transForm.subclassification || ''
        };
        
        // Remove undefined keys to prevent Firestore unsupported field value errors
        Object.keys(t).forEach(key => t[key] === undefined && delete t[key]);
        
        if (editingId && installments === 1) {
          await updateTransaction(t);
        } else {
          await addTransaction(t);
        }
      }
    }
    
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleEdit = (t: FinancialTransaction) => {
    setTransForms([{...t}]);
    setEditingId(t.id);
    setIsModalOpen(true);
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    await addFinClassification({ id: `class_${Date.now()}`, name: newClassName.trim(), type: newClassType });
    setNewClassName('');
  };
  const handleAddSubclass = async () => {
    if (!newSubclassName.trim() || !selectedClassForSub) return;
    await addFinSubclassification({ id: `subclass_${Date.now()}`, name: newSubclassName.trim(), classificationId: selectedClassForSub });
    setNewSubclassName('');
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    await addSupplier({
      id: `sup_${Date.now()}`,
      name: newSupplierName.trim()
    });
    setNewSupplierName('');
    setIsSupplierModalOpen(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addFinancialCategory({
      id: `cat_${Date.now()}`,
      name: newCategoryName.trim(),
      type: newCategoryType,
      bankName: newCategoryBank.trim() || undefined,
      agency: newCategoryAgency.trim() || undefined,
      accountNumber: newCategoryAccount.trim() || undefined,
      pixKey: newCategoryPix.trim() || undefined,
    });
    setNewCategoryName('');
    setNewCategoryBank('');
    setNewCategoryAgency('');
    setNewCategoryAccount('');
    setNewCategoryPix('');
    setIsCategoryModalOpen(false);
  };


  const caixaTransactions = useMemo(() => {
    let filtered = transactions || [];

    if (filterDateFrom || filterDateTo) {
      if (filterDateFrom) filtered = filtered.filter(t => t.date >= filterDateFrom);
      if (filterDateTo) filtered = filtered.filter(t => t.date <= filterDateTo);
    } else {
      filtered = filtered.filter(t => t.date && t.date.startsWith(monthStr));
    }

    if (filterType !== 'ALL') filtered = filtered.filter(t => t.type === filterType);
    if (filterStatus !== 'ALL') filtered = filtered.filter(t => t.status === filterStatus);
    if (filterAccount !== 'ALL') filtered = filtered.filter(t => t.category === filterAccount);
    if (filterUnit !== 'ALL') filtered = filtered.filter(t => t.unitId === filterUnit);
    if (filterSupplier !== 'ALL') filtered = filtered.filter(t => t.supplier === filterSupplier);
    if (filterClass !== 'ALL') filtered = filtered.filter(t => t.classification === filterClass);
    if (filterSubclass !== 'ALL') filtered = filtered.filter(t => t.subclassification === filterSubclass);

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, filterStatus, filterAccount, filterUnit, filterSupplier, filterClass, filterSubclass, filterDateFrom, filterDateTo, monthStr]);

  // Process data for the selected month
  const { 
    totalFaturamento, 
    totalPago, 
    totalPendente,
    unitData,
    expenses,
    incomes,
    monthTransactions,
    accountBalances,
    expensesByClass,
    dailyCashFlow
  } = useMemo(() => {
    

    // 1. Total Revenue (Faturamento Geral)
    const statsForMonth = monthlyBarberStats.filter(s => s.month === monthStr);
    let faturamento = 0;
    
    const unitMap = new Map<string, { faturamento: number; pagamentos: number; expenses: number }>();
    (systemUnits || []).forEach(u => {
      unitMap.set(u.id, { faturamento: 0, pagamentos: 0, expenses: 0 });
    });

    statsForMonth.forEach(s => {
      faturamento += s.faturamentoTotal || 0;
      
      const barber = users.find(u => u.id === s.barberId);
      if (barber && barber.unit && unitMap.has(barber.unit)) {
        unitMap.get(barber.unit)!.faturamento += s.faturamentoTotal || 0;
      }
    });

    // 2. Payments (Pagamentos Feitos e Pendentes)
    const paymentsForMonth = payments.filter(p => p.date && p.date.startsWith(monthStr));
    let pago = 0;
    let pendente = 0;

    paymentsForMonth.forEach(p => {
      const barber = users.find(u => u.id === p.userId);
      const val = p.amountToBePaid || 0;
      
      if (p.status === 'PAGO') {
        pago += val;
      } else {
        pendente += val;
      }

      if (barber && barber.unit && unitMap.has(barber.unit) && p.status === 'PAGO') {
        unitMap.get(barber.unit)!.pagamentos += val;
      }
    });

    // 3. Transactions for the month
    const mTrans = (transactions || []).filter(t => t.date && t.date.startsWith(monthStr));
    let tExpenses = 0;
    let tIncomes = 0;
    
    mTrans.forEach(t => {
      if (t.type === 'EXPENSE') {
        tExpenses += t.amount;
        if (t.unitId !== 'ALL' && unitMap.has(t.unitId)) {
          unitMap.get(t.unitId)!.expenses += t.amount;
        }
      } else {
        tIncomes += t.amount;
      }
    });

    const unitsArray = Array.from(unitMap.entries()).map(([id, data]) => {
      const u = systemUnits?.find(unit => unit.id === id);
      return {
        name: u?.name || 'Geral',
        faturamento: data.faturamento,
        pagamentos: data.pagamentos,
        expenses: data.expenses,
        lucroBruto: data.faturamento - data.pagamentos - data.expenses
      };
    });

    // Calculate Account Balances (All time up to now)
    const accBalances = new Map<string, number>();
    transactions.forEach(t => {
      if (t.status === 'PAGO' || t.status === 'RECEBIDO') {
        if (!accBalances.has(t.category)) accBalances.set(t.category, 0);
        let curr = accBalances.get(t.category) || 0;
        if (t.type === 'INCOME') curr += t.amount;
        else curr -= t.amount;
        accBalances.set(t.category, curr);
      }
    });

    const accountBalancesArray = Array.from(accBalances.entries()).map(([name, balance]) => {
      const cat = financialCategories.find(c => c.name === name);
      return { name, balance, bankName: cat?.bankName, agency: cat?.agency, account: cat?.accountNumber, pix: cat?.pixKey };
    }).sort((a, b) => b.balance - a.balance);

    // Calculate Expenses by Classification (Selected Month)
    const expClassMap = new Map<string, number>();
    mTrans.forEach(t => {
      if (t.type === 'EXPENSE' && t.status === 'PAGO') {
        const clsName = finClassifications.find(c => c.id === t.classification)?.name || 'Sem Classificação';
        expClassMap.set(clsName, (expClassMap.get(clsName) || 0) + t.amount);
      }
    });
    const expensesByClassArray = Array.from(expClassMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // 4. Fluxo de Caixa Diário (Entradas vs Saídas)
    const [year, month] = monthStr.split('-');
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    
    const dailyMap = new Map<string, { dia: string, entradas: number, saidas: number, previsaoEntradas: number, previsaoSaidas: number }>();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const d = String(i).padStart(2, '0');
      dailyMap.set(d, { dia: d, entradas: 0, saidas: 0, previsaoEntradas: 0, previsaoSaidas: 0 });
    }

    (gdvEntries || []).filter(g => g.date.startsWith(monthStr)).forEach(g => {
      const day = g.date.split('-')[2];
      if (dailyMap.has(day)) {
        let faturamentoDia = 0;
        Object.values(g.units || {}).forEach(u => {
          faturamentoDia += (u.servicos || 0) + (u.produtos || 0) + (u.assinaturas || 0);
        });
        faturamentoDia += (g.recorrencia || 0);
        dailyMap.get(day)!.entradas += faturamentoDia;
      }
    });

    (transactions || []).forEach(t => {
      const dateToUse = (t.status === 'PAGO' || t.status === 'RECEBIDO') ? t.date : (t.dueDate || t.date);
      if (dateToUse && dateToUse.startsWith(monthStr)) {
        const day = dateToUse.split('-')[2];
        if (dailyMap.has(day)) {
          const dayData = dailyMap.get(day)!;
          if (t.type === 'INCOME') {
            if (t.status === 'RECEBIDO') dayData.entradas += t.amount;
            else dayData.previsaoEntradas += t.amount;
          } else {
            if (t.status === 'PAGO') dayData.saidas += t.amount;
            else dayData.previsaoSaidas += t.amount;
          }
        }
      }
    });

    paymentsForMonth.forEach(p => {
      const day = (p.date && p.date.length >= 10) ? p.date.split('-')[2] : '01'; // Fallback to 01 if just YYYY-MM
      if (dailyMap.has(day)) {
        const dayData = dailyMap.get(day)!;
        if (p.status === 'PAGO') dayData.saidas += (p.amountToBePaid || 0);
        else dayData.previsaoSaidas += (p.amountToBePaid || 0);
      }
    });

    const dailyCashFlow = Array.from(dailyMap.values());

    return {
      totalFaturamento: faturamento + tIncomes,
      totalPago: pago,
      totalPendente: pendente,
      unitData: unitsArray,
      expenses: tExpenses,
      incomes: tIncomes,
      monthTransactions: mTrans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      accountBalances: accountBalancesArray,
      expensesByClass: expensesByClassArray,
      dailyCashFlow
    };
  }, [monthStr, monthlyBarberStats, gdvEntries, payments, users, systemUnits, transactions, financialCategories, finClassifications]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

console.log('--- DBG ---');
  console.log('Transactions length:', transactions?.length);
  console.log('Caixa Transactions length:', caixaTransactions?.length);
  console.log('monthStr:', monthStr);
  console.log('filters:', { filterType, filterStatus, filterAccount, filterDateFrom, filterDateTo });
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" />
            Gestão Financeira
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Resumo geral de caixa, faturamento e contas a pagar/receber.
          </p>
        </div>

        <div className="flex gap-2 items-center overflow-x-auto pb-2 custom-scrollbar">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="shrink-0 border border-gray-200 dark:border-zinc-800 p-2.5 rounded-xl font-semibold bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, "0");
              return (
                <option key={m} value={m}>
                  Mês {m}
                </option>
              );
            })}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="shrink-0 border border-gray-200 dark:border-zinc-800 p-2.5 rounded-xl font-semibold bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-sm"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'RESUMO' && (
        <>
          {/* KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500 mb-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wide">Faturamento + Receitas</span>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">
                {totalFaturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-500 mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wide">Despesas Administrativas</span>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">
                {expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-500 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wide">Folha (Pagos)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">
                {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500 mb-2">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wide">Folha (Pendentes)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">
                {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CHART: Faturamento vs Pagamentos (Unidades) */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Building className="w-5 h-5 text-gray-400" />
                Desempenho por Unidade
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(val) => `R$ ${val/1000}k`} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    />
                    <Legend />
                    <Bar dataKey="faturamento" name="Fat/Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pagamentos" name="Folha (Pagos)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* LIST: Resumo Rápido */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Balanço Mensal das Unidades
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {unitData.map((u, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-800/20">
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-zinc-100">{u.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        Receitas: {u.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        Custos: {(u.pagamentos + u.expenses).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-0.5 uppercase">Lucro Líquido</p>
                      <p className={`text-sm font-bold ${u.lucroBruto >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                        {u.lucroBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                ))}
                {unitData.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-6">Nenhum dado para este mês.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 mt-6">
            {/* CHART: Fluxo de Caixa Diário */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" />
                Fluxo de Caixa Diário (Realizado x Previsão)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyCashFlow}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="dia" tick={{ fill: '#888', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(val) => `R$ ${val/1000}k`} />
                    <Tooltip 
                      cursor={{ fill: '#ffffff10' }}
                      contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas (Realizadas)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas (Realizadas)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="previsaoEntradas" name="Prev. Entradas" stroke="#34d399" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="previsaoSaidas" name="Prev. Saídas" stroke="#f87171" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* SALDO EM CONTAS */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Saldo das Contas Bancárias
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {accountBalances.map((acc, i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded-xl border border-gray-100 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-800/20">
                    <div>
                      <p className="font-bold text-sm text-gray-900 dark:text-zinc-100">{acc.name}</p>
                      {(acc.bankName || acc.agency || acc.account) && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                          {acc.bankName && `${acc.bankName} `}
                          {acc.agency && `| Ag: ${acc.agency} `}
                          {acc.account && `| Cc: ${acc.account}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${acc.balance >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                        {acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                ))}
                {accountBalances.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-6">Nenhuma conta cadastrada ou sem movimentação.</p>
                )}
              </div>
            </div>

            {/* DESPESAS POR CLASSIFICACAO */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
              <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-gray-400" />
                Despesas por Classificação (Mês)
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {expensesByClass.map((ec, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-zinc-800/50 bg-gray-50 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-xs font-bold">
                        {ec.name.substring(0,2).toUpperCase()}
                      </div>
                      <p className="font-bold text-sm text-gray-900 dark:text-zinc-100">{ec.name}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {ec.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                ))}
                {expensesByClass.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-6">Nenhuma despesa paga neste mês.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'CONCILIACAO_FINTECH' && (
        <FintechReconciliation onSettlementComplete={handleFintechSettlement} />
      )}

      {activeTab === 'CONCILIACAO' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConciliacaoSubTab('FINTECH')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  conciliacaoSubTab === 'FINTECH'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                Motor FinTech 4 Fontes (PDV / Clube / Rede / D+31)
              </button>
              <button
                onClick={() => setConciliacaoSubTab('OFX')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  conciliacaoSubTab === 'OFX'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                Extrato Bancário OFX / CSV
              </button>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 px-3 hidden sm:inline">
              Barbearia Vangard Ltda
            </span>
          </div>

          {conciliacaoSubTab === 'FINTECH' ? (
            <FintechReconciliation onSettlementComplete={handleFintechSettlement} />
          ) : (
            <BankReconciliation />
          )}
        </div>
      )}

      {activeTab === 'RECEBIMENTOS' && (
        <ReceivablesReconciliation />
      )}

      {activeTab === 'CAIXA' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col h-[700px]">
          <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
             <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
               <DollarSign className="w-5 h-5 text-gray-400" />
               Lançamentos e Contas
             </h3>
             <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 border ${isFilterOpen ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
             >
               <Filter className="w-4 h-4" />
               Filtros
             </button>
             <button
               onClick={() => {
                 setTransForms([{
                   type: 'EXPENSE',
                   category: '',
                   description: '',
                   amount: 0,
                   date: new Date().toISOString().split('T')[0],
                   dueDate: new Date().toISOString().split('T')[0],
                   unitId: 'ALL',
                   status: 'PENDENTE',
                   recurrence: 'NONE',
                   installments: 1,
                   supplier: '',
                   classification: '',
                   subclassification: ''
                 }]);
                 setEditingId(null);
                 setIsModalOpen(true);
               }}
               className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
             >
               <Plus className="w-4 h-4" />
               Novo Lançamento
             </button>
             </div>
          </div>
          
          {isFilterOpen && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Tipo</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todos os Tipos</option>
                  <option value="INCOME">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todos os Status</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="PAGO">Pago</option>
                  <option value="RECEBIDO">Recebido</option>
                  <option value="AGENDADO">Agendado</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Conta</label>
                <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todas as Contas</option>
                  {(financialCategories || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Centro de Custo</label>
                <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todas as Unidades</option>
                  {(systemUnits || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Classificação</label>
                <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSubclass('ALL'); }} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todas as Classificações</option>
                  {(finClassifications || []).filter(c => filterType === 'ALL' || c.type === filterType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Subclassificação</label>
                <select value={filterSubclass} onChange={e => setFilterSubclass(e.target.value)} disabled={filterClass === 'ALL'} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todas as Subclassificações</option>
                  {(finSubclassifications || []).filter(s => s.classificationId === filterClass).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Fornecedor</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todos os Fornecedores</option>
                  {(suppliers || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Data De</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Data Até</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold" />
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
             {(caixaTransactions || []).map(t => (
               <div key={t.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-800/30 gap-4">
                  <div className="flex gap-4 items-center w-full sm:w-auto">
                    <div className={`p-3 rounded-xl ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {t.type === 'INCOME' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {t.description}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 uppercase tracking-wider font-bold">
                          {t.category}
                        </span>
                        {t.classification && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 uppercase tracking-wider font-bold">
                            {(finClassifications || []).find(c => c.id === t.classification)?.name || '...'}
                            {t.subclassification && ' > ' + ((finSubclassifications || []).find(s => s.id === t.subclassification)?.name || '...')}
                          </span>
                        )}
                        {t.supplier && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold">
                            {t.supplier}
                          </span>
                        )}
                      </h4>
                      <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1 flex gap-3">
                        <span className="flex items-center gap-1">
                           <Calendar className="w-3 h-3" />
                           Lan: {new Date(t.date).toLocaleDateString('pt-BR')} {t.dueDate ? `| Venc: ${new Date(t.dueDate).toLocaleDateString('pt-BR')}` : ''} {t.recurrence !== 'NONE' && t.installmentIndex ? `| (${t.installmentIndex}/${t.installments})` : ''}
                        </span>
                        <span>
                          {t.unitId === 'ALL' ? 'Todas Unidades' : systemUnits?.find(u => u.id === t.unitId)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                     <div className="text-left sm:text-right">
                       <p className={`font-black text-lg ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                         {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                       </p>
                       <p className={`text-xs font-bold uppercase tracking-wider ${t.status === 'PENDENTE' ? 'text-amber-500' : t.status === 'AGENDADO' ? 'text-blue-500' : 'text-emerald-500'}`}>
                         {t.status}
                       </p>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => handleEdit(t)} className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:text-blue-500 transition-colors">
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => deleteTransaction(t.id)} className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:text-red-500 transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                  </div>
               </div>
             ))}
             
  
  {caixaTransactions.length === 0 && (
               <div className="text-center py-12 text-gray-500 dark:text-zinc-400">
                 Nenhum lançamento encontrado para este mês.
               </div>
             )}
          </div>
        </div>
      )}


      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
                 <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                   {editingId ? 'Editar Lançamento' : 'Novo Lançamento em Lote'}
                 </h2>
                 <div className="flex gap-2">
                   <button onClick={() => setIsCategoryModalOpen(true)} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm font-semibold rounded-lg transition-colors">
                     Gerenciar Contas
                   </button>
                   <button onClick={() => setIsSupplierModalOpen(true)} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm font-semibold rounded-lg transition-colors">
                     Fornecedores
                   </button>
                   <button onClick={() => setIsClassModalOpen(true)} className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-sm font-semibold rounded-lg transition-colors">
                     Classificações
                   </button>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-500">
                      ✕
                   </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {transForms.map((form, index) => (
                   <div key={index} className="p-4 border border-gray-200 dark:border-zinc-700 rounded-xl bg-gray-50/30 dark:bg-zinc-800/20 relative">
                     {!editingId && transForms.length > 1 && (
                       <button onClick={() => handleRemoveRow(index)} className="absolute top-2 right-2 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     )}
                     
                     <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                       <div className="md:col-span-1">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Tipo</label>
                         <select
                           value={form.type}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].type = e.target.value as 'INCOME' | 'EXPENSE';
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                         >
                           <option value="EXPENSE">Despesa</option>
                           <option value="INCOME">Receita</option>
                         </select>
                       </div>
                       
                       <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Data do Lançamento</label>
                         <input
                           type="date"
                           value={form.date}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].date = e.target.value;
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                         />
                       </div>

                       <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Data do Vencimento</label>
                         <input
                           type="date"
                           value={form.dueDate || ''}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].dueDate = e.target.value;
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                         />
                       </div>
                       

                       <div className="md:col-span-1">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Status</label>
                         <select
                           value={form.status}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].status = e.target.value as 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'AGENDADO';
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                         >
                           <option value="PENDENTE">Pendente</option>
                           <option value="PAGO">Pago</option>
                           <option value="RECEBIDO">Recebido</option>
                           <option value="AGENDADO">Agendado</option>
                         </select>
                       </div>
                       
                       <div className="md:col-span-1">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Recorrência</label>
                         <select
                           value={form.recurrence || 'NONE'}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].recurrence = e.target.value;
                             if (e.target.value === 'CUSTOM' && !newForms[index].customIntervalType) {
                               newForms[index].customIntervalType = 'DAYS';
                               newForms[index].customIntervalValue = 1;
                             }
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                         >
                           <option value="NONE">Única</option>
                           <option value="WEEKLY">Semanal</option>
                           <option value="MONTHLY">Mensal</option>
                           <option value="CUSTOM">Personalizada</option>
                         </select>
                       </div>
                       
                       {form.recurrence === 'CUSTOM' && (
                         <div className="md:col-span-2 grid grid-cols-2 gap-2">
                           <div>
                             <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">A cada</label>
                             <input
                               type="number"
                               min="1"
                               value={form.customIntervalValue || 1}
                               onChange={e => {
                                 const newForms = [...transForms];
                                 newForms[index].customIntervalValue = parseInt(e.target.value) || 1;
                                 setTransForms(newForms);
                               }}
                               className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Unidade</label>
                             <select
                               value={form.customIntervalType || 'DAYS'}
                               onChange={e => {
                                 const newForms = [...transForms];
                                 newForms[index].customIntervalType = e.target.value as 'DAYS' | 'WEEKS' | 'MONTHS';
                                 setTransForms(newForms);
                               }}
                               className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                             >
                               <option value="DAYS">Dias</option>
                               <option value="WEEKS">Semanas</option>
                               <option value="MONTHS">Meses</option>
                             </select>
                           </div>
                         </div>
                       )}

                       {form.recurrence !== 'NONE' && (
                         <div className="md:col-span-1">
                           <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Repetições</label>
                           <input
                             type="number"
                             min="2"
                             max="120"
                             value={form.installments || ''}
                             onChange={e => {
                               const newForms = [...transForms];
                               newForms[index].installments = parseInt(e.target.value) || 2;
                               setTransForms(newForms);
                             }}
                             className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                           />
                         </div>
                       )}

                       <div className={`${form.recurrence === 'CUSTOM' ? 'md:col-span-1' : form.recurrence !== 'NONE' ? 'md:col-span-3' : 'md:col-span-4'}`}>
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Centro de Custo</label>
                         <select
                           value={form.unitId}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].unitId = e.target.value;
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-bold text-sm"
                         >
                           <option value="ALL">Geral (Todas)</option>
                           {systemUnits?.map(u => (
                             <option key={u.id} value={u.id}>{u.name}</option>
                           ))}
                         </select>
                       </div>


                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Conta (Banco/Caixa)</label>
                          <select
                            value={form.category}
                            onChange={e => {
                              const newForms = [...transForms];
                              newForms[index].category = e.target.value;
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            <option value="">-- Conta --</option>
                            {(financialCategories || []).map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                       </div>
                       
                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Fornecedor/Origem</label>
                          <select
                            value={form.supplier || ''}
                            onChange={e => {
                              const newForms = [...transForms];
                              newForms[index].supplier = e.target.value;
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            <option value="">-- Fornecedor --</option>
                            {(suppliers || []).map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                       </div>
                       
                       <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Valor (R$)</label>
                         <input
                           type="number"
                           step="0.01"
                           value={form.amount || ''}
                           onChange={e => {
                             const newForms = [...transForms];
                             newForms[index].amount = parseFloat(e.target.value) || 0;
                             setTransForms(newForms);
                           }}
                           className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-sm"
                         />
                       </div>

                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Classificação</label>
                          <select
                            value={form.classification || ''}
                            onChange={e => {
                              const newForms = [...transForms];
                              newForms[index].classification = e.target.value;
                              newForms[index].subclassification = ''; // reset subclass
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            <option value="">-- Classificação --</option>
                            {(finClassifications || []).filter(c => c.type === form.type).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                       </div>

                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Subclassificação</label>
                          <select
                            value={form.subclassification || ''}
                            onChange={e => {
                              const newForms = [...transForms];
                              newForms[index].subclassification = e.target.value;
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                            disabled={!form.classification}
                          >
                            <option value="">-- Subclassificação --</option>
                            {(finSubclassifications || []).filter(s => s.classificationId === form.classification).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                       </div>
                       
                       <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Descrição / Observação</label>
                          <input
                            type="text"
                            placeholder="Detalhes (Opcional)"
                            value={form.description || ''}
                            onChange={e => {
                              const newForms = [...transForms];
                              newForms[index].description = e.target.value;
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          />
                       </div>
                     </div>
                   </div>
                 ))}
                 
                 {!editingId && (
                   <button 
                     onClick={handleAddRow}
                     className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50 font-bold flex items-center justify-center gap-2 transition-colors"
                   >
                     <Plus className="w-5 h-5" /> Adicionar Outro Lançamento
                   </button>
                 )}
              </div>
              <div className="p-5 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-zinc-800/30 mt-auto">
                 <button 
                   onClick={() => setIsModalOpen(false)}
                   className="px-6 py-2.5 text-gray-600 dark:text-zinc-400 font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={handleSaveTransaction}
                   className="px-6 py-2.5 bg-[var(--theme-color)] text-white font-black rounded-xl shadow-lg shadow-[var(--theme-color)]/20 hover:bg-[#ff6b42] transition-colors"
                 >
                   Salvar Lançamentos
                 </button>
              </div>
           </div>
        </div>
      )}

      
      
      {/* CLASSIFICATIONS MODAL */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
                 <h2 className="text-lg font-black text-gray-900 dark:text-white">Gerenciar Classificações</h2>
                 <button onClick={() => setIsClassModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-500">
                    ✕
                 </button>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 h-[50vh] overflow-y-auto">
                
                {/* CLASSIFICATIONS */}
                <div className="space-y-4 border-r border-gray-100 dark:border-zinc-800 pr-6">
                  <h3 className="font-bold text-sm text-gray-500">Classificação Principal</h3>
                  <div className="flex gap-2">
                     <select value={newClassType} onChange={e => setNewClassType(e.target.value as 'INCOME'|'EXPENSE')} className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-bold">
                       <option value="EXPENSE">Desp</option>
                       <option value="INCOME">Rec</option>
                     </select>
                     <input type="text" placeholder="Nome..." value={newClassName} onChange={e => setNewClassName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm" />
                     <button onClick={handleAddClass} className="bg-blue-500 text-white px-3 py-2 rounded-lg font-bold">+</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(finClassifications || []).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-900/50 cursor-pointer hover:border-blue-300" onClick={() => setSelectedClassForSub(c.id)}>
                        <div>
                          <span className={`font-bold text-sm ${selectedClassForSub === c.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-zinc-100'}`}>{c.name}</span>
                          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded uppercase ${c.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{c.type === 'INCOME' ? 'Rec' : 'Desp'}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteFinClassification(c.id); }} className="text-red-500 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SUBCLASSIFICATIONS */}
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-gray-500">Subclassificações</h3>
                  {!selectedClassForSub ? (
                    <div className="text-sm text-gray-400">Selecione uma classificação ao lado.</div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Nova Subclassificação..." value={newSubclassName} onChange={e => setNewSubclassName(e.target.value)} className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm" />
                        <button onClick={handleAddSubclass} className="bg-emerald-500 text-white px-3 py-2 rounded-lg font-bold">+</button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(finSubclassifications || []).filter(s => s.classificationId === selectedClassForSub).map(s => (
                          <div key={s.id} className="flex items-center justify-between p-2 border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
                            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">{s.name}</span>
                            <button onClick={() => deleteFinSubclassification(s.id)} className="text-red-500 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

              </div>
           </div>
        </div>
      )}

      {/* SUPPLIER MANAGEMENT MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
                 <h2 className="text-lg font-black text-gray-900 dark:text-white">Gerenciar Fornecedores</h2>
                 <button onClick={() => setIsSupplierModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-500">
                    ✕
                 </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     placeholder="Nome do Fornecedor..."
                     value={newSupplierName}
                     onChange={e => setNewSupplierName(e.target.value)}
                     className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                   />
                   <button 
                     onClick={handleAddSupplier}
                     className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold"
                   >
                     +
                   </button>
                </div>
                
                <div className="space-y-2 mt-4 max-h-60 overflow-y-auto">
                  {(suppliers || []).map(sup => (
                    <div key={sup.id} className="flex items-center justify-between p-2 border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
                      <div>
                        <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">{sup.name}</span>
                      </div>
                      <button onClick={() => deleteSupplier(sup.id)} className="text-red-500 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!suppliers || suppliers.length === 0) && (
                    <div className="text-center text-sm text-gray-500 py-4">Nenhum fornecedor cadastrado.</div>
                  )}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* CATEGORY MANAGEMENT MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30">
                 <h2 className="text-lg font-black text-gray-900 dark:text-white">Gerenciar Contas</h2>
                 <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-500">
                    ✕
                 </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-3 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                  <div className="flex gap-2">
                    <select 
                      value={newCategoryType}
                      onChange={e => setNewCategoryType(e.target.value as 'INCOME'|'EXPENSE')}
                      className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-bold"
                    >
                      <option value="EXPENSE">Despesa</option>
                      <option value="INCOME">Receita</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="Nome da Conta / Banco..."
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="flex-1 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="Banco (Ex: Nubank)"
                      value={newCategoryBank}
                      onChange={e => setNewCategoryBank(e.target.value)}
                      className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs"
                    />
                    <input 
                      type="text" 
                      placeholder="Chave PIX"
                      value={newCategoryPix}
                      onChange={e => setNewCategoryPix(e.target.value)}
                      className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs"
                    />
                    <input 
                      type="text" 
                      placeholder="Agência"
                      value={newCategoryAgency}
                      onChange={e => setNewCategoryAgency(e.target.value)}
                      className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs"
                    />
                    <input 
                      type="text" 
                      placeholder="Conta Corrente"
                      value={newCategoryAccount}
                      onChange={e => setNewCategoryAccount(e.target.value)}
                      className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <button 
                    onClick={handleAddCategory}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 transition-colors text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                  >
                    Adicionar Nova Conta
                  </button>
                </div>
                
                <div className="space-y-2 mt-4 max-h-60 overflow-y-auto">
                  {(financialCategories || []).map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 border border-gray-100 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-900/50">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">{cat.name}</span>
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${cat.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 text-red-400'}`}>
                            {cat.type === 'INCOME' ? 'Receita' : 'Despesa'}
                          </span>
                        </div>
                        {(cat.bankName || cat.pixKey || cat.agency || cat.accountNumber) && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                            {cat.bankName && <span><strong className="text-gray-400">Banco:</strong> {cat.bankName}</span>}
                            {cat.agency && <span><strong className="text-gray-400">Ag:</strong> {cat.agency}</span>}
                            {cat.accountNumber && <span><strong className="text-gray-400">Cc:</strong> {cat.accountNumber}</span>}
                            {cat.pixKey && <span><strong className="text-gray-400">PIX:</strong> {cat.pixKey}</span>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => deleteFinancialCategory(cat.id)} className="text-red-500 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!financialCategories || financialCategories.length === 0) && (
                    <div className="text-center text-sm text-gray-500 py-4">Nenhuma conta cadastrada.</div>
                  )}
                </div>
              </div>
           </div>
        </div>
      )}


    </div>
  );
}

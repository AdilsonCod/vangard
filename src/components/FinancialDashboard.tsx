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
  Edit2, Filter, Activity, RotateCcw, ShieldCheck, AlertTriangle, Search
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
import { CashClosing, FinancialTransaction } from '../types';
import { BankReconciliation } from './BankReconciliation';
import { ReceivablesReconciliation } from './ReceivablesReconciliation';
import { FintechReconciliation } from './FintechReconciliation';
import { getLatestFinancialPeriod } from '../utils/financialPeriods';
import { isValidFinancialAmountInput, parseFinancialAmount } from '../utils/financialAmount';

type FinancialTransactionForm = Omit<Partial<FinancialTransaction>, 'amount'> & {
  amount?: number | string;
};

const SOURCE_CHANNEL_OPTIONS: { value: NonNullable<FinancialTransaction['sourceChannel']>; label: string }[] = [
  { value: 'CARD_MACHINE', label: 'Maquininha Crédito/Débito' },
  { value: 'PIX_MACHINE', label: 'Maquininha PIX' },
  { value: 'DIRECT_PIX', label: 'PIX direto na conta' },
  { value: 'CASH', label: 'Caixa físico' },
  { value: 'SUBSCRIPTION_GATEWAY', label: 'Gateway de assinaturas D+31' },
  { value: 'BANK', label: 'Conta bancária / OFX' },
  { value: 'VOUCHER', label: 'Vales' },
  { value: 'COURTESY', label: 'Cortesias e descontos' },
  { value: 'TIP', label: 'Gorjetas' },
  { value: 'OTHER', label: 'Outras fontes' },
];

const PAYMENT_METHOD_OPTIONS: { value: NonNullable<FinancialTransaction['paymentMethod']>; label: string }[] = [
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CASH', label: 'Espécie' },
  { value: 'SUBSCRIPTION', label: 'Assinatura' },
  { value: 'VOUCHER', label: 'Vale' },
  { value: 'COURTESY', label: 'Cortesia / desconto' },
  { value: 'TIP', label: 'Gorjeta' },
  { value: 'OTHER', label: 'Outro' },
];

const MOVEMENT_NATURE_OPTIONS: { value: NonNullable<FinancialTransaction['movementNature']>; label: string }[] = [
  { value: 'REVENUE', label: 'Receita operacional' },
  { value: 'EXPENSE', label: 'Despesa operacional' },
  { value: 'PASS_THROUGH', label: 'Valor transitório / repasse' },
  { value: 'INTERNAL_TRANSFER', label: 'Movimento interno / troco' },
  { value: 'ADVANCE', label: 'Vale vendido / adiantamento' },
  { value: 'COMMERCIAL_DISCOUNT', label: 'Desconto comercial' },
  { value: 'NON_FINANCIAL', label: 'Cortesia sem movimento financeiro' },
];

const RECONCILIATION_STATUS_OPTIONS: { value: NonNullable<FinancialTransaction['reconciliationStatus']>; label: string }[] = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'AWAITING_SETTLEMENT', label: 'Aguardando liquidação' },
  { value: 'DIVERGENT', label: 'Divergente' },
  { value: 'RECONCILED', label: 'Conciliado' },
  { value: 'NOT_APPLICABLE', label: 'Não se aplica' },
];

const QUICK_OPERATION_PRESETS: { label: string; preset: Partial<FinancialTransactionForm> }[] = [
  { label: 'PIX direto', preset: { type: 'INCOME', sourceChannel: 'DIRECT_PIX', paymentMethod: 'PIX', movementNature: 'REVENUE', reconciliationStatus: 'PENDING', description: 'Recebimento PIX direto' } },
  { label: 'Venda em espécie', preset: { type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'REVENUE', reconciliationStatus: 'PENDING', description: 'Venda recebida em espécie' } },
  { label: 'Compra do caixa', preset: { type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'EXPENSE', reconciliationStatus: 'NOT_APPLICABLE', status: 'PAGO', description: 'Compra operacional paga pelo caixa' } },
  { label: 'Gorjeta em espécie', preset: { type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'TIP', movementNature: 'PASS_THROUGH', reconciliationStatus: 'PENDING', description: 'Gorjeta em espécie recebida para repasse' } },
  { label: 'Repasse de gorjeta', preset: { type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'TIP', movementNature: 'PASS_THROUGH', reconciliationStatus: 'RECONCILED', status: 'PAGO', description: 'Repasse de gorjeta em espécie ao profissional' } },
  { label: 'Reforço de troco', preset: { type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'INTERNAL_TRANSFER', reconciliationStatus: 'NOT_APPLICABLE', status: 'RECEBIDO', description: 'Reforço de troco no caixa físico' } },
  { label: 'Retirada de troco', preset: { type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'INTERNAL_TRANSFER', reconciliationStatus: 'NOT_APPLICABLE', status: 'PAGO', description: 'Retirada de troco do caixa físico' } },
  { label: 'Vale vendido', preset: { type: 'INCOME', sourceChannel: 'VOUCHER', paymentMethod: 'VOUCHER', movementNature: 'ADVANCE', reconciliationStatus: 'PENDING', description: 'Vale vendido — receita antecipada' } },
  { label: 'Cortesia / aniversário', preset: { type: 'EXPENSE', sourceChannel: 'COURTESY', paymentMethod: 'COURTESY', movementNature: 'NON_FINANCIAL', reconciliationStatus: 'PENDING', status: 'PAGO', description: 'Cortesia ou vale de aniversário' } },
];

function inferSourceChannel(transaction: FinancialTransaction): NonNullable<FinancialTransaction['sourceChannel']> {
  if (transaction.sourceChannel) return transaction.sourceChannel;
  const text = `${transaction.category} ${transaction.description} ${transaction.classification || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (text.includes('assinatura') || text.includes('gateway')) return 'SUBSCRIPTION_GATEWAY';
  if (text.includes('gorjeta')) return 'TIP';
  if (text.includes('cortesia') || text.includes('desconto')) return 'COURTESY';
  if (text.includes('vale')) return 'VOUCHER';
  if (text.includes('dinheiro') || text.includes('especie') || text.includes('caixa fisico')) return 'CASH';
  if (text.includes('pix')) return 'DIRECT_PIX';
  if (text.includes('cartao') || text.includes('rede') || text.includes('adquirente')) return 'CARD_MACHINE';
  return 'OTHER';
}

function formatTransactionDate(value?: string): string {
  if (!value) return 'Não informado';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

export function FinancialDashboard({ currentTab = 'RESUMO' }: { currentTab?: 'RESUMO' | 'CAIXA' | 'CONCILIACAO' | 'RECEBIMENTOS' | 'CONCILIACAO_FINTECH' }) {
  const { entries, payments, gdvEntries, monthlyBarberStats, users, systemUnits, transactions, cashClosings, currentUser, addTransaction, updateTransaction, deleteTransaction, saveCashClosing } = useStore();
  
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

  // List Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterSubclass, setFilterSubclass] = useState<string>('ALL');
  const [filterSourceChannel, setFilterSourceChannel] = useState<string>('ALL');
  const [filterReconciliationStatus, setFilterReconciliationStatus] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionFeedback, setTransactionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [operationsPeriod, setOperationsPeriod] = useState<'DAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [operationsDate, setOperationsDate] = useState(new Date().toISOString().slice(0, 10));
  const [operationsUnit, setOperationsUnit] = useState('ALL');
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [cashOpeningBalance, setCashOpeningBalance] = useState<string>('0,00');
  const [cashCountedBalance, setCashCountedBalance] = useState<string>('0,00');
  const [cashClosingNotes, setCashClosingNotes] = useState('');

  const hasActiveCashFilters =
    filterType !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterAccount !== 'ALL' ||
    filterUnit !== 'ALL' ||
    filterSupplier !== 'ALL' ||
    filterClass !== 'ALL' ||
    filterSubclass !== 'ALL' ||
    filterSourceChannel !== 'ALL' ||
    filterReconciliationStatus !== 'ALL' ||
    Boolean(filterSearch.trim()) ||
    Boolean(filterDateFrom) ||
    Boolean(filterDateTo);

  const clearCashFilters = () => {
    setFilterType('ALL');
    setFilterStatus('ALL');
    setFilterAccount('ALL');
    setFilterUnit('ALL');
    setFilterSupplier('ALL');
    setFilterClass('ALL');
    setFilterSubclass('ALL');
    setFilterSourceChannel('ALL');
    setFilterReconciliationStatus('ALL');
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const applyCashQuickFilter = (
    type: string = 'ALL',
    status: string = 'ALL',
    sourceChannel: string = 'ALL',
    reconciliationStatus: string = 'ALL'
  ) => {
    setFilterType(type);
    setFilterStatus(status);
    setFilterSourceChannel(sourceChannel);
    setFilterReconciliationStatus(reconciliationStatus);
  };

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

  useEffect(() => {
    if (!selectedTransaction) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedTransaction(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedTransaction]);

  // Transaction form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transForms, setTransForms] = useState<FinancialTransactionForm[]>([{
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
    subclassification: '',
    sourceChannel: 'OTHER',
    paymentMethod: 'OTHER',
    movementNature: 'EXPENSE',
    reconciliationStatus: 'NOT_APPLICABLE'
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
      subclassification: '',
      sourceChannel: 'OTHER',
      paymentMethod: 'OTHER',
      movementNature: 'EXPENSE',
      reconciliationStatus: 'NOT_APPLICABLE'
    }]);
  };

  const handleRemoveRow = (index: number) => {
    setTransForms(transForms.filter((_, i) => i !== index));
  };

  const handleSaveTransaction = async () => {
    if (isSavingTransaction) return;

    const invalidFormIndex = transForms.findIndex(
      form => !form.category || parseFinancialAmount(form.amount) <= 0
    );
    if (invalidFormIndex >= 0) {
      alert(`Preencha a conta bancária e o valor no lançamento ${invalidFormIndex + 1}.`);
      return;
    }

    setIsSavingTransaction(true);
    setTransactionFeedback(null);
    const savedDates: string[] = [];
    let savedCount = 0;

    try {
      for (const transForm of transForms) {
      
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
          amount: parseFinancialAmount(transForm.amount),
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
          subclassification: transForm.subclassification || '',
          sourceChannel: transForm.sourceChannel || 'OTHER',
          paymentMethod: transForm.paymentMethod || 'OTHER',
          movementNature: transForm.movementNature || (transForm.type === 'INCOME' ? 'REVENUE' : 'EXPENSE'),
          reconciliationStatus: transForm.reconciliationStatus || 'NOT_APPLICABLE',
          sourceReference: transForm.sourceReference || ''
        };
        
        // Remove undefined keys to prevent Firestore unsupported field value errors
        Object.keys(t).forEach(key => t[key] === undefined && delete t[key]);
        
        if (editingId && installments === 1) {
          await updateTransaction(t);
        } else {
          await addTransaction(t);
        }
        savedDates.push(nextDate);
        savedCount += 1;
      }
      }

      // Ao criar, exibe imediatamente o novo lançamento. Durante uma edição,
      // preserva período e filtros para o usuário continuar na mesma consulta.
      if (!editingId) {
        const savedPeriod = savedDates[0]?.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(savedPeriod || '')) {
          selectFinancialPeriod(savedPeriod);
          hasAutoSelectedTransactionPeriod.current = true;
        }
        clearCashFilters();
      }

      setIsModalOpen(false);
      setEditingId(null);
      setTransactionFeedback({
        type: 'success',
        message: `${savedCount} lançamento${savedCount === 1 ? '' : 's'} salvo${savedCount === 1 ? '' : 's'} com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao salvar lançamento financeiro:', error);
      const message = error instanceof Error ? error.message : 'Falha desconhecida no Firestore.';
      setTransactionFeedback({
        type: 'error',
        message: `Não foi possível salvar o lançamento: ${message}`
      });
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const handleEdit = (t: FinancialTransaction) => {
    setTransForms([{...t}]);
    setEditingId(t.id);
    setIsModalOpen(true);
  };

  const openQuickTransaction = (preset: Partial<FinancialTransactionForm>) => {
    const today = new Date().toISOString().split('T')[0];
    setTransForms([{
      type: 'INCOME',
      category: '',
      description: '',
      amount: 0,
      unitId: operationsUnit === 'ALL' ? 'ALL' : operationsUnit,
      status: 'RECEBIDO',
      date: today,
      dueDate: today,
      recurrence: 'NONE',
      installments: 1,
      supplier: '',
      classification: '',
      subclassification: '',
      sourceChannel: 'OTHER',
      paymentMethod: 'OTHER',
      movementNature: 'REVENUE',
      reconciliationStatus: 'PENDING',
      ...preset,
    }]);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openCashClosing = () => {
    if (operationsUnit === 'ALL') {
      setTransactionFeedback({ type: 'error', message: 'Selecione uma unidade para fechar o caixa físico.' });
      return;
    }
    const existingClosing = cashClosings.find(closing =>
      closing.unitId === operationsUnit && closing.date === operationsDate
    );
    const previousClosing = cashClosings
      .filter(closing => closing.unitId === operationsUnit && closing.date < operationsDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const suggestedOpening = existingClosing?.openingBalance ?? previousClosing?.countedBalance ?? 0;
    setCashOpeningBalance(String(suggestedOpening).replace('.', ','));
    setCashCountedBalance(existingClosing ? String(existingClosing.countedBalance).replace('.', ',') : '0,00');
    setCashClosingNotes(existingClosing?.notes || '');
    setIsCashClosingOpen(true);
  };

  const handleSaveCashClosing = async () => {
    if (operationsUnit === 'ALL') return;
    const closing: CashClosing = {
      id: `cash_closing_${operationsUnit}_${operationsDate}`,
      unitId: operationsUnit,
      date: operationsDate,
      openingBalance: cashClosingPreview.openingBalance,
      cashIncome: cashClosingPreview.cashIncome,
      cashOutflow: cashClosingPreview.cashOutflow,
      expectedBalance: cashClosingPreview.expectedBalance,
      countedBalance: cashClosingPreview.countedBalance,
      difference: cashClosingPreview.difference,
      status: Math.abs(cashClosingPreview.difference) <= 0.01 ? 'CLOSED' : 'DIVERGENT',
      notes: cashClosingNotes.trim() || undefined,
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.id,
    };

    try {
      await saveCashClosing(closing);
      setIsCashClosingOpen(false);
      setTransactionFeedback({
        type: closing.status === 'CLOSED' ? 'success' : 'error',
        message: closing.status === 'CLOSED'
          ? 'Caixa físico fechado sem divergências.'
          : `Caixa fechado com diferença de ${closing.difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      });
    } catch (error) {
      console.error('Erro ao salvar fechamento do caixa:', error);
      setTransactionFeedback({ type: 'error', message: 'Não foi possível salvar o fechamento do caixa.' });
    }
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
    if (filterSourceChannel !== 'ALL') filtered = filtered.filter(t => inferSourceChannel(t) === filterSourceChannel);
    if (filterReconciliationStatus !== 'ALL') {
      filtered = filtered.filter(t => (t.reconciliationStatus || 'NOT_APPLICABLE') === filterReconciliationStatus);
    }
    if (filterSearch.trim()) {
      const search = filterSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      filtered = filtered.filter(transaction => `${transaction.description} ${transaction.category} ${transaction.supplier || ''}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(search));
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, filterStatus, filterAccount, filterUnit, filterSupplier, filterClass, filterSubclass, filterSourceChannel, filterReconciliationStatus, filterSearch, filterDateFrom, filterDateTo, monthStr]);

  const operationsCenter = useMemo(() => {
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(operationsDate)
      ? operationsDate
      : `${monthStr}-01`;
    let startDate = `${monthStr}-01`;
    let endDate = `${monthStr}-31`;

    if (operationsPeriod === 'DAY') {
      startDate = anchor;
      endDate = anchor;
    } else if (operationsPeriod === 'WEEK') {
      const [year, month, day] = anchor.split('-').map(Number);
      const anchorDate = new Date(year, month - 1, day);
      const weekday = (anchorDate.getDay() + 6) % 7;
      const monday = new Date(year, month - 1, day - weekday);
      const sunday = new Date(year, month - 1, day - weekday + 6);
      const toIsoDate = (date: Date) => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
      startDate = toIsoDate(monday);
      endDate = toIsoDate(sunday);
    }

    type OperationsRow = {
      key: string;
      unitId: string;
      unitName: string;
      channel: NonNullable<FinancialTransaction['sourceChannel']>;
      expected: number;
      received: number;
      outgoing: number;
      pending: number;
      divergent: number;
      reconciled: number;
    };
    const rowMap = new Map<string, OperationsRow>();

    transactions
      .filter(transaction => transaction.date >= startDate && transaction.date <= endDate)
      .filter(transaction => operationsUnit === 'ALL' || transaction.unitId === operationsUnit)
      .forEach(transaction => {
        const channel = inferSourceChannel(transaction);
        const unitId = transaction.unitId || 'ALL';
        const key = `${unitId}|${channel}`;
        const unitName = unitId === 'ALL'
          ? 'Todas as unidades'
          : systemUnits.find(unit => unit.id === unitId)?.name || unitId;
        const row = rowMap.get(key) || {
          key,
          unitId,
          unitName,
          channel,
          expected: 0,
          received: 0,
          outgoing: 0,
          pending: 0,
          divergent: 0,
          reconciled: 0,
        };
        const nature = transaction.movementNature || (transaction.type === 'INCOME' ? 'REVENUE' : 'EXPENSE');
        const hasFinancialEffect = nature !== 'NON_FINANCIAL' && nature !== 'COMMERCIAL_DISCOUNT';

        if (transaction.type === 'INCOME' && hasFinancialEffect) {
          row.expected += transaction.amount;
          if (transaction.status === 'RECEBIDO') row.received += transaction.amount;
        }
        if (transaction.type === 'EXPENSE' && hasFinancialEffect && transaction.status === 'PAGO') {
          row.outgoing += transaction.amount;
        }
        if (transaction.reconciliationStatus === 'DIVERGENT') row.divergent += 1;
        else if (transaction.reconciliationStatus === 'RECONCILED') row.reconciled += 1;
        else if (
          transaction.reconciliationStatus === 'PENDING' ||
          transaction.reconciliationStatus === 'AWAITING_SETTLEMENT' ||
          transaction.status === 'PENDENTE' ||
          transaction.status === 'AGENDADO'
        ) row.pending += 1;
        rowMap.set(key, row);
      });

    const rows = Array.from(rowMap.values()).sort((a, b) =>
      a.unitName.localeCompare(b.unitName, 'pt-BR') || a.channel.localeCompare(b.channel)
    );
    return {
      startDate,
      endDate,
      rows,
      pending: rows.reduce((sum, row) => sum + row.pending, 0),
      divergent: rows.reduce((sum, row) => sum + row.divergent, 0),
      cashBalance: rows
        .filter(row => row.channel === 'CASH')
        .reduce((sum, row) => sum + row.received - row.outgoing, 0),
    };
  }, [monthStr, operationsDate, operationsPeriod, operationsUnit, systemUnits, transactions]);

  const cashClosingPreview = useMemo(() => {
    const movements = transactions.filter(transaction =>
      operationsUnit !== 'ALL' &&
      transaction.unitId === operationsUnit &&
      transaction.date === operationsDate &&
      inferSourceChannel(transaction) === 'CASH'
    );
    const cashIncome = movements
      .filter(transaction =>
        transaction.type === 'INCOME' &&
        transaction.status === 'RECEBIDO' &&
        transaction.movementNature !== 'NON_FINANCIAL' &&
        transaction.movementNature !== 'COMMERCIAL_DISCOUNT'
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const cashOutflow = movements
      .filter(transaction =>
        transaction.type === 'EXPENSE' &&
        transaction.status === 'PAGO' &&
        transaction.movementNature !== 'NON_FINANCIAL' &&
        transaction.movementNature !== 'COMMERCIAL_DISCOUNT'
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const openingBalance = parseFinancialAmount(cashOpeningBalance);
    const countedBalance = parseFinancialAmount(cashCountedBalance);
    const expectedBalance = Number((openingBalance + cashIncome - cashOutflow).toFixed(2));
    return {
      cashIncome: Number(cashIncome.toFixed(2)),
      cashOutflow: Number(cashOutflow.toFixed(2)),
      openingBalance,
      countedBalance,
      expectedBalance,
      difference: Number((countedBalance - expectedBalance).toFixed(2)),
    };
  }, [cashCountedBalance, cashOpeningBalance, operationsDate, operationsUnit, transactions]);

  const selectedCashClosing = useMemo(() => cashClosings.find(closing =>
    operationsUnit !== 'ALL' && closing.unitId === operationsUnit && closing.date === operationsDate
  ), [cashClosings, operationsDate, operationsUnit]);

  const dailyUnitOverview = useMemo(() => systemUnits
    .filter(unit => unit.isActive !== false)
    .map(unit => {
      const movements = transactions.filter(transaction =>
        transaction.unitId === unit.id && transaction.date === operationsDate
      );
      const pending = movements.filter(transaction =>
        transaction.reconciliationStatus === 'PENDING' ||
        transaction.reconciliationStatus === 'AWAITING_SETTLEMENT'
      ).length;
      const divergent = movements.filter(transaction => transaction.reconciliationStatus === 'DIVERGENT').length;
      const closing = cashClosings.find(item => item.unitId === unit.id && item.date === operationsDate);
      const responsible = closing?.closedBy
        ? users.find(user => user.id === closing.closedBy)?.name || 'Usuário não identificado'
        : '—';
      const reconciliation = divergent > 0
        ? 'Divergente'
        : pending > 0
          ? 'Parcial'
          : movements.length > 0
            ? 'Concluída'
            : 'Sem movimentos';
      return { unit, movements: movements.length, pending, divergent, closing, responsible, reconciliation };
    }), [cashClosings, operationsDate, systemUnits, transactions, users]);

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
      const isAutomaticCommission = t.id.startsWith('commission_payment_');
      const nature = t.movementNature || (t.type === 'INCOME' ? 'REVENUE' : 'EXPENSE');
      if (t.type === 'EXPENSE') {
        if (!isAutomaticCommission && nature === 'EXPENSE') tExpenses += t.amount;
        if (!isAutomaticCommission && nature === 'EXPENSE' && t.unitId !== 'ALL' && unitMap.has(t.unitId)) {
          unitMap.get(t.unitId)!.expenses += t.amount;
        }
      } else if (nature === 'REVENUE') {
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
      const nature = t.movementNature || (t.type === 'INCOME' ? 'REVENUE' : 'EXPENSE');
      if (t.type === 'EXPENSE' && t.status === 'PAGO' && nature === 'EXPENSE') {
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
      if (t.id.startsWith('commission_payment_')) return;
      const nature = t.movementNature || (t.type === 'INCOME' ? 'REVENUE' : 'EXPENSE');
      if (nature === 'NON_FINANCIAL' || nature === 'COMMERCIAL_DISCOUNT') return;
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

  const selectedTransactionAccount = selectedTransaction
    ? financialCategories.find(category => category.name === selectedTransaction.category)
    : undefined;
  const selectedTransactionUnit = selectedTransaction?.unitId === 'ALL'
    ? 'Todas as unidades'
    : systemUnits.find(unit => unit.id === selectedTransaction?.unitId)?.name || 'Unidade não encontrada';
  const selectedTransactionClassification = finClassifications.find(
    classification => classification.id === selectedTransaction?.classification
  )?.name;
  const selectedTransactionSubclass = finSubclassifications.find(
    subclass => subclass.id === selectedTransaction?.subclassification
  )?.name;

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

      {transactionFeedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            transactionFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {transactionFeedback.message}
        </div>
      )}

      {activeTab === 'RESUMO' && (
        <>
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Operação diária</p>
                <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">Fechamento por unidade</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Veja rapidamente quais unidades ainda exigem conferência ou fechamento.</p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="sr-only">Data operacional</span>
                <input
                  type="date"
                  value={operationsDate}
                  onChange={event => setOperationsDate(event.target.value)}
                  className="bg-transparent text-sm font-bold outline-none"
                />
              </label>
            </div>

            {dailyUnitOverview.some(item => item.divergent > 0 || !item.closing) && (
              <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-bold">
                    {dailyUnitOverview.filter(item => !item.closing).length} unidade(s) sem fechamento e{' '}
                    {dailyUnitOverview.reduce((sum, item) => sum + item.divergent, 0)} divergência(s) nesta data.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('operations-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="shrink-0 font-black text-amber-800 underline decoration-2 underline-offset-4 dark:text-amber-300"
                >
                  Ir para a conferência
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <tr>
                    <th className="px-5 py-3">Unidade</th>
                    <th className="px-4 py-3">Caixa físico</th>
                    <th className="px-4 py-3">Conciliação</th>
                    <th className="px-4 py-3 text-center">Divergências</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {dailyUnitOverview.map(item => (
                    <tr key={item.unit.id} className="transition hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                      <td className="px-5 py-3 font-black text-gray-900 dark:text-white">{item.unit.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                          item.closing?.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : item.closing?.status === 'DIVERGENT'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {item.closing?.status === 'CLOSED' ? 'Fechado' : item.closing?.status === 'DIVERGENT' ? 'Com diferença' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300">{item.reconciliation}</td>
                      <td className={`px-4 py-3 text-center font-black ${item.divergent > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{item.divergent}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{item.responsible}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setOperationsUnit(item.unit.id);
                            setOperationsPeriod('DAY');
                            requestAnimationFrame(() => document.getElementById('operations-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                          }}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-black text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-blue-950/20"
                        >
                          Abrir operação
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dailyUnitOverview.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">Cadastre uma unidade para iniciar o controle diário.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* KPIS */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

          <section id="operations-center" className="scroll-mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-black text-gray-900 dark:text-white">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Central de conciliação por unidade e canal
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                  Entradas, liquidações, saídas e pendências separadas pela origem real do dinheiro.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Visão</label>
                  <select
                    value={operationsPeriod}
                    onChange={event => setOperationsPeriod(event.target.value as 'DAY' | 'WEEK' | 'MONTH')}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="DAY">Diária</option>
                    <option value="WEEK">Semanal</option>
                    <option value="MONTH">Mensal</option>
                  </select>
                </div>
                {operationsPeriod !== 'MONTH' && (
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Data de referência</label>
                    <input
                      type="date"
                      value={operationsDate}
                      onChange={event => setOperationsDate(event.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Unidade</label>
                  <select
                    value={operationsUnit}
                    onChange={event => setOperationsUnit(event.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="ALL">Todas as unidades</option>
                    {systemUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={openCashClosing}
                  disabled={operationsUnit === 'ALL'}
                  title={operationsUnit === 'ALL' ? 'Selecione uma unidade para fechar o caixa' : undefined}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <CheckCircle className="h-4 w-4" />
                  {selectedCashClosing ? 'Revisar fechamento' : 'Fechar caixa'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[10px] font-black uppercase text-gray-400">Período operacional</p>
                <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">
                  {formatTransactionDate(operationsCenter.startDate)} — {formatTransactionDate(operationsCenter.endDate)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-[10px] font-black uppercase text-amber-600">Pendências / divergências</p>
                <p className="mt-1 text-lg font-black text-amber-700 dark:text-amber-400">
                  {operationsCenter.pending} / {operationsCenter.divergent}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-[10px] font-black uppercase text-emerald-600">Saldo operacional em espécie</p>
                <p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-400">
                  {operationsCenter.cashBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className={`rounded-xl border p-3 ${
                selectedCashClosing?.status === 'CLOSED'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
                  : selectedCashClosing?.status === 'DIVERGENT'
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              }`}>
                <p className="text-[10px] font-black uppercase text-gray-500 dark:text-zinc-400">Fechamento do caixa físico</p>
                <p className={`mt-1 text-sm font-black ${
                  selectedCashClosing?.status === 'CLOSED'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : selectedCashClosing?.status === 'DIVERGENT'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-700 dark:text-zinc-300'
                }`}>
                  {operationsUnit === 'ALL'
                    ? 'Selecione uma unidade'
                    : selectedCashClosing
                      ? `${selectedCashClosing.status === 'CLOSED' ? 'Fechado' : 'Com divergência'} · ${selectedCashClosing.countedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                      : 'Ainda não realizado'}
                </p>
              </div>
            </div>

            <div className="border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Lançamentos rápidos</p>
                <p className="hidden text-[10px] font-semibold text-gray-400 sm:block">A conta de destino será escolhida no formulário.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_OPERATION_PRESETS.map(operation => (
                  <button
                    key={operation.label}
                    type="button"
                    onClick={() => openQuickTransaction(operation.preset)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
                  >
                    + {operation.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase text-gray-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3 text-right">Previsto</th>
                    <th className="px-4 py-3 text-right">Recebido</th>
                    <th className="px-4 py-3 text-right">Saídas</th>
                    <th className="px-4 py-3 text-right">Diferença</th>
                    <th className="px-4 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {operationsCenter.rows.map(row => {
                    const difference = row.expected - row.received;
                    const status = row.divergent > 0
                      ? 'Divergente'
                      : row.pending > 0 || difference > 0.01
                        ? 'Pendente'
                        : 'Conciliado';
                    return (
                      <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.unitName}</td>
                        <td className="px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300">
                          {SOURCE_CHANNEL_OPTIONS.find(option => option.value === row.channel)?.label || row.channel}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{row.expected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600">{row.received.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-500">{row.outgoing.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${Math.abs(difference) > 0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-black ${
                            status === 'Conciliado'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : status === 'Divergente'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {status !== 'Conciliado' && <AlertTriangle className="h-3 w-3" />}
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {operationsCenter.rows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Nenhum movimento encontrado para este período e unidade.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

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
        <BankReconciliation />
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
                    subclassification: '',
                    sourceChannel: 'OTHER',
                    paymentMethod: 'OTHER',
                    movementNature: 'EXPENSE',
                    reconciliationStatus: 'NOT_APPLICABLE'
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

          <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-3 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { label: 'Todos', type: 'ALL', status: 'ALL', source: 'ALL', reconciliation: 'ALL' },
                { label: 'Receitas', type: 'INCOME', status: 'ALL', source: 'ALL', reconciliation: 'ALL' },
                { label: 'Despesas', type: 'EXPENSE', status: 'ALL', source: 'ALL', reconciliation: 'ALL' },
                { label: 'Pendentes', type: 'ALL', status: 'PENDENTE', source: 'ALL', reconciliation: 'ALL' },
                { label: 'Conciliados', type: 'ALL', status: 'ALL', source: 'ALL', reconciliation: 'RECONCILED' },
                { label: 'Caixa físico', type: 'ALL', status: 'ALL', source: 'CASH', reconciliation: 'ALL' },
              ].map(item => {
                const active = filterType === item.type && filterStatus === item.status && filterSourceChannel === item.source && filterReconciliationStatus === item.reconciliation;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => applyCashQuickFilter(item.type, item.status, item.source, item.reconciliation)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${active ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 lg:w-72">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="sr-only">Pesquisar lançamentos</span>
              <input
                type="search"
                value={filterSearch}
                onChange={event => setFilterSearch(event.target.value)}
                placeholder="Pesquisar lançamento..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </label>
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
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Canal de origem</label>
                <select value={filterSourceChannel} onChange={event => setFilterSourceChannel(event.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todos os Canais</option>
                  {SOURCE_CHANNEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Conciliação</label>
                <select value={filterReconciliationStatus} onChange={event => setFilterReconciliationStatus(event.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-sm font-semibold">
                  <option value="ALL">Todas as Situações</option>
                  {RECONCILIATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
              <div className="flex items-end md:col-span-4 md:justify-end">
                <button
                  type="button"
                  onClick={clearCashFilters}
                  disabled={!hasActiveCashFilters}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:text-blue-400 md:w-auto"
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpar filtros
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
             {(caixaTransactions || []).map(t => (
               <div
                 key={t.id}
                 role="button"
                 tabIndex={0}
                 aria-label={`Ver resumo de ${t.description}`}
                 onClick={() => setSelectedTransaction(t)}
                 onKeyDown={event => {
                   if (event.key === 'Enter' || event.key === ' ') {
                     event.preventDefault();
                     setSelectedTransaction(t);
                   }
                 }}
                 className="flex cursor-pointer flex-col sm:flex-row justify-between items-start sm:items-center px-3 py-2.5 rounded-xl border border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-800/30 hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:border-blue-800 dark:hover:bg-blue-950/20 gap-3 transition-colors"
               >
                  <div className="flex gap-3 items-center w-full sm:w-auto min-w-0">
                    <div className={`p-2.5 rounded-lg ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {t.type === 'INCOME' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white flex flex-wrap items-center gap-1.5">
                        <span className="truncate max-w-md">{t.description}</span>
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
                      <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1">
                           <Calendar className="w-3 h-3" />
                           Lan: {formatTransactionDate(t.date)} {t.dueDate ? `| Venc: ${formatTransactionDate(t.dueDate)}` : ''} {t.recurrence !== 'NONE' && t.installmentIndex ? `| (${t.installmentIndex}/${t.installments})` : ''}
                        </span>
                        <span>
                          {t.unitId === 'ALL' ? 'Todas Unidades' : systemUnits?.find(u => u.id === t.unitId)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                     <div className="text-left sm:text-right">
                       <p className={`font-black text-base ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                         {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                       </p>
                       <p className={`text-xs font-bold uppercase tracking-wider ${t.status === 'PENDENTE' ? 'text-amber-500' : t.status === 'AGENDADO' ? 'text-blue-500' : 'text-emerald-500'}`}>
                         {t.status}
                       </p>
                     </div>
                     <div className="flex gap-2">
                       <button
                         onClick={event => {
                           event.stopPropagation();
                           handleEdit(t);
                         }}
                         aria-label={`Editar ${t.description}`}
                         className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:text-blue-500 transition-colors"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                       <button
                         onClick={event => {
                           event.stopPropagation();
                           deleteTransaction(t.id);
                         }}
                         aria-label={`Excluir ${t.description}`}
                         className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 hover:text-red-500 transition-colors"
                       >
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


      {/* RESUMO DO LANÇAMENTO */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-summary-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-zinc-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  Resumo do lançamento
                </p>
                <h2 id="transaction-summary-title" className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                  {selectedTransaction.description}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                aria-label="Fechar resumo"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className={`rounded-xl p-4 ${
                selectedTransaction.type === 'INCOME'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30'
                  : 'bg-red-50 dark:bg-red-950/30'
              }`}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {selectedTransaction.type === 'INCOME' ? 'Receita' : 'Despesa'}
                </p>
                <p className={`mt-1 text-3xl font-black ${
                  selectedTransaction.type === 'INCOME'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {selectedTransaction.type === 'INCOME' ? '+' : '-'}
                  {selectedTransaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${
                  selectedTransaction.status === 'PENDENTE'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : selectedTransaction.status === 'AGENDADO'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                }`}>
                  {selectedTransaction.status}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Conta</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedTransaction.category}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Centro de custo</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedTransactionUnit}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Data do lançamento</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{formatTransactionDate(selectedTransaction.date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Vencimento</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{formatTransactionDate(selectedTransaction.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Fornecedor/origem</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">{selectedTransaction.supplier || 'Não informado'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Classificação</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {selectedTransactionClassification || 'Não informada'}
                    {selectedTransactionSubclass ? ` › ${selectedTransactionSubclass}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Canal / meio</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {SOURCE_CHANNEL_OPTIONS.find(option => option.value === inferSourceChannel(selectedTransaction))?.label || 'Outras fontes'}
                    {selectedTransaction.paymentMethod
                      ? ` › ${PAYMENT_METHOD_OPTIONS.find(option => option.value === selectedTransaction.paymentMethod)?.label || selectedTransaction.paymentMethod}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Natureza / conciliação</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {MOVEMENT_NATURE_OPTIONS.find(option => option.value === (selectedTransaction.movementNature || (selectedTransaction.type === 'INCOME' ? 'REVENUE' : 'EXPENSE')))?.label}
                    {' › '}
                    {RECONCILIATION_STATUS_OPTIONS.find(option => option.value === (selectedTransaction.reconciliationStatus || 'NOT_APPLICABLE'))?.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Recorrência</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {selectedTransaction.recurrence && selectedTransaction.recurrence !== 'NONE'
                      ? `${selectedTransaction.recurrence} — parcela ${selectedTransaction.installmentIndex || 1}/${selectedTransaction.installments || 1}`
                      : 'Sem recorrência'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Banco</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {selectedTransaction.bankName || selectedTransactionAccount?.bankName || 'Não informado'}
                  </dd>
                </div>
              </dl>

              <div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/60">
                <p className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Identificador</p>
                <p className="mt-1 break-all font-mono text-xs text-gray-700 dark:text-zinc-300">{selectedTransaction.id}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-800/30">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="rounded-xl px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  const transaction = selectedTransaction;
                  setSelectedTransaction(null);
                  handleEdit(transaction);
                }}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-700"
              >
                <Edit2 className="h-4 w-4" /> Editar lançamento
              </button>
            </div>
          </div>
        </div>
      )}


      {/* FECHAMENTO DO CAIXA FÍSICO */}
      {isCashClosingOpen && operationsUnit !== 'ALL' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsCashClosingOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-closing-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-zinc-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Conferência diária</p>
                <h2 id="cash-closing-title" className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                  Fechamento do caixa físico
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                  {systemUnits.find(unit => unit.id === operationsUnit)?.name || operationsUnit} · {formatTransactionDate(operationsDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCashClosingOpen(false)}
                aria-label="Fechar"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-gray-500 dark:text-zinc-400">Saldo inicial</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashOpeningBalance}
                    onChange={event => {
                      const value = event.target.value;
                      if (isValidFinancialAmountInput(value)) setCashOpeningBalance(value);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono font-bold dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="0,00"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-gray-500 dark:text-zinc-400">Valor contado no caixa</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashCountedBalance}
                    onChange={event => {
                      const value = event.target.value;
                      if (isValidFinancialAmountInput(value)) setCashCountedBalance(value);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono font-bold dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="0,00"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-black uppercase text-emerald-600">Entradas</p>
                  <p className="mt-1 font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {cashClosingPreview.cashIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                  <p className="text-[10px] font-black uppercase text-red-600">Saídas</p>
                  <p className="mt-1 font-mono text-sm font-black text-red-700 dark:text-red-400">
                    {cashClosingPreview.cashOutflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-100 p-3 dark:bg-zinc-800">
                  <p className="text-[10px] font-black uppercase text-gray-500">Saldo esperado</p>
                  <p className="mt-1 font-mono text-sm font-black text-gray-900 dark:text-white">
                    {cashClosingPreview.expectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${Math.abs(cashClosingPreview.difference) <= 0.01 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
                  <p className="text-[10px] font-black uppercase text-gray-500">Diferença</p>
                  <p className={`mt-1 font-mono text-sm font-black ${Math.abs(cashClosingPreview.difference) <= 0.01 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {cashClosingPreview.difference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase text-gray-500 dark:text-zinc-400">Observações</span>
                <textarea
                  value={cashClosingNotes}
                  onChange={event => setCashClosingNotes(event.target.value)}
                  rows={3}
                  placeholder="Registre sangrias, trocos, gorjetas ou a justificativa de eventual diferença."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-800/30">
              <button
                type="button"
                onClick={() => setIsCashClosingOpen(false)}
                className="rounded-xl px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCashClosing}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-black text-white hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" /> Salvar fechamento
              </button>
            </div>
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
                              newForms[index].movementNature = e.target.value === 'INCOME' ? 'REVENUE' : 'EXPENSE';
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

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Canal de origem</label>
                          <select
                            value={form.sourceChannel || 'OTHER'}
                            onChange={event => {
                              const newForms = [...transForms];
                              newForms[index].sourceChannel = event.target.value as FinancialTransaction['sourceChannel'];
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            {SOURCE_CHANNEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Meio de pagamento</label>
                          <select
                            value={form.paymentMethod || 'OTHER'}
                            onChange={event => {
                              const newForms = [...transForms];
                              newForms[index].paymentMethod = event.target.value as FinancialTransaction['paymentMethod'];
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            {PAYMENT_METHOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Natureza do movimento</label>
                          <select
                            value={form.movementNature || (form.type === 'INCOME' ? 'REVENUE' : 'EXPENSE')}
                            onChange={event => {
                              const newForms = [...transForms];
                              newForms[index].movementNature = event.target.value as FinancialTransaction['movementNature'];
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            {MOVEMENT_NATURE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">Situação da conciliação</label>
                          <select
                            value={form.reconciliationStatus || 'NOT_APPLICABLE'}
                            onChange={event => {
                              const newForms = [...transForms];
                              newForms[index].reconciliationStatus = event.target.value as FinancialTransaction['reconciliationStatus'];
                              setTransForms(newForms);
                            }}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm"
                          >
                            {RECONCILIATION_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                           type="text"
                           inputMode="decimal"
                           placeholder="0,00"
                           value={form.amount || ''}
                           onChange={e => {
                             const rawValue = e.target.value;
                             if (!isValidFinancialAmountInput(rawValue)) return;
                             const newForms = [...transForms];
                             newForms[index].amount = rawValue;
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
                   disabled={isSavingTransaction}
                   className="px-6 py-2.5 bg-[var(--theme-color)] text-white font-black rounded-xl shadow-lg shadow-[var(--theme-color)]/20 hover:bg-[#ff6b42] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                 >
                   {isSavingTransaction ? 'Salvando...' : 'Salvar Lançamentos'}
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

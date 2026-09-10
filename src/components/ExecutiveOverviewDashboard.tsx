import React, { useEffect, useMemo, useState } from "react";
import { QuarterlyRanking } from './QuarterlyRanking';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Hourglass,
  Package,
  PlusCircle,
  Receipt,
  ReceiptText,
  RefreshCw,
  Scissors,
  Trophy,
  Users,
  Upload,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStore } from "../store";
import type { CashClosing, FinancialTransaction } from "../types";
import { AppBadge, AppEmptyState, appControlClass, cn } from "./ui/AppPrimitives";
import { roundMoney, summarizeCashMovements } from "../services/financialEngine";

type ExecutiveOverviewDashboardProps = {
  selectedUnit: string;
  onUnitChange?: (unitId: string) => void;
  onNavigate: (tabId: string) => void;
  strictUnitScope?: boolean;
  receptionMode?: boolean;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const parseMoneyInput = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const RECEPTION_QUICK_ENTRIES: Array<{ label: string; type: FinancialTransaction['type']; sourceChannel: FinancialTransaction['sourceChannel']; paymentMethod: FinancialTransaction['paymentMethod']; movementNature: FinancialTransaction['movementNature']; status: FinancialTransaction['status']; description: string }> = [
  { label: 'PIX direto', type: 'INCOME', sourceChannel: 'DIRECT_PIX', paymentMethod: 'PIX', movementNature: 'REVENUE', status: 'RECEBIDO', description: 'Recebimento PIX direto' },
  { label: 'Venda em espécie', type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'REVENUE', status: 'RECEBIDO', description: 'Venda recebida em espécie' },
  { label: 'Compra do caixa', type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'EXPENSE', status: 'PAGO', description: 'Compra operacional paga pelo caixa' },
  { label: 'Gorjeta em espécie', type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'TIP', movementNature: 'PASS_THROUGH', status: 'RECEBIDO', description: 'Gorjeta em espécie recebida para repasse' },
  { label: 'Repasse de gorjeta', type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'TIP', movementNature: 'PASS_THROUGH', status: 'PAGO', description: 'Repasse de gorjeta em espécie ao profissional' },
  { label: 'Reforço de troco', type: 'INCOME', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'INTERNAL_TRANSFER', status: 'RECEBIDO', description: 'Reforço de troco no caixa físico' },
  { label: 'Retirada de troco', type: 'EXPENSE', sourceChannel: 'CASH', paymentMethod: 'CASH', movementNature: 'INTERNAL_TRANSFER', status: 'PAGO', description: 'Retirada de troco do caixa físico' },
];

function periodFromOffset(base: Date, offset: number) {
  const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function changeLabel(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? "Movimento iniciado no período" : "Sem variação no período";
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}% vs mês anterior`;
}

function DashboardCard({
  title,
  value,
  detail,
  icon,
  tone = "emerald",
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone?: "emerald" | "red" | "amber" | "cyan";
}) {
  const colors = {
    emerald: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
    red: "text-red-500 bg-red-500/10 ring-red-500/20",
    amber: "text-amber-500 bg-amber-500/10 ring-amber-500/20",
    cyan: "text-cyan-500 bg-cyan-500/10 ring-cyan-500/20",
  }[tone];

  return (
    <article className="app-themed-panel group relative min-h-[132px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-color)]/30 hover:shadow-lg dark:border-white/[0.08] dark:bg-[#062222]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">{title}</p>
          <p className={cn("mt-3 truncate text-[1.45rem] font-black tracking-tight", tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-emerald-500")}>{value}</p>
          <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-zinc-500">{detail}</p>
        </div>
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1", colors)}>{icon}</span>
      </div>
    </article>
  );
}

function PriorityCard({
  icon,
  title,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  detail: string;
  tone: "red" | "emerald" | "amber" | "cyan";
  onClick: () => void;
}) {
  const tones = {
    red: "bg-red-500/12 text-red-500",
    emerald: "bg-emerald-500/12 text-emerald-500",
    amber: "bg-amber-500/12 text-amber-500",
    cyan: "bg-cyan-500/12 text-cyan-500",
  }[tone];

  return (
    <button onClick={onClick} className="app-themed-panel group flex min-h-[88px] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-color)]/35 dark:border-white/[0.08] dark:bg-[#062222]">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-gray-800 dark:text-zinc-100">{title}</span>
        <span className={cn("mt-0.5 block text-xl font-black", tones.split(" ")[1])}>{value}</span>
        <span className="block truncate text-[10px] text-gray-400 dark:text-zinc-500">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--theme-color)]" />
    </button>
  );
}

function QuickAction({ icon, title, detail, onClick, tone }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; tone: string }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-left transition hover:border-[var(--theme-color)]/35 hover:bg-[var(--theme-color)]/[0.045] dark:border-white/[0.08] dark:bg-white/[0.025]">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-current/20", tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-extrabold text-gray-900 dark:text-white">{title}</span>
        <span className="block truncate text-[10px] text-gray-400 dark:text-zinc-500">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5" />
    </button>
  );
}

type RankingItem = {
  id: string;
  name: string;
  value: string;
  detail?: string;
};

function RankingPanel({ title, icon, items, emptyText = "Sem dados no período" }: { title: string; icon: React.ReactNode; items: RankingItem[]; emptyText?: string }) {
  return (
    <article className="app-themed-panel overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
        <span className="text-[var(--theme-color)]">{icon}</span>
        <h3 className="text-xs font-black text-gray-950 dark:text-white">{title}</h3>
      </div>
      {items.length > 0 ? (
        <ol className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          {items.map((item, index) => (
            <li key={item.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                index === 0 ? "bg-amber-500/15 text-amber-500" : index === 1 ? "bg-zinc-400/15 text-zinc-500 dark:text-zinc-300" : index === 2 ? "bg-orange-500/15 text-orange-500" : "bg-gray-100 text-gray-500 dark:bg-white/[0.05] dark:text-zinc-400",
              )}>#{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-gray-900 dark:text-zinc-100">{item.name}</span>
                {item.detail && <span className="mt-0.5 block truncate text-[9px] text-gray-400 dark:text-zinc-500">{item.detail}</span>}
              </span>
              <span className="shrink-0 text-right text-xs font-black text-[var(--theme-color)]">{item.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <AppEmptyState className="min-h-0 py-8" icon={<Trophy className="h-5 w-5" />} title={emptyText} description="Os dados importados ou lançados aparecerão aqui." />
      )}
    </article>
  );
}

export function ExecutiveOverviewDashboard({ selectedUnit, onUnitChange, onNavigate, strictUnitScope = false, receptionMode = false }: ExecutiveOverviewDashboardProps) {
  const { transactions, cashClosings, notifications, systemUnits, users, entries, monthlyBarberStats, catalog, currentUser, saveCashClosing, addTransaction } = useStore();
  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [periodInitialized, setPeriodInitialized] = useState(false);
  const [isQuickClosingOpen, setIsQuickClosingOpen] = useState(false);
  const [quickClosingDate, setQuickClosingDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickOpeningBalance, setQuickOpeningBalance] = useState('0,00');
  const [quickCountedBalance, setQuickCountedBalance] = useState('0,00');
  const [quickClosingNotes, setQuickClosingNotes] = useState('');
  const [isSavingQuickClosing, setIsSavingQuickClosing] = useState(false);
  const [quickEntryPreset, setQuickEntryPreset] = useState<(typeof RECEPTION_QUICK_ENTRIES)[number] | null>(null);
  const [quickEntryAmount, setQuickEntryAmount] = useState('');
  const [quickEntryDate, setQuickEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickEntryDescription, setQuickEntryDescription] = useState('');
  const [isSavingQuickEntry, setIsSavingQuickEntry] = useState(false);

  useEffect(() => {
    if (periodInitialized || transactions.length === 0) return;
    const availablePeriods = transactions
      .filter(item => selectedUnit === "ALL" || item.unitId === selectedUnit || (!strictUnitScope && item.unitId === "ALL"))
      .map(item => item.date?.slice(0, 7))
      .filter((period): period is string => Boolean(period))
      .sort();
    const latestPeriod = availablePeriods.at(-1);
    if (latestPeriod) setSelectedPeriod(latestPeriod);
    setPeriodInitialized(true);
  }, [periodInitialized, selectedUnit, strictUnitScope, transactions]);

  const selectedDate = useMemo(() => {
    const [year, month] = selectedPeriod.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedPeriod]);

  const inScope = (item: FinancialTransaction, period = selectedPeriod) =>
    item.date?.startsWith(period) && (selectedUnit === "ALL" || item.unitId === selectedUnit || (!strictUnitScope && item.unitId === "ALL"));

  const periodTransactions = useMemo(
    () => transactions.filter(item => inScope(item)),
    [transactions, selectedPeriod, selectedUnit, strictUnitScope],
  );

  const previousPeriod = periodFromOffset(selectedDate, -1);
  const previousTransactions = useMemo(
    () => transactions.filter(item => inScope(item, previousPeriod)),
    [transactions, previousPeriod, selectedUnit, strictUnitScope],
  );

  const summarize = (items: FinancialTransaction[]) => {
    const summary = summarizeCashMovements(items);
    const income = Math.max(0, summary.recognizedRevenue - summary.commercialDiscounts);
    const expense = summary.recognizedExpenses;
    return { income, expense, balance: roundMoney(income - expense) };
  };

  const totals = useMemo(() => summarize(periodTransactions), [periodTransactions]);
  const previousTotals = useMemo(() => summarize(previousTransactions), [previousTransactions]);
  const pendingReconciliations = periodTransactions.filter(item => ["PENDING", "AWAITING_SETTLEMENT", "DIVERGENT"].includes(item.reconciliationStatus || "")).length;
  const pendingReceivables = periodTransactions.filter(item => item.type === "INCOME" && ["PENDENTE", "AGENDADO"].includes(item.status));
  const scheduledExpenses = periodTransactions.filter(item => item.type === "EXPENSE" && ["PENDENTE", "AGENDADO"].includes(item.status));
  const periodClosings = cashClosings.filter(item => item.date.startsWith(selectedPeriod) && (selectedUnit === "ALL" || item.unitId === selectedUnit));
  const divergentClosings = periodClosings.filter(item => item.status === "DIVERGENT").length;

  const quickClosingPreview = useMemo(() => {
    const movements = transactions.filter(item => item.unitId === selectedUnit && item.date === quickClosingDate && (item.sourceChannel === 'CASH' || item.paymentMethod === 'CASH'));
    const cash = summarizeCashMovements(movements);
    const cashIncome = cash.cashIn;
    const cashOutflow = cash.cashOut;
    const openingBalance = parseMoneyInput(quickOpeningBalance);
    const countedBalance = parseMoneyInput(quickCountedBalance);
    const expectedBalance = Number((openingBalance + cashIncome - cashOutflow).toFixed(2));
    return { openingBalance, countedBalance, cashIncome, cashOutflow, expectedBalance, difference: Number((countedBalance - expectedBalance).toFixed(2)) };
  }, [quickClosingDate, quickCountedBalance, quickOpeningBalance, selectedUnit, transactions]);

  const openQuickClosing = () => {
    const existing = cashClosings.find(item => item.unitId === selectedUnit && item.date === quickClosingDate);
    const previous = cashClosings.filter(item => item.unitId === selectedUnit && item.date < quickClosingDate).sort((a, b) => b.date.localeCompare(a.date))[0];
    setQuickOpeningBalance(String(existing?.openingBalance ?? previous?.countedBalance ?? 0).replace('.', ','));
    setQuickCountedBalance(String(existing?.countedBalance ?? 0).replace('.', ','));
    setQuickClosingNotes(existing?.notes || '');
    setIsQuickClosingOpen(true);
  };

  const submitQuickClosing = async () => {
    if (!selectedUnit || selectedUnit === 'ALL' || selectedUnit === '__SEM_UNIDADE__') return;
    const closing: CashClosing = { id: `cash_closing_${selectedUnit}_${quickClosingDate}`, unitId: selectedUnit, date: quickClosingDate, openingBalance: quickClosingPreview.openingBalance, cashIncome: Number(quickClosingPreview.cashIncome.toFixed(2)), cashOutflow: Number(quickClosingPreview.cashOutflow.toFixed(2)), expectedBalance: quickClosingPreview.expectedBalance, countedBalance: quickClosingPreview.countedBalance, difference: quickClosingPreview.difference, status: Math.abs(quickClosingPreview.difference) <= 0.01 ? 'CLOSED' : 'DIVERGENT', notes: quickClosingNotes.trim() || undefined, closedAt: new Date().toISOString(), closedBy: currentUser?.id };
    try {
      setIsSavingQuickClosing(true);
      await saveCashClosing(closing);
      setIsQuickClosingOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o fechamento.');
    } finally { setIsSavingQuickClosing(false); }
  };

  const openQuickEntry = (preset: (typeof RECEPTION_QUICK_ENTRIES)[number]) => {
    setQuickEntryPreset(preset);
    setQuickEntryAmount('');
    setQuickEntryDate(new Date().toISOString().slice(0, 10));
    setQuickEntryDescription(preset.description);
  };

  const submitQuickEntry = async () => {
    const amount = parseMoneyInput(quickEntryAmount);
    if (!quickEntryPreset || !selectedUnit || selectedUnit === 'ALL' || selectedUnit === '__SEM_UNIDADE__') return;
    if (amount <= 0) {
      window.alert('Informe um valor maior que zero.');
      return;
    }
    const transaction: FinancialTransaction = {
      id: `reception_entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: quickEntryPreset.type,
      category: quickEntryPreset.label,
      description: quickEntryDescription.trim() || quickEntryPreset.description,
      amount: Number(amount.toFixed(2)),
      date: quickEntryDate,
      dueDate: quickEntryDate,
      unitId: selectedUnit,
      status: quickEntryPreset.status,
      recurrence: 'NONE',
      installments: 1,
      classification: quickEntryPreset.type === 'INCOME' ? 'Receita' : 'Despesa',
      subclassification: quickEntryPreset.label,
      sourceChannel: quickEntryPreset.sourceChannel,
      paymentMethod: quickEntryPreset.paymentMethod,
      movementNature: quickEntryPreset.movementNature,
      reconciliationStatus: quickEntryPreset.movementNature === 'INTERNAL_TRANSFER' ? 'NOT_APPLICABLE' : 'PENDING',
      sourceReference: `reception_quick_${Date.now()}`,
    };
    try {
      setIsSavingQuickEntry(true);
      await addTransaction(transaction);
      setQuickEntryPreset(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSavingQuickEntry(false);
    }
  };

  const chartData = useMemo(() => {
    const days = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const date = `${selectedPeriod}-${day}`;
      const dayItems = periodTransactions.filter(item => item.date === date);
      const cash = summarizeCashMovements(dayItems);
      const income = cash.cashIn;
      const expense = cash.cashOut;
      return { day, entradas: income, saidas: -expense, saldo: income - expense };
    });
  }, [periodTransactions, selectedDate, selectedPeriod]);

  const performanceData = useMemo(() => Array.from({ length: 4 }, (_, index) => {
    const period = periodFromOffset(selectedDate, index - 3);
    const date = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1);
    const items = transactions.filter(item => inScope(item, period));
    return {
      month: `${MONTHS[date.getMonth()].slice(0, 3)}/${String(date.getFullYear()).slice(2)}`,
      receita: summarize(items).income,
      current: period === selectedPeriod,
    };
  }), [transactions, selectedDate, selectedPeriod, selectedUnit, strictUnitScope]);

  const recentTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)).slice(0, 3),
    [periodTransactions],
  );
  const importNotification = notifications.find(item => `${item.title} ${item.message}`.toLocaleLowerCase("pt-BR").includes("import"));
  const selectedUnitName = selectedUnit === "ALL" ? "Todas as unidades" : systemUnits.find(unit => unit.id === selectedUnit)?.name || selectedUnit;

  const rankingData = useMemo(() => {
    type BarberAggregate = {
      barberId: string;
      revenue: number;
      productRevenue: number;
      products: number;
      extrasRevenue: number;
      extras: number;
      clients: number;
      extraCounts: Record<string, number>;
      extraValues: Record<string, number>;
    };

    const aggregates = new Map<string, BarberAggregate>();
    const getAggregate = (barberId: string) => {
      const existing = aggregates.get(barberId);
      if (existing) return existing;
      const created: BarberAggregate = {
        barberId,
        revenue: 0,
        productRevenue: 0,
        products: 0,
        extrasRevenue: 0,
        extras: 0,
        clients: 0,
        extraCounts: {},
        extraValues: {},
      };
      aggregates.set(barberId, created);
      return created;
    };
    const barberInScope = (barberId: string, snapshotUnit?: string | null) => {
      if (selectedUnit === "ALL") return true;
      const user = users.find(item => item.id === barberId);
      return snapshotUnit === selectedUnit || user?.unit === selectedUnit;
    };

    const periodStats = monthlyBarberStats.filter(stat => stat.month === selectedPeriod && barberInScope(stat.barberId, stat.unitId));
    const statsBarberIds = new Set(periodStats.map(stat => stat.barberId));

    periodStats.forEach(stat => {
      const aggregate = getAggregate(stat.barberId);
      aggregate.revenue += stat.faturamentoTotal || 0;
      aggregate.productRevenue += stat.vendaProdutosValor || 0;
      aggregate.products += stat.vendasProdutosQtd || 0;
      aggregate.clients += stat.clientesAtendidos || 0;
      Object.entries(stat.extraCounts || {}).forEach(([id, quantity]) => {
        aggregate.extraCounts[id] = (aggregate.extraCounts[id] || 0) + (quantity || 0);
        aggregate.extras += quantity || 0;
      });
      Object.entries(stat.extraValues || {}).forEach(([id, value]) => {
        aggregate.extraValues[id] = (aggregate.extraValues[id] || 0) + (value || 0);
        aggregate.extrasRevenue += value || 0;
      });
    });

    entries
      .filter(entry => entry.date.startsWith(selectedPeriod) && !entry.isDayOff && !statsBarberIds.has(entry.userId) && barberInScope(entry.userId))
      .forEach(entry => {
        const aggregate = getAggregate(entry.userId);
        aggregate.clients += entry.uniqueClientsServed || entry.clientsServed || 0;
        Object.entries(entry.items || {}).forEach(([itemId, itemEntry]) => {
          const catalogItem = catalog.find(item => item.id === itemId);
          if (!catalogItem) return;
          const revenue = itemEntry.commission || 0;
          const quantity = itemEntry.amount || 0;
          const normalizedType = `${catalogItem.type} ${catalogItem.name}`.toLocaleLowerCase("pt-BR");
          aggregate.revenue += revenue;
          if (normalizedType.includes("product") || normalizedType.includes("produto")) {
            aggregate.productRevenue += revenue;
            aggregate.products += quantity;
          }
          if (normalizedType.includes("extra")) {
            aggregate.extraCounts[itemId] = (aggregate.extraCounts[itemId] || 0) + quantity;
            aggregate.extraValues[itemId] = (aggregate.extraValues[itemId] || 0) + revenue;
            aggregate.extras += quantity;
            aggregate.extrasRevenue += revenue;
          }
        });
      });

    const activeBarbers = [...aggregates.values()]
      .map(aggregate => ({ ...aggregate, user: users.find(user => user.id === aggregate.barberId) }))
      .filter(item => item.user?.role === "BARBER");
    const displayName = (name?: string) => name?.trim() || "Barbeiro";
    const topFive = <T,>(items: T[], getValue: (item: T) => number) => [...items].filter(item => getValue(item) > 0).sort((a, b) => getValue(b) - getValue(a)).slice(0, 5);

    const revenue = topFive(activeBarbers, item => item.revenue).map(item => ({
      id: item.barberId,
      name: displayName(item.user?.name),
      value: money.format(item.revenue),
      detail: `${item.clients} clientes atendidos`,
    }));
    const products = topFive(activeBarbers, item => item.products).map(item => ({
      id: item.barberId,
      name: displayName(item.user?.name),
      value: `${item.products.toLocaleString("pt-BR")} un`,
      detail: money.format(item.productRevenue),
    }));
    const extras = topFive(activeBarbers, item => item.extras).map(item => ({
      id: item.barberId,
      name: displayName(item.user?.name),
      value: `${item.extras.toLocaleString("pt-BR")} un`,
      detail: money.format(item.extrasRevenue),
    }));
    const clients = topFive(activeBarbers, item => item.clients).map(item => ({
      id: item.barberId,
      name: displayName(item.user?.name),
      value: `${item.clients.toLocaleString("pt-BR")} cli`,
      detail: "Clientes atendidos",
    }));
    const ticket = topFive(activeBarbers, item => item.clients > 0 ? item.revenue / item.clients : 0).map(item => ({
      id: item.barberId,
      name: displayName(item.user?.name),
      value: money.format(item.revenue / item.clients),
      detail: "Ticket médio",
    }));

    const serviceTotals = new Map<string, { quantity: number; revenue: number }>();
    activeBarbers.forEach(barber => {
      Object.entries(barber.extraCounts).forEach(([id, quantity]) => {
        const total = serviceTotals.get(id) || { quantity: 0, revenue: 0 };
        total.quantity += quantity || 0;
        total.revenue += barber.extraValues[id] || 0;
        serviceTotals.set(id, total);
      });
    });
    const extraServices = [...serviceTotals.entries()]
      .filter(([, total]) => total.quantity > 0 || total.revenue > 0)
      .sort(([, a], [, b]) => b.revenue - a.revenue || b.quantity - a.quantity)
      .slice(0, 5)
      .map(([id, total]) => ({
        id,
        name: catalog.find(item => item.id === id)?.name || "Serviço extra",
        value: `${total.quantity.toLocaleString("pt-BR")} un`,
        detail: money.format(total.revenue),
      }));


    return { revenue, products, extras, clients, ticket, extraServices };
  }, [catalog, entries, monthlyBarberStats, selectedPeriod, selectedUnit, users]);

  if (receptionMode) {
    return (
      <div className="space-y-5 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Resumo da unidade</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">{selectedUnitName}</h1>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Lançamentos rápidos e fechamentos de caixa da unidade.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-gray-400" /><select value={selectedPeriod} onChange={event => { setSelectedPeriod(event.target.value); setPeriodInitialized(true); }} className={cn(appControlClass, "min-w-[178px]")}>{Array.from({ length: 18 }, (_, index) => { const period = periodFromOffset(now, 5 - index); const [year, month] = period.split('-').map(Number); return <option key={period} value={period}>{MONTHS[month - 1]} {year}</option>; })}</select></label>
            <button type="button" onClick={openQuickClosing} disabled={!selectedUnit || selectedUnit === '__SEM_UNIDADE__'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Fechamento rápido</button>
          </div>
        </div>

        <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
          <div className="mb-3">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-950 dark:text-white">Lançamentos rápidos</h2>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">Registre movimentos do caixa diretamente em {selectedUnitName}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RECEPTION_QUICK_ENTRIES.map(preset => (
              <button key={preset.label} type="button" onClick={() => openQuickEntry(preset)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-black text-gray-800 transition hover:border-[var(--theme-color)] hover:bg-[var(--theme-color)]/[0.07] hover:text-[var(--theme-color)] dark:border-white/[0.1] dark:bg-white/[0.035] dark:text-zinc-100">
                <PlusCircle className="h-3.5 w-3.5" /> {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="app-themed-panel overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-white/[0.06]">
            <div><h2 className="text-base font-black text-gray-950 dark:text-white">Fechamento de Caixa</h2><p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">Conferências registradas em {selectedUnitName}</p></div>
            <AppBadge tone={divergentClosings > 0 ? 'danger' : 'success'}>{periodClosings.length} fechamentos</AppBadge>
          </div>
          {periodClosings.length > 0 ? <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">{[...periodClosings].sort((a, b) => b.date.localeCompare(a.date)).map(closing => <article key={closing.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_repeat(3,minmax(110px,auto))] sm:items-center"><div><p className="text-sm font-black text-gray-900 dark:text-white">{new Date(`${closing.date}T12:00:00`).toLocaleDateString('pt-BR')}</p><p className="text-[10px] text-gray-400">Fechado por {closing.closedBy || 'Recepção'}</p></div><div><span className="block text-[9px] uppercase text-gray-400">Esperado</span><strong className="text-xs">{money.format(closing.expectedBalance)}</strong></div><div><span className="block text-[9px] uppercase text-gray-400">Contado</span><strong className="text-xs">{money.format(closing.countedBalance)}</strong></div><div className="sm:text-right"><AppBadge tone={closing.status === 'DIVERGENT' ? 'danger' : 'success'}>{closing.status === 'DIVERGENT' ? `Diferença ${money.format(closing.difference)}` : 'Conferido'}</AppBadge></div></article>)}</div> : <AppEmptyState className="min-h-0 py-10" icon={<Banknote className="h-5 w-5" />} title="Nenhum fechamento no período" description="Os fechamentos desta unidade aparecerão aqui." />}
        </section>

        {quickEntryPreset && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-2xl"><div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-800"><div><p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-color)]">Lançamento rápido</p><h2 className="mt-1 text-lg font-black text-gray-950 dark:text-white">{quickEntryPreset.label}</h2><p className="text-xs text-gray-500 dark:text-zinc-400">{selectedUnitName}</p></div><button type="button" onClick={() => setQuickEntryPreset(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X className="h-5 w-5" /></button></div><div className="space-y-4 p-4"><label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">Valor</span><input autoFocus inputMode="decimal" value={quickEntryAmount} onChange={event => setQuickEntryAmount(event.target.value)} placeholder="0,00" className={cn(appControlClass, 'w-full font-mono text-base font-black')} /></label><label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">Data</span><input type="date" value={quickEntryDate} onChange={event => setQuickEntryDate(event.target.value)} className={cn(appControlClass, 'w-full')} /></label><label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">Descrição</span><textarea value={quickEntryDescription} onChange={event => setQuickEntryDescription(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-950" /></label></div><div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-zinc-800"><button type="button" onClick={() => setQuickEntryPreset(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Cancelar</button><button type="button" onClick={submitQuickEntry} disabled={isSavingQuickEntry || parseMoneyInput(quickEntryAmount) <= 0} className="rounded-xl bg-[var(--theme-color)] px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{isSavingQuickEntry ? 'Salvando...' : 'Salvar lançamento'}</button></div></div></div>}

        {isQuickClosingOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-800"><div><h2 className="text-lg font-black text-gray-950 dark:text-white">Fechamento rápido</h2><p className="text-xs text-gray-500 dark:text-zinc-400">{selectedUnitName}</p></div><button type="button" onClick={() => setIsQuickClosingOpen(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button></div><div className="space-y-4 p-4"><label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">Data do fechamento</span><input type="date" value={quickClosingDate} onChange={event => setQuickClosingDate(event.target.value)} className={cn(appControlClass, 'w-full')} /></label><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-bold text-gray-500">Saldo inicial</span><input inputMode="decimal" value={quickOpeningBalance} onChange={event => setQuickOpeningBalance(event.target.value)} className={cn(appControlClass, 'w-full font-mono')} /></label><label><span className="mb-1 block text-xs font-bold text-gray-500">Valor contado no caixa</span><input inputMode="decimal" value={quickCountedBalance} onChange={event => setQuickCountedBalance(event.target.value)} className={cn(appControlClass, 'w-full font-mono')} /></label></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Entradas', quickClosingPreview.cashIncome, 'text-emerald-600'], ['Saídas', quickClosingPreview.cashOutflow, 'text-red-600'], ['Esperado', quickClosingPreview.expectedBalance, 'text-gray-900 dark:text-white'], ['Diferença', quickClosingPreview.difference, Math.abs(quickClosingPreview.difference) <= .01 ? 'text-emerald-600' : 'text-amber-600']].map(([label, value, tone]) => <div key={String(label)} className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800"><span className="text-[9px] font-bold uppercase text-gray-400">{label}</span><p className={`mt-1 text-xs font-black tabular-nums ${tone}`}>{money.format(Number(value))}</p></div>)}</div><label className="block"><span className="mb-1 block text-xs font-bold text-gray-500">Observações</span><textarea value={quickClosingNotes} onChange={event => setQuickClosingNotes(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-950" placeholder="Trocos, gorjetas, retiradas ou justificativa da diferença." /></label></div><div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-zinc-800"><button type="button" onClick={() => setIsQuickClosingOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800">Cancelar</button><button type="button" onClick={submitQuickClosing} disabled={isSavingQuickClosing} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{isSavingQuickClosing ? 'Salvando...' : 'Salvar fechamento'}</button></div></div></div>}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Painel executivo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">Visão Geral</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Resumo financeiro e operacional de {selectedUnitName}.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
            <select aria-label="Filtrar visão geral por unidade" value={selectedUnit} onChange={event => onUnitChange?.(event.target.value)} disabled={!onUnitChange || strictUnitScope} className={cn(appControlClass, "w-full min-w-0 sm:min-w-[190px]")}>
              <option value="ALL">Todas as unidades</option>
              {systemUnits.filter(unit => unit.isActive !== false).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 items-center gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
          <select value={selectedPeriod} onChange={event => { setSelectedPeriod(event.target.value); setPeriodInitialized(true); }} className={cn(appControlClass, "w-full min-w-0 sm:min-w-[178px]")}>
            {Array.from({ length: 18 }, (_, index) => {
              const period = periodFromOffset(now, 5 - index);
              const [year, month] = period.split("-").map(Number);
              return <option key={period} value={period}>{MONTHS[month - 1]} {year}</option>;
            })}
          </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-9">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <DashboardCard title="Receita" value={money.format(totals.income)} detail={changeLabel(totals.income, previousTotals.income)} icon={<CircleDollarSign className="h-6 w-6" />} />
            <DashboardCard title="Despesas" value={money.format(totals.expense)} detail={changeLabel(totals.expense, previousTotals.expense)} icon={<ArrowDownRight className="h-6 w-6" />} tone="red" />
            <DashboardCard title="Saldo" value={money.format(totals.balance)} detail={changeLabel(totals.balance, previousTotals.balance)} icon={<WalletCards className="h-6 w-6" />} tone={totals.balance >= 0 ? "emerald" : "red"} />
            <DashboardCard title="Conciliações pendentes" value={String(pendingReconciliations)} detail="Aguardando sua conferência" icon={<Hourglass className="h-6 w-6" />} tone="amber" />
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-950 dark:text-white">Prioridades do período</h2>
              <span className="text-[10px] text-gray-400 dark:text-zinc-500">Atualizado em tempo real</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <PriorityCard title="Conciliações pendentes" value={pendingReconciliations} detail="Precisam de conferência" icon={<AlertTriangle className="h-5 w-5" />} tone="red" onClick={() => onNavigate("FINANCE_CONCILIACAO_FINTECH")} />
              <PriorityCard title="Recebíveis em aberto" value={pendingReceivables.length} detail={`Total ${money.format(pendingReceivables.reduce((sum, item) => sum + item.amount, 0))}`} icon={<UsersRound className="h-5 w-5" />} tone="emerald" onClick={() => onNavigate("FINANCE_RECEBIMENTOS")} />
              <PriorityCard title="Despesas agendadas" value={scheduledExpenses.length} detail={`Total ${money.format(scheduledExpenses.reduce((sum, item) => sum + item.amount, 0))}`} icon={<CalendarClock className="h-5 w-5" />} tone="amber" onClick={() => onNavigate("FINANCE_DESPESAS")} />
              <PriorityCard title="Fechamentos divergentes" value={divergentClosings} detail={`${periodClosings.length} fechamentos no período`} icon={<Banknote className="h-5 w-5" />} tone="cyan" onClick={() => onNavigate("FINANCE_RESUMO")} />
            </div>
          </section>

          <section className="app-themed-panel overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
              <div>
                <h2 className="text-sm font-black text-gray-950 dark:text-white">Fluxo de caixa</h2>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Entradas, saídas e saldo diário</p>
              </div>
              <AppBadge tone="success">{MONTHS[selectedDate.getMonth()]}</AppBadge>
            </div>
            <div className="h-[270px] p-3 sm:p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.08} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#7d9292" }} interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#7d9292" }} tickFormatter={value => compactMoney.format(Number(value))} />
                  <Tooltip formatter={(value: number) => money.format(Math.abs(value))} contentStyle={{ borderRadius: 12, border: "1px solid color-mix(in srgb, var(--theme-color) 22%, transparent)", background: "var(--app-panel-bg)", color: "#fff" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[0, 0, 4, 4]} maxBarSize={14} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#d8e7e7" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222] lg:col-span-3">
              <div className="mb-4">
                <h2 className="text-sm font-black text-gray-950 dark:text-white">Desempenho financeiro</h2>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Receita realizada nos últimos quatro meses</p>
              </div>
              <div className="grid h-[150px] grid-cols-4 items-end gap-3">
                {performanceData.map(item => {
                  const max = Math.max(...performanceData.map(row => row.receita), 1);
                  return (
                    <div key={item.month} className="flex h-full min-w-0 flex-col justify-end text-center">
                      <span className="mb-2 truncate text-[10px] font-bold text-gray-500 dark:text-zinc-400">{compactMoney.format(item.receita)}</span>
                      <div className={cn("mx-auto w-full max-w-[64px] rounded-t-lg transition-all", item.current ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700")} style={{ height: `${Math.max(10, (item.receita / max) * 100)}px` }} />
                      <span className={cn("mt-2 text-[10px]", item.current ? "font-black text-emerald-500" : "text-gray-400 dark:text-zinc-500")}>{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="app-themed-panel overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222] lg:col-span-2">
              <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
                <h2 className="text-sm font-black text-gray-950 dark:text-white">Atividade recente</h2>
              </div>
              {recentTransactions.length > 0 ? recentTransactions.map(item => (
                <button key={item.id} onClick={() => onNavigate("FINANCE_CAIXA")} className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/[0.025]">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", item.type === "INCOME" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                    {item.type === "INCOME" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-gray-900 dark:text-zinc-100">{item.description}</span>
                    <span className="block text-[9px] text-gray-400 dark:text-zinc-500">{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")} • {money.format(item.amount)}</span>
                  </span>
                  <CheckCircle2 className={cn("h-4 w-4", ["PAGO", "RECEBIDO"].includes(item.status) ? "text-emerald-500" : "text-amber-500")} />
                </button>
              )) : <AppEmptyState className="min-h-0 py-6" icon={<Clock3 className="h-5 w-5" />} title="Sem atividade no período" description="Os lançamentos recentes aparecerão aqui." />}
            </section>
          </div>
        </div>

        <aside className="space-y-4 xl:col-span-3">
          <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <h2 className="mb-3 text-sm font-black text-gray-950 dark:text-white">Atalhos rápidos</h2>
            <div className="space-y-2">
              <QuickAction icon={<PlusCircle className="h-5 w-5" />} title="Novo lançamento" detail="Registrar receita ou despesa" tone="bg-emerald-500/10 text-emerald-500" onClick={() => onNavigate("FINANCE_CAIXA")} />
              <QuickAction icon={<Upload className="h-5 w-5" />} title="Importar relatório" detail="Planilhas, extratos e PDFs" tone="bg-amber-500/10 text-amber-500" onClick={() => onNavigate("IMPORT")} />
              <QuickAction icon={<RefreshCw className="h-5 w-5" />} title="Iniciar conciliação" detail="Conferir fontes e recebimentos" tone="bg-cyan-500/10 text-cyan-500" onClick={() => onNavigate("FINANCE_CONCILIACAO_FINTECH")} />
            </div>
          </section>

          <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <h2 className="text-sm font-black text-gray-950 dark:text-white">Status das importações</h2>
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">Último registro identificado</p>
              <p className="mt-1 line-clamp-2 text-xs font-bold text-gray-900 dark:text-white">{importNotification?.title || "Nenhuma importação recente"}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[9px] text-gray-400 dark:text-zinc-500">{importNotification ? new Date(importNotification.createdAt).toLocaleString("pt-BR") : "Importe um arquivo para começar"}</span>
                {importNotification && <AppBadge tone={importNotification.type === "warning" ? "warning" : "success"}>Registrada</AppBadge>}
              </div>
            </div>
            <button onClick={() => onNavigate("IMPORT")} className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 hover:text-[var(--theme-color)] dark:text-zinc-300 dark:hover:bg-white/[0.025]">
              Ver importações <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <h2 className="text-sm font-black text-gray-950 dark:text-white">Resumo do mês</h2>
            <dl className="mt-3 divide-y divide-gray-100 text-xs dark:divide-white/[0.06]">
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Lançamentos</dt><dd className="font-black text-gray-900 dark:text-white">{periodTransactions.length}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Receitas</dt><dd className="font-black text-emerald-500">{money.format(totals.income)}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Despesas</dt><dd className="font-black text-red-500">{money.format(totals.expense)}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Saldo</dt><dd className={cn("font-black", totals.balance >= 0 ? "text-emerald-500" : "text-red-500")}>{money.format(totals.balance)}</dd></div>
            </dl>
          </section>

          <section className="app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-5 w-5" /></span>
              <div>
                <h2 className="text-xs font-black text-gray-950 dark:text-white">Dados conectados</h2>
                <p className="mt-1 text-[10px] leading-relaxed text-gray-400 dark:text-zinc-500">Indicadores calculados diretamente dos lançamentos, conciliações e fechamentos salvos.</p>
              </div>
            </div>
            <button onClick={() => onNavigate("FINANCE_RESUMO")} className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 transition hover:border-[var(--theme-color)]/35 dark:border-white/[0.08] dark:text-zinc-200">
              <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Ver detalhes</span><ChevronRight className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>

      <section aria-labelledby="overview-rankings-title" className="space-y-3 pt-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Desempenho da equipe</p>
            <h2 id="overview-rankings-title" className="mt-1 flex items-center gap-2 text-lg font-black text-gray-950 dark:text-white">
              <Trophy className="h-5 w-5 text-amber-500" /> Rankings do período
            </h2>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500">{MONTHS[selectedDate.getMonth()]} de {selectedDate.getFullYear()} · {selectedUnitName}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <RankingPanel title="Faturamento de barbeiros" icon={<CircleDollarSign className="h-4 w-4" />} items={rankingData.revenue} />
          <RankingPanel title="Produtos vendidos" icon={<Package className="h-4 w-4" />} items={rankingData.products} />
          <RankingPanel title="Serviços extras por barbeiro" icon={<Scissors className="h-4 w-4" />} items={rankingData.extras} />
          <RankingPanel title="Clientes atendidos" icon={<Users className="h-4 w-4" />} items={rankingData.clients} />
          <RankingPanel title="Ticket médio" icon={<Receipt className="h-4 w-4" />} items={rankingData.ticket} />
          <RankingPanel title="Serviços extras mais vendidos" icon={<RefreshCw className="h-4 w-4" />} items={rankingData.extraServices} />
        </div>

        <div className="grid grid-cols-1">
          <QuarterlyRanking year={selectedDate.getFullYear()} month={selectedDate.getMonth() + 1} unit={selectedUnit} management />
        </div>
      </section>
    </div>
  );
}

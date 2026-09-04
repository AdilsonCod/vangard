import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Hourglass,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Upload,
  UsersRound,
  WalletCards,
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
import type { FinancialTransaction } from "../types";
import { AppBadge, AppEmptyState, appControlClass, cn } from "./ui/AppPrimitives";

type ExecutiveOverviewDashboardProps = {
  selectedUnit: string;
  onNavigate: (tabId: string) => void;
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
    <article className="group relative min-h-[132px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-color)]/30 hover:shadow-lg dark:border-white/[0.08] dark:bg-[#062222]">
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
    <button onClick={onClick} className="group flex min-h-[88px] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-color)]/35 dark:border-white/[0.08] dark:bg-[#062222]">
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

export function ExecutiveOverviewDashboard({ selectedUnit, onNavigate }: ExecutiveOverviewDashboardProps) {
  const { transactions, cashClosings, notifications, systemUnits } = useStore();
  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [periodInitialized, setPeriodInitialized] = useState(false);

  useEffect(() => {
    if (periodInitialized || transactions.length === 0) return;
    const availablePeriods = transactions
      .filter(item => selectedUnit === "ALL" || item.unitId === selectedUnit || item.unitId === "ALL")
      .map(item => item.date?.slice(0, 7))
      .filter((period): period is string => Boolean(period))
      .sort();
    const latestPeriod = availablePeriods.at(-1);
    if (latestPeriod) setSelectedPeriod(latestPeriod);
    setPeriodInitialized(true);
  }, [periodInitialized, selectedUnit, transactions]);

  const selectedDate = useMemo(() => {
    const [year, month] = selectedPeriod.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedPeriod]);

  const inScope = (item: FinancialTransaction, period = selectedPeriod) =>
    item.date?.startsWith(period) && (selectedUnit === "ALL" || item.unitId === selectedUnit || item.unitId === "ALL");

  const periodTransactions = useMemo(
    () => transactions.filter(item => inScope(item)),
    [transactions, selectedPeriod, selectedUnit],
  );

  const previousPeriod = periodFromOffset(selectedDate, -1);
  const previousTransactions = useMemo(
    () => transactions.filter(item => inScope(item, previousPeriod)),
    [transactions, previousPeriod, selectedUnit],
  );

  const summarize = (items: FinancialTransaction[]) => {
    const income = items.filter(item => item.type === "INCOME" && item.status === "RECEBIDO").reduce((sum, item) => sum + item.amount, 0);
    const expense = items.filter(item => item.type === "EXPENSE" && item.status === "PAGO").reduce((sum, item) => sum + item.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const totals = useMemo(() => summarize(periodTransactions), [periodTransactions]);
  const previousTotals = useMemo(() => summarize(previousTransactions), [previousTransactions]);
  const pendingReconciliations = periodTransactions.filter(item => ["PENDING", "AWAITING_SETTLEMENT", "DIVERGENT"].includes(item.reconciliationStatus || "")).length;
  const pendingReceivables = periodTransactions.filter(item => item.type === "INCOME" && ["PENDENTE", "AGENDADO"].includes(item.status));
  const scheduledExpenses = periodTransactions.filter(item => item.type === "EXPENSE" && ["PENDENTE", "AGENDADO"].includes(item.status));
  const periodClosings = cashClosings.filter(item => item.date.startsWith(selectedPeriod) && (selectedUnit === "ALL" || item.unitId === selectedUnit));
  const divergentClosings = periodClosings.filter(item => item.status === "DIVERGENT").length;

  const chartData = useMemo(() => {
    const days = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const date = `${selectedPeriod}-${day}`;
      const dayItems = periodTransactions.filter(item => item.date === date);
      const income = dayItems.filter(item => item.type === "INCOME" && item.status === "RECEBIDO").reduce((sum, item) => sum + item.amount, 0);
      const expense = dayItems.filter(item => item.type === "EXPENSE" && item.status === "PAGO").reduce((sum, item) => sum + item.amount, 0);
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
  }), [transactions, selectedDate, selectedPeriod, selectedUnit]);

  const recentTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)).slice(0, 3),
    [periodTransactions],
  );
  const importNotification = notifications.find(item => `${item.title} ${item.message}`.toLocaleLowerCase("pt-BR").includes("import"));
  const selectedUnitName = selectedUnit === "ALL" ? "Todas as unidades" : systemUnits.find(unit => unit.id === selectedUnit)?.name || selectedUnit;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Painel executivo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">Visão Geral</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Resumo financeiro e operacional de {selectedUnitName}.</p>
        </div>
        <label className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-gray-400" />
          <select value={selectedPeriod} onChange={event => { setSelectedPeriod(event.target.value); setPeriodInitialized(true); }} className={cn(appControlClass, "min-w-[178px]")}>
            {Array.from({ length: 18 }, (_, index) => {
              const period = periodFromOffset(now, 5 - index);
              const [year, month] = period.split("-").map(Number);
              return <option key={period} value={period}>{MONTHS[month - 1]} {year}</option>;
            })}
          </select>
        </label>
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

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
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
                  <Tooltip formatter={(value: number) => money.format(Math.abs(value))} contentStyle={{ borderRadius: 12, border: "1px solid rgba(125,146,146,.2)", background: "#062222", color: "#fff" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[0, 0, 4, 4]} maxBarSize={14} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#d8e7e7" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222] lg:col-span-3">
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

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#062222] lg:col-span-2">
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
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <h2 className="mb-3 text-sm font-black text-gray-950 dark:text-white">Atalhos rápidos</h2>
            <div className="space-y-2">
              <QuickAction icon={<PlusCircle className="h-5 w-5" />} title="Novo lançamento" detail="Registrar receita ou despesa" tone="bg-emerald-500/10 text-emerald-500" onClick={() => onNavigate("FINANCE_CAIXA")} />
              <QuickAction icon={<Upload className="h-5 w-5" />} title="Importar relatório" detail="Planilhas, extratos e PDFs" tone="bg-amber-500/10 text-amber-500" onClick={() => onNavigate("IMPORT")} />
              <QuickAction icon={<RefreshCw className="h-5 w-5" />} title="Iniciar conciliação" detail="Conferir fontes e recebimentos" tone="bg-cyan-500/10 text-cyan-500" onClick={() => onNavigate("FINANCE_CONCILIACAO_FINTECH")} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
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

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
            <h2 className="text-sm font-black text-gray-950 dark:text-white">Resumo do mês</h2>
            <dl className="mt-3 divide-y divide-gray-100 text-xs dark:divide-white/[0.06]">
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Lançamentos</dt><dd className="font-black text-gray-900 dark:text-white">{periodTransactions.length}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Receitas</dt><dd className="font-black text-emerald-500">{money.format(totals.income)}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Despesas</dt><dd className="font-black text-red-500">{money.format(totals.expense)}</dd></div>
              <div className="flex items-center justify-between py-2"><dt className="text-gray-500 dark:text-zinc-400">Saldo</dt><dd className={cn("font-black", totals.balance >= 0 ? "text-emerald-500" : "text-red-500")}>{money.format(totals.balance)}</dd></div>
            </dl>
            <button onClick={() => onNavigate("REPORTS")} className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-xs font-bold text-[var(--theme-color)] transition hover:bg-[var(--theme-color)]/[0.055]">
              Ver relatório completo <ChevronRight className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#062222]">
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
    </div>
  );
}

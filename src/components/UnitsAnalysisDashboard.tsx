import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store";
import {
  ChevronLeft,
  ChevronRight,
  BarChart2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calendar,
  Maximize2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { MonthlyUnitStats } from "../types";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { AppPageHeader, appControlClass } from "./ui/AppPrimitives";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const CardInput = ({
  label,
  value,
  onChange,
  prefix,
  suffix,
  isReadOnly = false,
}: {
  label: string;
  value: number;
  onChange?: (val: number) => void;
  prefix?: string;
  suffix?: string;
  isReadOnly?: boolean;
}) => {
  const [localVal, setLocalVal] = useState<string>((value || 0).toString());

  useEffect(() => {
    setLocalVal((value || 0).toString());
  }, [value]);

  const handleBlur = () => {
    if (isReadOnly || !onChange) return;
    const num = parseFloat(localVal);
    onChange(isNaN(num) ? 0 : num);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
  };

  return (
    <div className="flex flex-col gap-1 w-full bg-white dark:bg-zinc-800/80 p-3 rounded-xl border border-gray-200 dark:border-zinc-700/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-sm">
      <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 select-none uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-1.5 mt-0.5">
        {prefix && (
          <span className="text-xs font-bold text-gray-400 dark:text-zinc-555 select-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          readOnly={isReadOnly}
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleBlur();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`w-full bg-transparent text-sm font-bold text-gray-800 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isReadOnly ? "cursor-not-allowed text-gray-400 dark:text-zinc-500" : ""}`}
          placeholder="0"
        />
        {suffix && (
          <span className="text-xs font-bold text-gray-400 dark:text-zinc-555 select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

const EditableCell = ({
  value,
  onChange,
  isCurrency = false,
  isPercentage = false,
}: {
  value: number;
  onChange: (val: number) => void;
  isCurrency?: boolean;
  isPercentage?: boolean;
}) => {
  const [val, setVal] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => setVal(value), [value]);

  const handleBlur = () => {
    setEditing(false);
    if (val !== value) onChange(Number(val) || 0);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Enter" && handleBlur()}
        className="w-24 text-center bg-white dark:bg-zinc-900 border border-blue-500 rounded px-1 py-1 text-sm outline-none"
      />
    );
  }

  let displayVal = val.toString();
  if (isCurrency) {
    displayVal = val.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  } else if (isPercentage) {
    displayVal = `${val.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`;
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-1 rounded transition-colors text-center min-w-[60px] min-h-[24px] inline-block font-medium text-blue-600 dark:text-blue-400"
      title="Clique para editar"
    >
      {displayVal}
    </div>
  );
};

function MiniChart({
  data,
  dataKey,
  color,
  name,
  isCurrency,
  isPercentage,
}: {
  data: any[];
  dataKey: string;
  color: string;
  name: string;
  isCurrency?: boolean;
  isPercentage?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isExpanded]);

  const formatValue = (value: number) => {
    if (isCurrency) {
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
    if (isPercentage) {
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  const mobileValues = data.map((item) => Number(item?.[dataKey]) || 0);
  const mobileMaximum = Math.max(...mobileValues.map((value) => Math.abs(value)), 0);
  const hasMobileData = mobileMaximum > 0;

  const chart = (expanded = false) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={expanded ? { top: 18, right: 24, bottom: 12, left: 20 } : undefined}>
        {expanded && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />}
        {expanded && (
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#789090" }}
          />
        )}
        {expanded && (
          <YAxis
            axisLine={false}
            tickLine={false}
            width={78}
            tick={{ fontSize: 11, fill: "#789090" }}
            tickFormatter={(value) => isCurrency ? `R$ ${Number(value).toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}` : isPercentage ? `${value}%` : Number(value).toLocaleString("pt-BR", { notation: "compact" })}
          />
        )}
        <Tooltip
          cursor={{ fill: "rgba(16,185,129,0.06)" }}
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const value = Number(payload[0].value || 0);
              return (
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                  {expanded && <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{label}</span>}
                  <span className="font-bold text-gray-900 dark:text-zinc-100">{formatValue(value)}</span>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={expanded ? [7, 7, 0, 0] : [2, 2, 0, 0]}
          maxBarSize={expanded ? 54 : undefined}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ampliar gráfico ${name}`}
      onClick={() => setIsExpanded(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsExpanded(true);
        }
      }}
      className="group cursor-zoom-in bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 flex flex-col items-center transition hover:-translate-y-0.5 hover:border-[var(--theme-color)]/40 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]/30"
    >
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <h3 className="truncate text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          {name}
        </h3>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition group-hover:bg-[var(--theme-color)]/10 group-hover:text-[var(--theme-color)] dark:text-zinc-500" title="Ampliar gráfico">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex h-28 w-full items-end sm:hidden">
        {hasMobileData ? (
          <div className="flex h-full w-full items-end gap-1" role="img" aria-label={`Gráfico mensal de ${name}`}>
            {data.map((item, index) => {
              const value = mobileValues[index];
              const barHeight = value === 0 ? 0 : Math.max(5, Math.round((Math.abs(value) / mobileMaximum) * 100));
              const monthLabel = String(item?.name || index + 1).slice(0, 1).toUpperCase();
              return (
                <span
                  key={`${String(item?.name || index)}-${index}`}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                  title={`${String(item?.name || `Mês ${index + 1}`)}: ${formatValue(value)}`}
                  aria-label={`${String(item?.name || `Mês ${index + 1}`)}: ${formatValue(value)}`}
                >
                  <span className="flex min-h-0 flex-1 items-end overflow-hidden rounded-t-sm bg-gray-200/55 dark:bg-black/20">
                    <span
                      className="block w-full rounded-t-sm"
                      style={{ height: `${barHeight}%`, backgroundColor: color }}
                    />
                  </span>
                  <span className="block text-center text-[8px] font-bold leading-none text-gray-400 dark:text-zinc-500">{monthLabel}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 text-center dark:border-zinc-700">
            <BarChart2 className="mb-1.5 h-5 w-5 text-gray-300 dark:text-zinc-600" />
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500">Sem dados neste período</span>
          </div>
        )}
      </div>
      <div className="hidden h-24 w-full sm:block">
        {chart()}
      </div>
    </div>

    {isExpanded && (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Gráfico ampliado: ${name}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsExpanded(false);
        }}
      >
        <div className="app-themed-panel flex h-[min(82vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-white/10 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Análise anual da unidade</p>
              <h2 className="mt-1 text-lg font-black text-gray-950 dark:text-white sm:text-xl">{name}</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Comparativo mensal de janeiro a dezembro.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Fechar gráfico ampliado"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-3 sm:p-6">
            {chart(true)}
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-[10px] text-gray-400 dark:border-white/10 dark:text-zinc-500 sm:px-6">
            <span>Passe o cursor sobre as colunas para ver os valores.</span>
            <span>Esc para fechar</span>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function UnitsAnalysisDashboard() {
  const {
    systemUnits,
    catalog,
    monthlyUnitStats,
    updateMonthlyUnitStats,
    deleteMonthlyUnitStats,
    users,
  } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(
    new Date().getMonth(),
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [isShowingSimulateMenu, setIsShowingSimulateMenu] = useState(false);

  const availableUnits = useMemo(() => {
    const list = [...(systemUnits || [])];
    const statUnitIds = new Set(
      monthlyUnitStats?.map((s) => s.unitId).filter(Boolean),
    );
    statUnitIds.forEach((id) => {
      if (!list.find((u) => u.id === id) && id !== "ALL") {
        list.push({ id, name: id });
      }
    });
    const userUnitIds = new Set(users?.map((u) => u.unit).filter(Boolean));
    userUnitIds.forEach((id) => {
      if (!list.find((u) => u.id === id) && id !== "ALL") {
        list.push({ id, name: id });
      }
    });
    return list;
  }, [systemUnits, monthlyUnitStats, users]);

  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    availableUnits?.[0]?.id || "ALL",
  );

  // Track which months are expanded
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      initial[currentMonthStr] = true;
      return initial;
    },
  );

  // Encontrar serviços extras cadastrados no catálogo (categoria EXTRA_SERVICE)
  const extraServices = useMemo(() => {
    return catalog.filter((c) => c.type === "EXTRA_SERVICE");
  }, [catalog]);

  const handleSimulateStats = async (allMonths: boolean) => {
    setIsSimulating(true);
    setIsShowingSimulateMenu(false);

    try {
      const monthsToFill = allMonths
        ? MONTH_NAMES.map((_, idx) => String(idx + 1).padStart(2, "0"))
        : [String(selectedMonthIdx + 1).padStart(2, "0")];

      // Sort months chronologically to ensure sequential MoM growth logic runs in order
      monthsToFill.sort((a, b) => a.localeCompare(b));

      // Determine units to simulate (if ALL, simulate both ALL and everything in availableUnits)
      const unitsToSimulate =
        selectedUnitId === "ALL"
          ? ["ALL", ...availableUnits.map((u) => u.id)]
          : [selectedUnitId];

      const simulatedInSession: Record<string, MonthlyUnitStats> = {};

      const getPrevMonthStr = (monthStr: string): string => {
        const [year, month] = monthStr.split("-").map(Number);
        if (month === 1) {
          return `${year - 1}-12`;
        }
        return `${year}-${String(month - 1).padStart(2, "0")}`;
      };

      const promises: Promise<void>[] = [];

      for (const mNum of monthsToFill) {
        const monthStr = `${selectedYear}-${mNum}`;
        for (const uid of unitsToSimulate) {
          const statsId = `${monthStr}_${uid}`;

          let prevStats: MonthlyUnitStats | null = null;
          let checkMonth = monthStr;
          for (let i = 0; i < 12; i++) {
            checkMonth = getPrevMonthStr(checkMonth);
            const prevId = `${checkMonth}_${uid}`;
            if (simulatedInSession[prevId]) {
              prevStats = simulatedInSession[prevId];
              break;
            }
            const foundDb = monthlyUnitStats?.find((s) => s.id === prevId);
            if (foundDb) {
              prevStats = foundDb;
              break;
            }
          }

          let faturamentoTotal: number;
          let faturamentoAssinatura: number;
          let assinantes: number;
          let assinantesNovos: number;
          let assinantesCancelados: number;
          let assinantesReativados: number;
          let valorFichaAssinantes: number;
          let clientesNovos: number;
          let clientesSemPreferencia: number;
          let taxaRetorno: number;
          let vendaProdutosValor: number;
          let clientesAtendidos: number;
          let servicosRealizados: number;
          let vendasProdutosQtd: number;
          const extras: Record<string, number> = {};
          const extraVals: Record<string, number> = {};

          if (prevStats) {
            const growth = 0.02 + Math.random() * 0.05;

            faturamentoTotal = Math.floor(
              prevStats.faturamentoTotal *
                (1 + growth) *
                (0.97 + Math.random() * 0.06),
            );
            faturamentoAssinatura = Math.floor(
              prevStats.faturamentoAssinatura *
                (1 + growth * 1.1) *
                (0.96 + Math.random() * 0.08),
            );
            assinantes = Math.floor(
              prevStats.assinantes *
                (1 + growth * 0.8) *
                (0.97 + Math.random() * 0.06),
            );
            assinantesNovos = Math.max(
              5,
              Math.floor(
                (prevStats.assinantesNovos || 10) *
                  (1 + (Math.random() * 0.1 - 0.04)),
              ),
            );
            assinantesCancelados = Math.max(
              2,
              Math.floor(
                (prevStats.assinantesCancelados || 5) *
                  (1 + (Math.random() * 0.12 - 0.06)),
              ),
            );
            assinantesReativados = Math.max(
              1,
              Math.floor(
                (prevStats.assinantesReativados || 3) *
                  (1 + (Math.random() * 0.15 - 0.07)),
              ),
            );
            valorFichaAssinantes = Math.floor(
              (prevStats.valorFichaAssinantes || 28) *
                (1 + (Math.random() * 0.04 - 0.02)),
            );
            clientesNovos = Math.max(
              10,
              Math.floor(
                prevStats.clientesNovos * (1 + (Math.random() * 0.1 - 0.04)),
              ),
            );
            clientesSemPreferencia = Math.max(
              15,
              Math.floor(
                prevStats.clientesSemPreferencia *
                  (1 + (Math.random() * 0.1 - 0.05)),
              ),
            );
            taxaRetorno = Math.min(
              95,
              Math.max(
                30,
                Math.floor(
                  (prevStats.taxaRetorno || 60) *
                    (1 + (Math.random() * 0.04 - 0.02)),
                ),
              ),
            );
            vendaProdutosValor = Math.floor(
              prevStats.vendaProdutosValor *
                (1 + growth * 1.25) *
                (0.95 + Math.random() * 0.1),
            );
            clientesAtendidos = Math.floor(
              prevStats.clientesAtendidos *
                (1 + growth * 0.7) *
                (0.97 + Math.random() * 0.06),
            );
            servicosRealizados = Math.floor(
              clientesAtendidos * (1.15 + Math.random() * 0.22),
            );
            vendasProdutosQtd = Math.max(
              5,
              Math.floor(vendaProdutosValor / (30 + Math.random() * 15)),
            );

            extraServices.forEach((ex) => {
              const prevCount =
                prevStats?.extraCounts?.[ex.id] ??
                Math.floor(15 + Math.random() * 30);
              const count = Math.max(
                5,
                Math.floor(
                  prevCount * (1 + growth) * (0.9 + Math.random() * 0.2),
                ),
              );
              extras[ex.id] = count;
              extraVals[ex.id] = count * 35;
            });
          } else {
            faturamentoTotal = Math.floor(22000 + Math.random() * 26000);
            faturamentoAssinatura = Math.floor(2500 + Math.random() * 4500);
            assinantes = Math.floor(70 + Math.random() * 100);
            assinantesNovos = Math.floor(8 + Math.random() * 12);
            assinantesCancelados = Math.floor(3 + Math.random() * 8);
            assinantesReativados = Math.floor(1 + Math.random() * 5);
            valorFichaAssinantes = Math.floor(22 + Math.random() * 14);
            clientesNovos = Math.floor(40 + Math.random() * 40);
            clientesSemPreferencia = Math.floor(55 + Math.random() * 50);
            taxaRetorno = Math.floor(50 + Math.random() * 25);
            vendaProdutosValor = Math.floor(1200 + Math.random() * 2800);
            clientesAtendidos = Math.floor(450 + Math.random() * 350);
            servicosRealizados = Math.floor(
              clientesAtendidos * (1.15 + Math.random() * 0.2),
            );
            vendasProdutosQtd = Math.max(
              5,
              Math.floor(vendaProdutosValor / (25 + Math.random() * 20)),
            );

            extraServices.forEach((ex) => {
              const count = Math.floor(15 + Math.random() * 30);
              extras[ex.id] = count;
              extraVals[ex.id] = count * 35;
            });
          }

          const record: MonthlyUnitStats = {
            id: statsId,
            unitId: uid,
            month: monthStr,
            faturamentoTotal,
            faturamentoAssinatura,
            assinantes,
            assinantesNovos,
            assinantesCancelados,
            assinantesReativados,
            valorFichaAssinantes,
            clientesNovos,
            clientesSemPreferencia,
            taxaRetorno,
            vendaProdutosValor,
            clientesAtendidos,
            servicosRealizados,
            vendasProdutosQtd,
            extraCounts: extras,
            extraValues: extraVals,
          };

          simulatedInSession[statsId] = record;
          promises.push(updateMonthlyUnitStats(record));
        }
      }

      await Promise.all(promises);
    } catch (err) {
      console.error("Erro ao simular estatísticas:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const [clearConfirmMsg, setClearConfirmMsg] = useState<string | null>(null);
  const [clearConfirmAll, setClearConfirmAll] = useState<boolean>(false);

  const handleClearStats = (allMonths: boolean) => {
    const confirmMsg = allMonths
      ? `Tem certeza que deseja apagar a simulação do ano completo (${selectedYear}) para esta unidade?`
      : `Tem certeza que deseja apagar a simulação do mês de ${MONTH_NAMES[selectedMonthIdx]} para esta unidade?`;

    setClearConfirmMsg(confirmMsg);
    setClearConfirmAll(allMonths);
    setIsShowingSimulateMenu(false);
  };

  const executeClearStats = async () => {
    setIsSimulating(true);
    setClearConfirmMsg(null);

    try {
      const monthsToClear = clearConfirmAll
        ? MONTH_NAMES.map((_, idx) => String(idx + 1).padStart(2, "0"))
        : [String(selectedMonthIdx + 1).padStart(2, "0")];

      const unitsToClear =
        selectedUnitId === "ALL"
          ? ["ALL", ...availableUnits.map((u) => u.id)]
          : [selectedUnitId];

      const promises: Promise<void>[] = [];

      for (const mNum of monthsToClear) {
        const monthStr = `${selectedYear}-${mNum}`;
        for (const uid of unitsToClear) {
          const statsId = `${monthStr}_${uid}`;
          promises.push(deleteMonthlyUnitStats(statsId));
        }
      }

      await Promise.all(promises);
    } catch (err) {
      console.error("Erro ao apagar estatísticas:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const monthRows = useMemo(() => {
    return MONTH_NAMES.map((monthName, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      const monthStr = `${selectedYear}-${monthNum}`;

      const statsId = `${monthStr}_${selectedUnitId}`;
      const savedStats = monthlyUnitStats?.find((s) => s.id === statsId) || {
        id: statsId,
        unitId: selectedUnitId,
        month: monthStr,
        faturamentoTotal: 0,
        faturamentoAssinatura: 0,
        assinantes: 0,
        assinantesNovos: 0,
        assinantesCancelados: 0,
        assinantesReativados: 0,
        frequenciaAssinantes: 0,
        valorFichaAssinantes: 0,
        clientesNovos: 0,
        clientesSemPreferencia: 0,
        taxaRetorno: 0,
        vendaProdutosValor: 0,
        clientesAtendidos: 0,
        servicosRealizados: 0,
        vendasProdutosQtd: 0,
        extraCounts: {},
        extraValues: {},
      };

      const clientesAtendidos = savedStats.clientesAtendidos || 0;
      const servicosRealizados = savedStats.servicosRealizados || 0;
      const vendasProdutosQtd = savedStats.vendasProdutosQtd || 0;
      const extraCounts = savedStats.extraCounts || {};
      const extraValues = savedStats.extraValues || {};

      return {
        ...savedStats,
        name: monthName.substring(0, 3),
        monthName,
        monthNum,
        clientesAtendidos,
        servicosRealizados,
        vendasProdutosQtd,
        extraCounts,
        extraValues,
        ticketMedio:
          clientesAtendidos > 0
            ? (savedStats.faturamentoTotal || 0) / clientesAtendidos
            : 0,
        geracaoDemanda:
          (savedStats.clientesNovos || 0) +
          (savedStats.clientesSemPreferencia || 0),
      };
    });
  }, [selectedYear, selectedUnitId, monthlyUnitStats]);

  const handleUpdate = async (
    row: any,
    field: string,
    val: number,
    extraId?: string,
    isExtraCount?: boolean,
  ) => {
    const updatePayload: any = {
      id: row.id,
      unitId: row.unitId,
      month: row.month,
      faturamentoTotal: row.faturamentoTotal || 0,
      faturamentoAssinatura: row.faturamentoAssinatura || 0,
      assinantes: row.assinantes || 0,
      assinantesNovos: row.assinantesNovos || 0,
      assinantesCancelados: row.assinantesCancelados || 0,
      assinantesReativados: row.assinantesReativados || 0,
      frequenciaAssinantes: row.frequenciaAssinantes || 0,
      valorFichaAssinantes: row.valorFichaAssinantes || 0,
      clientesNovos: row.clientesNovos || 0,
      clientesSemPreferencia: row.clientesSemPreferencia || 0,
      taxaRetorno: row.taxaRetorno || 0,
      vendaProdutosValor: row.vendaProdutosValor || 0,
      clientesAtendidos: row.clientesAtendidos || 0,
      servicosRealizados: row.servicosRealizados || 0,
      vendasProdutosQtd: row.vendasProdutosQtd || 0,
      extraCounts: { ...(row.extraCounts || {}) },
      extraValues: { ...(row.extraValues || {}) },
    };

    if (extraId) {
      if (isExtraCount) {
        updatePayload.extraCounts[extraId] = val;
      } else {
        updatePayload.extraValues[extraId] = val;
      }
    } else {
      updatePayload[field] = val;
    }

    await updateMonthlyUnitStats(updatePayload);
  };

  const toggleAll = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    monthRows.forEach((row) => {
      newExpanded[row.month] = expand;
    });
    setExpandedMonths(newExpanded);
  };

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthStr]: !prev[monthStr],
    }));
  };

  const totals = monthRows.reduce(
    (acc, row) => {
      acc.faturamentoTotal += row.faturamentoTotal || 0;
      acc.faturamentoAssinatura += row.faturamentoAssinatura || 0;
      acc.assinantes += row.assinantes || 0;
      acc.assinantesNovos += row.assinantesNovos || 0;
      acc.assinantesCancelados += row.assinantesCancelados || 0;
      acc.assinantesReativados += row.assinantesReativados || 0;
      acc.clientesAtendidos += row.clientesAtendidos;
      acc.servicosRealizados += row.servicosRealizados;
      acc.vendasProdutosQtd += row.vendasProdutosQtd;
      acc.vendasProdutosValor += row.vendaProdutosValor || 0;
      acc.clientesNovos += row.clientesNovos || 0;
      acc.clientesSemPreferencia += row.clientesSemPreferencia || 0;
      acc.geracaoDemanda += row.geracaoDemanda || 0;
      acc.taxaRetornoSum += row.taxaRetorno || 0;

      extraServices.forEach((ex) => {
        acc.extraCounts[ex.id] =
          (acc.extraCounts[ex.id] || 0) + (row.extraCounts[ex.id] || 0);
        acc.extraValues[ex.id] =
          (acc.extraValues[ex.id] || 0) + ((row.extraValues || {})[ex.id] || 0);
      });
      return acc;
    },
    {
      faturamentoTotal: 0,
      faturamentoAssinatura: 0,
      assinantes: 0,
      assinantesNovos: 0,
      assinantesCancelados: 0,
      assinantesReativados: 0,
      clientesAtendidos: 0,
      servicosRealizados: 0,
      vendasProdutosQtd: 0,
      vendasProdutosValor: 0,
      clientesNovos: 0,
      clientesSemPreferencia: 0,
      geracaoDemanda: 0,
      taxaRetornoSum: 0,
      extraCounts: {} as Record<string, number>,
      extraValues: {} as Record<string, number>,
    },
  );

  const [activeTab, setActiveTab] = useState<"BARBEARIA" | "ASSINATURA">(
    "BARBEARIA",
  );

  return (
    <div className="space-y-6">
      <AppPageHeader
        eyebrow="Análises"
        title="Desempenho das unidades"
        description="Compare faturamento, atendimento, produtos e assinaturas por unidade e período."
        icon={<BarChart2 className="h-5 w-5" />}
      />
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      {clearConfirmMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div>
            <p className="text-sm font-semibold text-red-900 dark:text-red-400">
              {clearConfirmMsg}
            </p>
            <p className="text-xs text-red-500 mt-1">
              Essa operação é permanente e não poderá ser desfeita.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setClearConfirmMsg(null)}
              className="px-3.5 py-1.5 border border-gray-250 dark:border-zinc-800 text-gray-700 dark:text-zinc-350 hover:bg-gray-105 dark:hover:bg-zinc-800 text-xs font-bold rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={executeClearStats}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow transition"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("BARBEARIA")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === "BARBEARIA" ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"}`}
            >
              <BarChart2 className="w-4 h-4" />
              Indicadores Barbearia
            </button>
            <button
              onClick={() => setActiveTab("ASSINATURA")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === "ASSINATURA" ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"}`}
            >
              <TrendingUp className="w-4 h-4" />
              Indicadores de Assinatura
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-3">
            Análise de desempenho mensal com suporte para preenchimento manual
            direto nos cards de cada mês.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className={`${appControlClass} w-full cursor-pointer lg:w-auto`}
          >
            <option value="ALL">Todas as Unidades</option>
            {availableUnits.map((su) => (
              <option key={su.id} value={su.id}>
                {su.name}
              </option>
            ))}
          </select>

          <select
            value={selectedMonthIdx}
            onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
            className={`${appControlClass} w-full cursor-pointer lg:w-auto`}
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex w-full items-center justify-between overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 lg:w-auto">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-gray-600 dark:text-zinc-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 font-bold text-gray-800 dark:text-zinc-100 min-w-[80px] text-center">
              {selectedYear}
            </div>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-gray-600 dark:text-zinc-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full lg:w-auto">
            <button
              disabled={isSimulating}
              onClick={() => setIsShowingSimulateMenu(!isShowingSimulateMenu)}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-black shadow-sm transition-all active:scale-95 cursor-pointer select-none lg:w-auto ${
                isSimulating
                  ? "bg-zinc-850 text-zinc-500 border-zinc-700 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              {isSimulating ? "Preenchendo..." : "Preenchimento Rápido"}
            </button>

            {isShowingSimulateMenu && (
              <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 text-left font-sans shadow-lg animate-in fade-in slide-in-from-top-1 sm:left-auto sm:w-64">
                <div className="px-3 py-1.5 border-b border-zinc-800 text-3xs font-bold text-zinc-500 uppercase tracking-widest">
                  Opções de Simulação
                </div>
                <button
                  onClick={() => handleSimulateStats(false)}
                  className="w-full text-left px-4 py-2 hover:bg-purple-950/20 text-xs font-bold text-zinc-100 transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Simular Mês Atual ({MONTH_NAMES[selectedMonthIdx]})
                </button>
                <button
                  onClick={() => handleSimulateStats(true)}
                  className="w-full text-left px-4 py-2 hover:bg-purple-950/20 text-xs font-bold text-purple-400 transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Simular Ano Completo ({selectedYear})
                </button>

                <div className="border-t border-zinc-800 my-1"></div>
                <div className="px-3 py-1 text-[10px] font-bold text-rose-500 uppercase tracking-widest select-none">
                  Excluir / Zerar Dados
                </div>
                <button
                  onClick={() => handleClearStats(false)}
                  className="w-full text-left px-4 py-2 hover:bg-rose-950/20 text-xs font-bold text-rose-450 transition flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Zerar Mês ({MONTH_NAMES[selectedMonthIdx]})
                </button>
                <button
                  onClick={() => handleClearStats(true)}
                  className="w-full text-left px-4 py-2 hover:bg-rose-950/20 text-xs font-bold text-rose-500 transition flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Zerar Ano Completo ({selectedYear})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === "BARBEARIA" ? (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <MiniChart
            data={monthRows}
            dataKey="faturamentoTotal"
            name="Faturamento Total"
            color="var(--theme-500)"
            isCurrency
          />
          <MiniChart
            data={monthRows}
            dataKey="ticketMedio"
            name="Ticket Médio"
            color="var(--theme-300)"
            isCurrency
          />
          <MiniChart
            data={monthRows}
            dataKey="geracaoDemanda"
            name="Geração Demanda"
            color="var(--theme-600)"
          />
          <MiniChart
            data={monthRows}
            dataKey="taxaRetorno"
            name="Taxa de Retorno"
            color="var(--theme-400)"
            isPercentage
          />
          <MiniChart
            data={monthRows}
            dataKey="clientesAtendidos"
            name="Atendimentos"
            color="var(--theme-700)"
          />
          <MiniChart
            data={monthRows}
            dataKey="vendaProdutosValor"
            name="Venda Produtos (R$)"
            color="var(--theme-200)"
            isCurrency
          />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <MiniChart
            data={monthRows}
            dataKey="faturamentoAssinatura"
            name="Faturamento"
            color="var(--theme-500)"
            isCurrency
          />
          <MiniChart
            data={monthRows}
            dataKey="assinantes"
            name="Nº de Assinantes"
            color="var(--theme-300)"
          />
          <MiniChart
            data={monthRows}
            dataKey="assinantesNovos"
            name="Novos Assinantes"
            color="var(--theme-600)"
          />
          <MiniChart
            data={monthRows}
            dataKey="assinantesCancelados"
            name="Cancelamentos"
            color="var(--theme-700)"
          />
          <MiniChart
            data={monthRows}
            dataKey="assinantesReativados"
            name="Reativações"
            color="var(--theme-400)"
          />
          <MiniChart
            data={monthRows}
            dataKey="valorFichaAssinantes"
            name="Valor da Ficha"
            color="var(--theme-200)"
            isCurrency
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 bg-slate-50 dark:bg-zinc-800/45 px-4 py-3 rounded-2xl border border-gray-150 dark:border-zinc-800 gap-2">
        <span className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 font-medium">
          Clique no mês abaixo para expandir e editar os indicadores através dos
          cards.
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAll(true)}
            className="text-2xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/10 transition-all cursor-pointer"
          >
            Expandir Todos
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="text-2xs font-bold text-gray-650 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700/55 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 transition-all cursor-pointer"
          >
            Recolher Todos
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {monthRows.map((row) => {
          const isExpanded = !!expandedMonths[row.month];
          return (
            <div
              key={row.month}
              className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs"
            >
              <div
                onClick={() => toggleMonth(row.month)}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100 dark:bg-zinc-800/25 dark:hover:bg-zinc-800/50 cursor-pointer transition-all select-none gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/15 rounded-xl text-blue-500 dark:text-blue-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm sm:text-base">
                      {row.monthName} / {selectedYear}
                    </h3>
                    <span className="text-3xs font-mono text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                      Mês {row.monthNum}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs">
                  {activeTab === "BARBEARIA" ? (
                    <>
                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Faturamento:
                        </span>
                        <strong className="text-green-600 dark:text-green-400 font-extrabold font-mono">
                          {row.faturamentoTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </strong>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Atendimentos:
                        </span>
                        <strong className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">
                          {row.clientesAtendidos}
                        </strong>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Ticket Médio:
                        </span>
                        <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono">
                          {row.ticketMedio.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Faturamento:
                        </span>
                        <strong className="text-purple-600 dark:text-purple-400 font-extrabold font-mono">
                          {(row.faturamentoAssinatura || 0).toLocaleString(
                            "pt-BR",
                            { style: "currency", currency: "BRL" },
                          )}
                        </strong>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Nº de Assinantes:
                        </span>
                        <strong className="text-blue-600 dark:text-blue-400 font-extrabold font-mono">
                          {row.assinantes || 0}
                        </strong>
                      </div>

                      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800/80">
                        <span className="text-gray-400 dark:text-zinc-500 mr-1.5 font-medium">
                          Valor da Ficha:
                        </span>
                        <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold font-mono">
                          {(row.valorFichaAssinantes || 0).toLocaleString(
                            "pt-BR",
                            { style: "currency", currency: "BRL" },
                          )}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 dark:text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 dark:text-zinc-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-150 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-950/10 space-y-6 animate-in fade-in duration-200">
                  {activeTab === "BARBEARIA" ? (
                    <>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span>
                          Indicadores Principais
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          <CardInput
                            label="Faturamento Total"
                            value={row.faturamentoTotal}
                            onChange={(v) =>
                              handleUpdate(row, "faturamentoTotal", v)
                            }
                            prefix="R$"
                          />
                          <CardInput
                            label="Ticket Médio"
                            value={row.ticketMedio}
                            prefix="R$"
                            isReadOnly
                          />
                          <CardInput
                            label="Atendimentos"
                            value={row.clientesAtendidos}
                            onChange={(v) =>
                              handleUpdate(row, "clientesAtendidos", v)
                            }
                            suffix="un"
                          />
                          <CardInput
                            label="Serviços Realizados"
                            value={row.servicosRealizados}
                            onChange={(v) =>
                              handleUpdate(row, "servicosRealizados", v)
                            }
                            suffix="un"
                          />
                          <CardInput
                            label="Vendas Produtos Qtd"
                            value={row.vendasProdutosQtd}
                            onChange={(v) =>
                              handleUpdate(row, "vendasProdutosQtd", v)
                            }
                            suffix="un"
                          />
                          <CardInput
                            label="Vendas Produtos Valor"
                            value={row.vendaProdutosValor}
                            onChange={(v) =>
                              handleUpdate(row, "vendaProdutosValor", v)
                            }
                            prefix="R$"
                          />
                          <CardInput
                            label="Taxa de Retorno"
                            value={row.taxaRetorno}
                            onChange={(v) =>
                              handleUpdate(row, "taxaRetorno", v)
                            }
                            suffix="%"
                          />
                          <CardInput
                            label="Clientes Novos"
                            value={row.clientesNovos}
                            onChange={(v) =>
                              handleUpdate(row, "clientesNovos", v)
                            }
                            suffix="un"
                          />
                          <CardInput
                            label="Sem Preferência"
                            value={row.clientesSemPreferencia}
                            onChange={(v) =>
                              handleUpdate(row, "clientesSemPreferencia", v)
                            }
                            suffix="un"
                          />
                          <CardInput
                            label="Geração de Demanda"
                            value={row.geracaoDemanda}
                            suffix="un"
                            isReadOnly
                          />
                        </div>
                      </div>

                      {extraServices.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-zinc-800/60 pt-5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-3 bg-amber-500 rounded-full"></span>
                            Serviços Extras
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {extraServices.map((ex) => {
                              const qtd = (row.extraCounts || {})[ex.id] || 0;
                              const val = (row.extraValues || {})[ex.id] || 0;
                              return (
                                <div
                                  key={ex.id}
                                  className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/50 dark:border-amber-900/40 p-4 rounded-xl space-y-3 shadow-sm"
                                >
                                  <div className="text-xs font-bold text-gray-700 dark:text-zinc-350 uppercase select-none border-b border-gray-100 dark:border-zinc-800/80 pb-1 flex items-center justify-between">
                                    <span className="truncate" title={ex.name}>
                                      {ex.name}
                                    </span>
                                    <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-extrabold uppercase">
                                      EXTRA
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <CardInput
                                      label="Quantidade"
                                      value={qtd}
                                      onChange={(v) =>
                                        handleUpdate(
                                          row,
                                          "extraCounts",
                                          v,
                                          ex.id,
                                          true,
                                        )
                                      }
                                      suffix="un"
                                    />
                                    <CardInput
                                      label="Total R$"
                                      value={val}
                                      onChange={(v) =>
                                        handleUpdate(
                                          row,
                                          "extraValues",
                                          v,
                                          ex.id,
                                          false,
                                        )
                                      }
                                      prefix="R$"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-purple-500 rounded-full"></span>
                        Indicadores de Assinatura
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        <CardInput
                          label="Faturamento"
                          value={row.faturamentoAssinatura}
                          onChange={(v) =>
                            handleUpdate(row, "faturamentoAssinatura", v)
                          }
                          prefix="R$"
                        />
                        <CardInput
                          label="Nº de Assinantes"
                          value={row.assinantes}
                          onChange={(v) => handleUpdate(row, "assinantes", v)}
                          suffix="un"
                        />
                        <CardInput
                          label="Novos Assinantes"
                          value={row.assinantesNovos}
                          onChange={(v) =>
                            handleUpdate(row, "assinantesNovos", v)
                          }
                          suffix="un"
                        />
                        <CardInput
                          label="Cancelamentos"
                          value={row.assinantesCancelados}
                          onChange={(v) =>
                            handleUpdate(row, "assinantesCancelados", v)
                          }
                          suffix="un"
                        />
                        <CardInput
                          label="Reativações"
                          value={row.assinantesReativados}
                          onChange={(v) =>
                            handleUpdate(row, "assinantesReativados", v)
                          }
                          suffix="un"
                        />
                        <CardInput
                          label="Frequência"
                          value={row.frequenciaAssinantes}
                          onChange={(v) =>
                            handleUpdate(row, "frequenciaAssinantes", v)
                          }
                          suffix="un"
                        />
                        <CardInput
                          label="Valor da Ficha"
                          value={row.valorFichaAssinantes}
                          onChange={(v) =>
                            handleUpdate(row, "valorFichaAssinantes", v)
                          }
                          prefix="R$"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-slate-50 dark:bg-zinc-800/15 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-base font-bold text-gray-950 dark:text-zinc-50 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Resumo Anual ({selectedYear})
        </h3>

        {activeTab === "BARBEARIA" ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Fat. Total Anual
                </span>
                <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 font-mono">
                  {totals.faturamentoTotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Fat. Assinaturas
                </span>
                <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400 font-mono">
                  {totals.faturamentoAssinatura.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Ticket Médio Geral
                </span>
                <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {(totals.clientesAtendidos > 0
                    ? totals.faturamentoTotal / totals.clientesAtendidos
                    : 0
                  ).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Total Atendimentos
                </span>
                <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                  {totals.clientesAtendidos.toLocaleString("pt-BR")} un
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Serviços Realizados
                </span>
                <span className="text-sm sm:text-base font-black text-gray-800 dark:text-zinc-200 font-mono">
                  {totals.servicosRealizados.toLocaleString("pt-BR")} un
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
                <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                  Taxa Retorno Média
                </span>
                <span className="text-sm sm:text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                  {(totals.taxaRetornoSum / 12).toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                  })}
                  %
                </span>
              </div>
            </div>

            {extraServices.length > 0 && (
              <div className="border-t border-gray-250 dark:border-zinc-800 pt-5 mt-5">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-500 mb-3 block">
                  Acumulado de Serviços Extras ({selectedYear})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {extraServices.map((ex) => {
                    const totalQtd = totals.extraCounts[ex.id] || 0;
                    const totalVal = totals.extraValues[ex.id] || 0;
                    return (
                      <div
                        key={ex.id}
                        className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/50 dark:border-amber-900/40 p-3 rounded-xl shadow-sm"
                      >
                        <span
                          className="text-2xs font-extrabold text-amber-700 dark:text-amber-500 block uppercase mb-1.5 truncate"
                          title={ex.name}
                        >
                          {ex.name}
                        </span>
                        <div className="text-3xs sm:text-2xs dark:text-zinc-300 space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-gray-400 dark:text-zinc-500">
                              Qtd:
                            </span>
                            <span className="font-bold">
                              {totalQtd.toLocaleString("pt-BR")} un
                            </span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-gray-400 dark:text-zinc-500">
                              Total:
                            </span>
                            <span className="font-extrabold text-green-600 dark:text-green-400">
                              {totalVal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
              <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                Fat. Assinaturas
              </span>
              <span className="text-sm sm:text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                {totals.faturamentoAssinatura.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
              <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                Novos Assinantes
              </span>
              <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                {totals.assinantesNovos.toLocaleString("pt-BR")} un
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
              <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                Cancelamentos
              </span>
              <span className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 font-mono">
                {totals.assinantesCancelados.toLocaleString("pt-BR")} un
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800/80 shadow-sm">
              <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider">
                Reativações
              </span>
              <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                {totals.assinantesReativados.toLocaleString("pt-BR")} un
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

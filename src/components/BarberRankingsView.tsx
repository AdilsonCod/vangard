import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import { QuarterlyRanking } from './QuarterlyRanking';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Package,
  Scissors,
  Users,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

export function BarberRankingsView() {
  const { users, entries, catalog, monthlyBarberStats } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );

  const monthStr = `${selectedYear}-${selectedMonth}`;

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

  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth, 10);
    let y = selectedYear;
    m--;
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth, 10);
    let y = selectedYear;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  // 1. Calculate stats per barber for the selected period
  const stats = useMemo(() => {
    const barberStatsMap: Record<
      string,
      {
        faturamentoTotal: number;
        vendaProdutosValor: number;
        vendasProdutosQtd: number;
        faturamentoServicosExtras: number;
        extraCounts: number;
        clientesAtendidos: number;
      }
    > = {};

    entries
      .filter((e) => e.date.startsWith(monthStr) && !e.isDayOff)
      .forEach((e) => {
        if (!barberStatsMap[e.userId]) {
          barberStatsMap[e.userId] = {
            faturamentoTotal: 0,
            vendaProdutosValor: 0,
            vendasProdutosQtd: 0,
            faturamentoServicosExtras: 0,
            extraCounts: 0,
            clientesAtendidos: 0,
          };
        }
        const bStat = barberStatsMap[e.userId];

        // Add distinct clients for this day-entry
        bStat.clientesAtendidos +=
          e.uniqueClientsServed || e.clientsServed || 0;

        Object.keys(e.items || {}).forEach((k) => {
          const catItem = catalog.find((c) => c.id === k);
          const itemVal = e.items[k];
          if (itemVal && catItem) {
            const comm = itemVal.commission || 0;
            const amt = itemVal.amount || 0;
            bStat.faturamentoTotal += comm;

            if (catItem.type === "PRODUCT") {
              bStat.vendaProdutosValor += comm;
              bStat.vendasProdutosQtd += amt;
            }
            if (catItem.type === "EXTRA_SERVICE") {
              bStat.extraCounts += amt;
              bStat.faturamentoServicosExtras += comm;
            }
          }
        });
      });

    const historicalStats = monthlyBarberStats
      ? monthlyBarberStats.filter((s) => s.month === monthStr)
      : [];
    historicalStats.forEach((stat) => {
      if (!barberStatsMap[stat.barberId]) {
        barberStatsMap[stat.barberId] = {
          faturamentoTotal: 0,
          vendaProdutosValor: 0,
          vendasProdutosQtd: 0,
          faturamentoServicosExtras: 0,
          extraCounts: 0,
          clientesAtendidos: 0,
        };
      }
      const bStat = barberStatsMap[stat.barberId];
      bStat.faturamentoTotal += stat.faturamentoTotal || 0;
      bStat.vendaProdutosValor += stat.vendaProdutosValor || 0;
      bStat.vendasProdutosQtd += stat.vendasProdutosQtd || 0;
      bStat.clientesAtendidos += stat.clientesAtendidos || 0;

      if (stat.extraCounts) {
        Object.values(stat.extraCounts).forEach((q) => {
          bStat.extraCounts += q || 0;
        });
      }
      if (stat.extraValues) {
        Object.values(stat.extraValues).forEach((v) => {
          bStat.faturamentoServicosExtras += v || 0;
        });
      }
    });

    return Object.entries(barberStatsMap).map(([barberId, stat]) => ({
      barberId,
      ...stat,
    }));
  }, [entries, monthStr, catalog, monthlyBarberStats]);

  // Rankings
  const rankings = useMemo(() => {
    // 1. Faturamento
    const revenue = stats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          id: s.barberId,
          role: user?.role,
          name: user?.name || "Inativo / Deletado",
          shortName: user?.name?.split(" ")[0] || "Desconhecido",
          value: s.faturamentoTotal || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.shortName !== "Desconhecido")
      .map(({ id, name, shortName, value }) => ({ id, name, shortName, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // 2. Venda de Produtos
    const products = stats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          id: s.barberId,
          role: user?.role,
          name: user?.name || "Inativo / Deletado",
          shortName: user?.name?.split(" ")[0] || "Desconhecido",
          value: s.vendasProdutosQtd || 0,
          revenue: s.vendaProdutosValor || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.shortName !== "Desconhecido")
      .map(({ id, name, shortName, value, revenue }) => ({
        id,
        name,
        shortName,
        value,
        revenue,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // 3. Venda de Serviços Extras
    const extras = stats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          id: s.barberId,
          role: user?.role,
          name: user?.name || "Inativo / Deletado",
          shortName: user?.name?.split(" ")[0] || "Desconhecido",
          value: s.extraCounts || 0,
          revenue: s.faturamentoServicosExtras || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.shortName !== "Desconhecido")
      .map(({ id, name, shortName, value, revenue }) => ({
        id,
        name,
        shortName,
        value,
        revenue,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // 4. Clientes Distintos
    const clients = stats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          id: s.barberId,
          role: user?.role,
          name: user?.name || "Inativo / Deletado",
          shortName: user?.name?.split(" ")[0] || "Desconhecido",
          value: s.clientesAtendidos || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.shortName !== "Desconhecido")
      .map(({ id, name, shortName, value }) => ({ id, name, shortName, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { revenue, products, extras, clients };
  }, [stats, users]);

  const COLORS = [
    "var(--theme-500)",
    "var(--theme-400)",
    "var(--theme-600)",
    "var(--theme-300)",
    "var(--theme-700)",
    "var(--theme-200)",
  ];

  const renderRankingCard = (
    title: string,
    data: any[],
    type: "currency" | "number" | "unit",
    icon: React.ReactNode,
    accentClass: string,
    textAccentClass: string,
  ) => {
    // Podiums
    const podiumIndices = [1, 0, 2]; // 2nd, 1st, 3rd to layout beautifully side-by-side
    const hasData = data.length > 0;

    return (
      <div className="app-themed-panel bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-6 border-b pb-4 border-gray-100 dark:border-zinc-800">
            <div
              className={`p-2 rounded-lg ${accentClass} bg-opacity-10 text-opacity-100`}
            >
              {icon}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm tracking-tight">
              {title}
            </h3>
          </div>

          {!hasData ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
              Sem dados de Lançamentos neste período
            </div>
          ) : (
            <div className="space-y-6">
              {/* Podium Visual */}
              <div className="flex items-end justify-center gap-2 pt-4 pb-6 border-b border-gray-100 dark:border-zinc-800/50">
                {/* 2nd Place */}
                {data[1] && (
                  <div className="flex flex-col items-center flex-1 max-w-[80px]">
                    <div
                      className="text-sm font-semibold text-gray-600 dark:text-zinc-350 truncate w-full text-center"
                      title={data[1].name}
                    >
                      {data[1].shortName}
                    </div>
                    <div className="h-[55px] w-full bg-gray-100 dark:bg-zinc-800 border-t-2 border-slate-350 dark:border-zinc-600 rounded-t-lg mt-2 flex flex-col items-center justify-center relative">
                      <span className="absolute -top-3.5 text-base">🥈</span>
                      <span className="text-[10px] font-black text-gray-500 dark:text-zinc-400">
                        2º
                      </span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {data[0] && (
                  <div className="flex flex-col items-center flex-1 max-w-[90px]">
                    <div
                      className="text-sm font-extrabold text-amber-600 dark:text-amber-500 truncate w-full text-center"
                      title={data[0].name}
                    >
                      {data[0].shortName}
                    </div>
                    <div className="h-[75px] w-full bg-gradient-to-t from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/10 border-t-2 border-amber-500 rounded-t-lg mt-2 flex flex-col items-center justify-center relative">
                      <span className="absolute -top-4.5 text-xl animate-bounce">
                        🥇
                      </span>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                        1º
                      </span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {data[2] && (
                  <div className="flex flex-col items-center flex-1 max-w-[80px]">
                    <div
                      className="text-sm font-semibold text-gray-600 dark:text-zinc-350 truncate w-full text-center"
                      title={data[2].name}
                    >
                      {data[2].shortName}
                    </div>
                    <div className="h-[45px] w-full bg-gray-100/70 dark:bg-zinc-800/60 border-t-2 border-orange-350 dark:border-zinc-700 rounded-t-lg mt-2 flex flex-col items-center justify-center relative">
                      <span className="absolute -top-3.5 text-base">🥉</span>
                      <span className="text-[10px] font-black text-gray-500 dark:text-zinc-400">
                        3º
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Remainder List */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {data.map((barber, i) => {
                  return (
                    <div
                      key={barber.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 flex items-center justify-center rounded-md font-mono font-black text-xs text-gray-400 bg-gray-100 dark:bg-zinc-805 dark:text-zinc-500">
                          #{i + 1}
                        </div>
                        <span
                          className="font-bold text-gray-850 dark:text-zinc-200 text-xs truncate"
                          title={barber.name}
                        >
                          {barber.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {barber.revenue !== undefined &&
                          type !== "currency" && (
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
                              {barber.revenue.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          )}
                        <span
                          className={`text-xs font-black ${textAccentClass}`}
                        >
                          {type === "currency"
                            ? barber.value.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : `${barber.value} un`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Month Selection Banner */}
      <div className="app-themed-panel flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-zinc-100">
              Ranking de Desempenho
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Veja o pódio e o ranking de desempenho entre todos os barbeiros
            </p>
          </div>
        </div>

        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-xl border border-gray-200/50 dark:border-zinc-700">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-4 text-xs font-black min-w-[130px] text-center text-gray-800 dark:text-zinc-200">
            {MONTH_NAMES[parseInt(selectedMonth, 10) - 1]} / {selectedYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rankings Grid */}
      <QuarterlyRanking year={selectedYear} month={Number(selectedMonth)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderRankingCard(
          "Maior Faturamento",
          rankings.revenue,
          "currency",
          <TrendingUp className="w-5 h-5" />,
          "bg-emerald-500 text-emerald-600",
          "text-emerald-600 dark:text-emerald-400",
        )}

        {renderRankingCard(
          "Venda de Produtos",
          rankings.products,
          "unit",
          <Package className="w-5 h-5" />,
          "bg-[var(--theme-color)] text-blue-600",
          "text-blue-600 dark:text-blue-400",
        )}

        {renderRankingCard(
          "Venda de Serviços Extras",
          rankings.extras,
          "unit",
          <Scissors className="w-5 h-5" />,
          "bg-pink-500 text-pink-600",
          "text-pink-600 dark:text-pink-400",
        )}

        {renderRankingCard(
          "Clientes Atendidos (Distintos)",
          rankings.clients,
          "number",
          <Users className="w-5 h-5" />,
          "bg-teal-500 text-teal-600",
          "text-teal-600 dark:text-teal-400",
        )}
      </div>
    </div>
  );
}

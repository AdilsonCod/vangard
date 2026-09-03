import React, { useState, useMemo } from "react";
import { useStore } from "../store";
import {
  TrendingUp,
  Award,
  TrendingDown,
  Package,
  Scissors,
  Users,
  Target as TargetIcon,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export function OverviewDashboard() {
  const {
    systemUnits,
    monthlyUnitStats,
    monthlyBarberStats,
    gdvSettings,
    gdvEntries,
    users,
    entries,
    catalog,
  } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );

  const monthStr = `${selectedYear}-${selectedMonth}`;

  // General Targets from GDV Settings
  const currentGdvSetting = gdvSettings.find((s) => s.id === monthStr);
  const metaGeral = currentGdvSetting?.metaGeral || 0;

  // Actual from Unit Stats (since Unit stats would be the overall sum)
  const currentUnitStats =
    monthlyUnitStats.find((s) => s.id === `${monthStr}_ALL`) ||
    monthlyUnitStats.find((s) => s.month === monthStr); // Assuming 'ALL' or we sum up all units

  const faturamentoTotalReal = useMemo(() => {
    // 1. Try to sum from gdvEntries for the current month (services + products + subscriptions across all units)
    const gdvEntriesForMonth = gdvEntries
      ? gdvEntries.filter(
          (e) =>
            e.id.startsWith(monthStr) ||
            (e.date && e.date.startsWith(monthStr)),
        )
      : [];
    if (gdvEntriesForMonth.length > 0) {
      return gdvEntriesForMonth.reduce((acc, entry) => {
        let entrySva = 0;
        if (entry.units) {
          Object.values(entry.units).forEach((u: any) => {
            const servicos = u.servicos || 0;
            const produtos = u.produtos || 0;
            const assinaturas = u.assinaturas || 0;
            entrySva += servicos + produtos + assinaturas;
          });
        }
        return acc + entrySva;
      }, 0);
    }

    // 2. Fallback to barber entries faturamento
    const totalFromEntries = entries
      ? entries
          .filter((e) => e.date.startsWith(monthStr) && !e.isDayOff)
          .reduce((sum, e) => {
            let entrySum = 0;
            Object.values(e.items || {}).forEach((item) => {
              entrySum += item.commission || 0;
            });
            return sum + entrySum;
          }, 0)
      : 0;

    if (totalFromEntries > 0) return totalFromEntries;

    // 3. Second Fallback to monthlyUnitStats
    const statsForMonth = monthlyUnitStats
      ? monthlyUnitStats.filter((s) => s.month === monthStr)
      : [];
    const allStat = statsForMonth.find((s) => s.unitId === "ALL");
    if (allStat) return allStat.faturamentoTotal || 0;
    return statsForMonth.reduce(
      (acc, curr) => acc + (curr.faturamentoTotal || 0),
      0,
    );
  }, [gdvEntries, entries, monthlyUnitStats, monthStr]);

  const percentAchieved =
    metaGeral > 0 ? (faturamentoTotalReal / metaGeral) * 100 : 0;
  const missingAmmount =
    metaGeral > faturamentoTotalReal ? metaGeral - faturamentoTotalReal : 0;

  const currentMonthlyBarberStats = useMemo(() => {
    const barberStatsMap: Record<
      string,
      {
        faturamentoTotal: number;
        vendaProdutosValor: number;
        vendasProdutosQtd: number;
        extraCounts: Record<string, number>;
        extraValues: Record<string, number>;
        faturamentoAssinatura: number;
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
            extraCounts: {},
            extraValues: {},
            faturamentoAssinatura: 0,
            clientesAtendidos: 0,
          };
        }
        const bStat = barberStatsMap[e.userId];
        
        bStat.clientesAtendidos += (e.uniqueClientsServed || e.clientsServed || 0);

        Object.keys(e.items || {}).forEach((k) => {
          const catItem = catalog.find((c) => c.id === k);
          const itemVal = e.items[k];
          if (itemVal && catItem) {
            const comm = itemVal.commission || 0;
            const amt = itemVal.amount || 0;
            bStat.faturamentoTotal += comm;

            if (catItem.name.toLowerCase().includes("assinatura")) {
              bStat.faturamentoAssinatura += comm;
            }
            if (catItem.type === "PRODUCT") {
              bStat.vendaProdutosValor += comm;
              bStat.vendasProdutosQtd += amt;
            }
            if (catItem.type === "EXTRA_SERVICE") {
              bStat.extraCounts[catItem.id] =
                (bStat.extraCounts[catItem.id] || 0) + amt;
              bStat.extraValues[catItem.id] =
                (bStat.extraValues[catItem.id] || 0) + comm;
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
          extraCounts: {},
          extraValues: {},
          faturamentoAssinatura: 0,
          clientesAtendidos: 0,
        };
      }
      const bStat = barberStatsMap[stat.barberId];
      const statAssinatura = stat.faturamentoAssinatura || 0;
      const statAvulso = stat.faturamentoAvulso !== undefined
        ? stat.faturamentoAvulso
        : Math.max(0, (stat.faturamentoTotal || 0) - statAssinatura);
      const statTotal = (stat.faturamentoTotal !== undefined && stat.faturamentoTotal > 0)
        ? stat.faturamentoTotal
        : (statAvulso + statAssinatura);

      bStat.faturamentoTotal += statTotal;
      bStat.faturamentoAssinatura += statAssinatura;
      bStat.vendaProdutosValor += stat.vendaProdutosValor || 0;
      bStat.vendasProdutosQtd += stat.vendasProdutosQtd || 0;
      bStat.clientesAtendidos += stat.clientesAtendidos || 0;

      if (stat.extraCounts) {
        Object.entries(stat.extraCounts).forEach(([id, q]) => {
          bStat.extraCounts[id] = (bStat.extraCounts[id] || 0) + (q || 0);
        });
      }
      if (stat.extraValues) {
        Object.entries(stat.extraValues).forEach(([id, v]) => {
          bStat.extraValues[id] = (bStat.extraValues[id] || 0) + (v || 0);
        });
      }
    });

    return Object.entries(barberStatsMap).map(([barberId, stat]) => ({
      barberId,
      ...stat,
    }));
  }, [entries, monthStr, catalog, monthlyBarberStats]);

  const extraServicesCatalog = useMemo(() => {
    return catalog.filter((c) => c.type === "EXTRA_SERVICE");
  }, [catalog]);

  // Ranking 1: Extra Service Most Sold (Sorted by Sold Value)
  const extraServicesRanking = useMemo(() => {
    const counts: Record<string, number> = {};
    const values: Record<string, number> = {};

    // 1. Accumulate from barber reports context
    currentMonthlyBarberStats.forEach((bStat) => {
      if (bStat.extraCounts) {
        Object.entries(bStat.extraCounts).forEach(([id, q]) => {
          counts[id] = (counts[id] || 0) + (q || 0);
        });
      }
      if (bStat.extraValues) {
        Object.entries(bStat.extraValues).forEach(([id, v]) => {
          values[id] = (values[id] || 0) + (v || 0);
        });
      }
    });

    // 2. Accumulate from manual units analysis inputs context
    const statsForMonth = monthlyUnitStats
      ? monthlyUnitStats.filter((s) => s.month === monthStr)
      : [];
    statsForMonth.forEach((stat) => {
      if (stat.extraCounts) {
        Object.entries(stat.extraCounts).forEach(([id, q]) => {
          counts[id] = (counts[id] || 0) + (q || 0);
        });
      }
      if (stat.extraValues) {
        Object.entries(stat.extraValues).forEach(([id, v]) => {
          values[id] = (values[id] || 0) + (v || 0);
        });
      }
    });

    return Object.entries(values)
      .map(([id, revenue]) => {
        const item = extraServicesCatalog.find((c) => c.id === id);
        return {
          id,
          name: item?.name || "Desconhecido",
          revenue,
          quantity: counts[id] || 0,
        };
      })
      .filter((item) => item.revenue > 0 && item.name !== "Desconhecido")
      .sort((a, b) => b.revenue - a.revenue);
  }, [
    currentMonthlyBarberStats,
    extraServicesCatalog,
    monthlyUnitStats,
    monthStr,
  ]);

  // Ranking 2: Barber Highest Revenue
  const barbersRevenueRanking = useMemo(() => {
    return currentMonthlyBarberStats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          name: user?.name?.split(" ")[0] || "Desconhecido",
          role: user?.role,
          revenue: s.faturamentoTotal || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.name !== "Desconhecido")
      .map(({ name, revenue }) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [currentMonthlyBarberStats, users]);

  // Ranking 3: Barber Highest Product Sales
  const barbersProductRanking = useMemo(() => {
    return currentMonthlyBarberStats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        return {
          name: user?.name?.split(" ")[0] || "Desconhecido",
          role: user?.role,
          productsSold: s.vendasProdutosQtd || 0,
          revenue: s.vendaProdutosValor || 0,
        };
      })
      .filter((s) => s.role === "BARBER" && s.name !== "Desconhecido")
      .map(({ name, productsSold, revenue }) => ({
        name,
        productsSold,
        revenue,
      }))
      .sort((a, b) => b.productsSold - a.productsSold)
      .slice(0, 6);
  }, [currentMonthlyBarberStats, users]);

  // Ranking 4: Barber Highest Extra Services Sales
  const barbersExtraRanking = useMemo(() => {
    return currentMonthlyBarberStats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        let extraTotal = 0;
        let extraRevenue = 0;
        if (s.extraCounts) {
          extraTotal = Object.values(s.extraCounts).reduce(
            (acc, curr) => acc + (curr || 0),
            0,
          );
        }
        if (s.extraValues) {
          extraRevenue = Object.values(s.extraValues).reduce(
            (acc, curr) => acc + (curr || 0),
            0,
          );
        }
        return {
          name: user?.name?.split(" ")[0] || "Desconhecido",
          role: user?.role,
          extrasSold: extraTotal,
          extraRevenue,
        };
      })
      .filter((s) => s.role === "BARBER" && s.name !== "Desconhecido")
      .map(({ name, extrasSold, extraRevenue }) => ({
        name,
        extrasSold,
        extraRevenue,
      }))
      .sort((a, b) => b.extrasSold - a.extrasSold)
      .slice(0, 6);
  }, [currentMonthlyBarberStats, users]);

  // Ranking 5: Barber Distinct Clients
  const barbersClientsRanking = useMemo(() => {
    const clientsData: Record<string, number> = {};
    entries
      .filter((e) => e.date.startsWith(monthStr) && !e.isDayOff)
      .forEach((e) => {
        clientsData[e.userId] =
          (clientsData[e.userId] || 0) +
          (e.uniqueClientsServed || e.clientsServed || 0);
      });

    const historicalStats = monthlyBarberStats
      ? monthlyBarberStats.filter((s) => s.month === monthStr)
      : [];
    historicalStats.forEach((stat) => {
      clientsData[stat.barberId] =
        (clientsData[stat.barberId] || 0) + (stat.clientesAtendidos || 0);
    });

    return Object.entries(clientsData)
      .map(([userId, clients]) => {
        const user = users.find((u) => u.id === userId);
        return {
          name: user?.name?.split(" ")[0] || "Desconhecido",
          role: user?.role,
          clients,
        };
      })
      .filter((s) => s.role === "BARBER" && s.name !== "Desconhecido")
      .map(({ name, clients }) => ({ name, clients }))
      .sort((a, b) => b.clients - a.clients)
      .slice(0, 6);
  }, [entries, monthStr, users, monthlyBarberStats]);

  // Ranking 6: Barber Average Ticket
  const barbersTicketRanking = useMemo(() => {
    return currentMonthlyBarberStats
      .map((s) => {
        const user = users.find((u) => u.id === s.barberId);
        const ticketMedio = s.clientesAtendidos > 0 ? (s.faturamentoTotal / s.clientesAtendidos) : 0;
        return {
          name: user?.name?.split(" ")[0] || "Desconhecido",
          role: user?.role,
          ticketMedio,
        };
      })
      .filter((s) => s.role === "BARBER" && s.name !== "Desconhecido" && s.ticketMedio > 0)
      .map(({ name, ticketMedio }) => ({ name, ticketMedio }))
      .sort((a, b) => b.ticketMedio - a.ticketMedio)
      .slice(0, 6);
  }, [currentMonthlyBarberStats, users]);

  // Ranking 7: Melhores do Trimestre
  const quarterRanking = useMemo(() => {
    const [yStr, mStr] = monthStr.split("-");
    const m = parseInt(mStr);
    const y = parseInt(yStr);

    const quarter = Math.ceil(m / 3);
    const startMonth = (quarter - 1) * 3 + 1;
    
    const months = [
      `${y}-${String(startMonth).padStart(2, "0")}`,
      `${y}-${String(startMonth + 1).padStart(2, "0")}`,
      `${y}-${String(startMonth + 2).padStart(2, "0")}`
    ];

    const barberStats: Record<
      string,
      {
        barberId: string;
        name: string;
        role: string;
        faturamento: number;
        clientesAtendidos: number;
        vendaProdutos: number;
      }
    > = {};

    months.forEach((targetMonth) => {
      // Find all stats for this month
      const statsForMonth = monthlyBarberStats.filter(s => s.month === targetMonth);
      
      statsForMonth.forEach((stat) => {
        const user = users.find((u) => u.id === stat.barberId);
        if (!user || user.role !== "BARBER") return;

        if (!barberStats[stat.barberId]) {
          barberStats[stat.barberId] = {
            barberId: stat.barberId,
            name: user.name?.split(" ")[0] || "Desconhecido",
            role: user.role,
            faturamento: 0,
            clientesAtendidos: 0,
            vendaProdutos: 0,
          };
        }

        const b = barberStats[stat.barberId];
        b.faturamento += stat.faturamentoTotal || 0;
        b.clientesAtendidos += stat.clientesAtendidos || 0;
        b.vendaProdutos += stat.vendaProdutosValor || 0;
      });
    });

    const stats = Object.values(barberStats);
    
    const statsWithAverages = stats.map(s => {
       const faturamentoMedio = s.faturamento / 3;
       const vendaProdutosMedio = s.vendaProdutos / 3;
       const ticketMedio = s.clientesAtendidos > 0 ? (s.faturamento / s.clientesAtendidos) : 0;
       return {
         ...s,
         faturamentoMedio,
         vendaProdutosMedio,
         ticketMedio,
       };
    });

    const maxFaturamento = Math.max(...statsWithAverages.map(s => s.faturamentoMedio), 1);
    const maxTicketMedio = Math.max(...statsWithAverages.map(s => s.ticketMedio), 1);
    const maxVendaProdutos = Math.max(...statsWithAverages.map(s => s.vendaProdutosMedio), 1);

    const ranked = statsWithAverages.map(s => {
       const scoreFaturamento = (s.faturamentoMedio / maxFaturamento) * 100;
       const scoreTicketMedio = (s.ticketMedio / maxTicketMedio) * 100;
       const scoreVendaProdutos = (s.vendaProdutosMedio / maxVendaProdutos) * 100;
       
       const scoreTotal = scoreFaturamento + scoreTicketMedio + scoreVendaProdutos;

       return {
          ...s,
          scoreTotal,
       };
    }).sort((a, b) => b.scoreTotal - a.scoreTotal).slice(0, 6);

    return {
      quarter,
      year: y,
      ranked
    };
  }, [monthlyBarberStats, monthStr, users]);

  // Custom colors for rankings
  const COLORS = [
    "#FF7852",
    "#E05F3A",
    "#94694c",
    "#7a5339",
    "#558383",
    "#002222",
  ];

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
    let m = parseInt(selectedMonth) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & PERIOD SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-in fade-in">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            Visão Geral (Dashboard)
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Desempenho da barbearia comparado aos objetivos, além de rankings de
            barbeiros e serviços.
          </p>
        </div>

        <div className="flex items-center bg-gray-50 dark:bg-zinc-800 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
          <button
            onClick={handlePrevMonth}
            className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
          </button>
          <div className="px-4 py-2 font-bold text-gray-800 dark:text-zinc-100 min-w-[140px] text-center select-none">
            {MONTH_NAMES[parseInt(selectedMonth) - 1]} / {selectedYear}
          </div>
          <button
            onClick={handleNextMonth}
            className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
          </button>
        </div>
      </div>

      {/* METAS VS FATURAMENTO - COMPARATIVE REPORT */}
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
          <TargetIcon className="w-5 h-5 text-purple-500" />
          Acompanhamento de Objetivos
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4 lg:gap-0 lg:space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
              <span className="block text-2xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Objetivo Geral
              </span>
              <span className="text-2xl sm:text-xl lg:text-3xl font-black text-gray-800 dark:text-zinc-100 font-mono">
                {metaGeral.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
              <span className="block text-2xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1">
                Faturamento Realizado
              </span>
              <span className="text-2xl sm:text-xl lg:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {faturamentoTotalReal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
              <span className="block text-2xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-1">
                Falta para Atingir
              </span>
              <span className="text-2xl sm:text-xl lg:text-3xl font-black text-orange-600 dark:text-orange-400 font-mono">
                {missingAmmount.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-zinc-700 flex flex-col justify-center relative overflow-hidden">
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <h4 className="font-bold text-gray-800 dark:text-zinc-100 text-base sm:text-lg">
                  Progresso
                </h4>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
                  Desempenho da unidade em relação ao objetivo
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400">
                  {Math.min(100, percentAchieved).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-zinc-900 rounded-full h-8 overflow-hidden relative z-10 shadow-inner">
              <div
                className="bg-indigo-500 h-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, percentAchieved)}%` }}
              />
            </div>
            {percentAchieved >= 100 && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-20">
                <Award className="w-64 h-64 text-indigo-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rankings */}

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Faturamento de Barbeiros
          </h3>
          {barbersRevenueRanking.length > 0 ? (
            <div className="space-y-4">
              {barbersRevenueRanking.map((barber, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-500">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {barber.name}
                    </span>
                  </div>
                  <div>
                    <span className="font-black text-green-600 dark:text-green-400">
                      {barber.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <Scissors className="w-5 h-5 text-orange-500" />
            Serviços Extras Mais Vendidos
          </h3>
          {extraServicesRanking.length > 0 ? (
            <div className="space-y-4">
              {extraServicesRanking.map((service, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-555">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">
                      {service.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <span className="font-black text-orange-600 dark:text-orange-400">
                      {service.quantity} un
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <Package className="w-5 h-5 text-[var(--theme-color)]" />
            Venda de Produtos (Qtd por Barbeiro)
          </h3>
          {barbersProductRanking.length > 0 ? (
            <div className="space-y-4">
              {barbersProductRanking.map((barber, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-555">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {barber.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">
                      {barber.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <span className="font-black text-blue-600 dark:text-blue-400">
                      {barber.productsSold} un
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <Award className="w-5 h-5 text-pink-500" />
            Venda de Serviços Extras (Qtd por Barbeiro)
          </h3>
          {barbersExtraRanking.length > 0 ? (
            <div className="space-y-4">
              {barbersExtraRanking.map((barber, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-555">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {barber.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">
                      {(barber.extraRevenue || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <span className="font-black text-pink-600 dark:text-pink-400">
                      {barber.extrasSold} un
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-teal-500" />
            Atendimento a Clientes Distintos (Diários)
          </h3>
          {barbersClientsRanking.length > 0 ? (
            <div className="space-y-4">
              {barbersClientsRanking.map((barber, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-500">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {barber.name}
                    </span>
                  </div>
                  <div>
                    <span className="font-black text-teal-600 dark:text-teal-400">
                      {barber.clients} cli
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
            <Receipt className="w-5 h-5 text-[#8b5cf6]" />
            Ticket Médio
          </h3>
          {barbersTicketRanking.length > 0 ? (
            <div className="space-y-4">
              {barbersTicketRanking.map((barber, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-black text-gray-400 dark:text-zinc-500">
                      #{i + 1}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {barber.name}
                    </span>
                  </div>
                  <div>
                    <span className="font-black text-[#8b5cf6]">
                      {barber.ticketMedio.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-zinc-900 dark:to-zinc-900 p-6 rounded-2xl border border-amber-200 dark:border-zinc-800 shadow-sm flex flex-col lg:col-span-2">
          <h3 className="text-sm font-bold uppercase text-amber-700 dark:text-amber-500 flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            Melhores do {quarterRanking.quarter}º Trimestre de {quarterRanking.year}
          </h3>
          {quarterRanking.ranked.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quarterRanking.ranked.map((barber, i) => {
                const isTop3 = i < 3;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      isTop3 
                        ? i === 0 
                          ? "bg-amber-100/50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-sm"
                          : i === 1
                            ? "bg-gray-100/50 dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-600 shadow-sm"
                            : "bg-orange-100/30 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 shadow-sm"
                        : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className={`font-black ${
                          i === 0 ? "text-amber-500 text-lg" : 
                          i === 1 ? "text-gray-400 text-lg" : 
                          i === 2 ? "text-orange-400 text-lg" : 
                          "text-gray-300 dark:text-zinc-600"
                        }`}>
                          #{i + 1}
                        </div>
                        <span className={`font-bold ${isTop3 ? "text-gray-900 dark:text-zinc-100 text-lg" : "text-gray-700 dark:text-zinc-300"}`}>
                          {barber.name}
                        </span>
                      </div>
                      {isTop3 && (
                        <div className="text-xs font-medium text-gray-500 dark:text-zinc-400 flex flex-col gap-0.5 mt-1">
                          <span>Fat: {barber.faturamentoMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês</span>
                          <span>TM: {barber.ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <span className={`font-black ${isTop3 ? "text-amber-600 dark:text-amber-400 text-xl" : "text-gray-500 dark:text-zinc-500 text-sm"}`}>
                        {barber.scoreTotal.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex-1 flex items-center justify-center">
              Sem dados no período
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

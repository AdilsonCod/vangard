import React, { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  Users,
  Scissors,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Coins,
  ChevronLeft,
  ChevronRight,
  Scale,
  Calendar,
  Percent,
  Star,
  Flame,
  Target,
  SlidersHorizontal,
  DollarSign,
  Edit2
} from "lucide-react";

export function BarberSelfManagementView() {
  const { currentUser, entries, catalog, monthlyBarberStats } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );

  // Goal & Days Worked Configuration
  const [targetCommission, setTargetCommission] = useState<number>(10000);
  const [diasBase, setDiasBase] = useState<number>(22);
  const [rateServicosCommission, setRateServicosCommission] = useState<number>(0.39);
  const [rateCosmeticosCommission, setRateCosmeticosCommission] = useState<number>(0.15);
  const [showGoalConfig, setShowGoalConfig] = useState(false);

  const monthStr = `${selectedYear}-${selectedMonth}`;

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const handlePrevMonth = () => {
    let m = parseInt(selectedMonth) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    let m = parseInt(selectedMonth) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(String(m).padStart(2, "0"));
    setSelectedYear(y);
  };

  // Compute stats from entries & historical monthly records
  const stats = useMemo(() => {
    const userEntries = (entries || []).filter(
      (e) => e.userId === currentUser?.id && e.date?.startsWith(monthStr)
    );

    let clientesAtendidos = 0;
    let uniqueClientesAtendidos = 0;
    let workedDaysCount = 0;
    let servicosBaseValor = 0; // corte + barba + outros servicos base
    let servicosExtrasValor = 0;
    let servicosExtrasQtd = 0;
    let cosmeticosValor = 0;
    let cosmeticosQtd = 0;
    let cosmeticosClientesCount = 0;
    let comissaoServicos = 0;
    let comissaoCosmeticos = 0;

    userEntries.forEach((e) => {
      if (!e.isDayOff) {
        workedDaysCount++;
        clientesAtendidos += e.clientsServed || 0;
        uniqueClientesAtendidos += e.uniqueClientsServed || e.clientsServed || 0;

        let hasCosmeticsInEntry = false;

        Object.keys(e.items || {}).forEach((k) => {
          const catItem = catalog.find((c) => c.id === k);
          const itemVal = e.items[k];
          if (itemVal && catItem) {
            const comm = itemVal.commission || 0;
            const amt = itemVal.amount || 0;

            if (catItem.type === "PRODUCT") {
              cosmeticosValor += comm;
              cosmeticosQtd += amt;
              comissaoCosmeticos += comm;
              if (amt > 0) hasCosmeticsInEntry = true;
            } else if (catItem.type === "EXTRA_SERVICE") {
              servicosExtrasValor += comm;
              servicosExtrasQtd += amt;
              comissaoServicos += comm;
            } else {
              servicosBaseValor += comm;
              comissaoServicos += comm;
            }
          }
        });

        if (hasCosmeticsInEntry) {
          cosmeticosClientesCount += 1;
        }
      }
    });

    // Merge with monthlyBarberStats if present
    const histStat = monthlyBarberStats?.find(
      (s) => s.month === monthStr && s.barberId === currentUser?.id
    );
    if (histStat) {
      if (uniqueClientesAtendidos === 0) {
        uniqueClientesAtendidos = histStat.clientesAtendidos || 0;
        clientesAtendidos = histStat.clientesAtendidos || 0;
      }
      if (comissaoServicos === 0 && histStat.comissao) {
        comissaoServicos = histStat.comissao;
      }
      if (cosmeticosValor === 0 && histStat.vendaProdutosValor) {
        cosmeticosValor = histStat.vendaProdutosValor;
        cosmeticosQtd = histStat.vendasProdutosQtd || 0;
      }
    }

    const hasRealData = uniqueClientesAtendidos > 0 || servicosBaseValor > 0 || comissaoServicos > 0;

    // Realistic baseline fallback from reference model if data is empty
    const currentClients = hasRealData ? (uniqueClientesAtendidos || clientesAtendidos || 1) : 127;
    const currentTicketCorteBarba = hasRealData
      ? (servicosBaseValor > 0 ? Math.round(servicosBaseValor / currentClients) : 111)
      : 111;
    const currentExtrasQtd = hasRealData ? servicosExtrasQtd : 46;
    const currentExtrasValor = hasRealData ? servicosExtrasValor : 46 * 18;
    const currentExtrasTicket = currentExtrasQtd > 0 ? (currentExtrasValor / currentExtrasQtd) : 18;
    const currentCosmeticsClients = hasRealData ? (cosmeticosClientesCount || Math.ceil(currentClients * 0.1)) : 13;
    const currentCosmeticsValor = hasRealData ? (cosmeticosValor || 992) : 992;
    const currentCosmeticsTicket = currentCosmeticsClients > 0 ? (currentCosmeticsValor / currentCosmeticsClients) : 76.30;

    const producaoServicosAtual = (currentClients * currentTicketCorteBarba) + (currentExtrasQtd * currentExtrasTicket);
    const producaoCosmeticosAtual = currentCosmeticsValor;
    const producaoTotalAtual = producaoServicosAtual + producaoCosmeticosAtual;

    const comissaoServicosAtual = hasRealData && comissaoServicos > 0
      ? comissaoServicos
      : (producaoServicosAtual * rateServicosCommission);
    const comissaoCosmeticosAtual = hasRealData && comissaoCosmeticos > 0
      ? comissaoCosmeticos
      : (producaoCosmeticosAtual * rateCosmeticosCommission);
    const comissaoTotalAtual = comissaoServicosAtual + comissaoCosmeticosAtual;

    // Percentages
    const pctClientsWithExtras = Math.round((currentExtrasQtd / currentClients) * 100);
    const pctClientsWithCosmetics = Math.round((currentCosmeticsClients / currentClients) * 100);

    // Goal Math
    const producaoNecessariaMeta = Math.round(targetCommission / rateServicosCommission);
    const faltaProduzir = Math.max(0, producaoNecessariaMeta - producaoTotalAtual);
    const faltaComissao = Math.max(0, targetCommission - comissaoTotalAtual);

    // MODEL 1: MAIS CLIENTES (Keep same conversion rates, expand volume)
    const rateExtrasM1 = currentExtrasQtd / currentClients; // ~36%
    const rateCosmM1 = currentCosmeticsClients / currentClients; // ~10%
    const commPerClientM1 = (currentTicketCorteBarba + rateExtrasM1 * currentExtrasTicket) * rateServicosCommission +
      (rateCosmM1 * currentCosmeticsTicket) * rateCosmeticosCommission;
    const m1_clientes = Math.round(targetCommission / (commPerClientM1 || 51.5));
    const m1_extras = Math.round(m1_clientes * rateExtrasM1);
    const m1_cosmClientes = Math.round(m1_clientes * rateCosmM1);
    const m1_prodServicos = (m1_clientes * currentTicketCorteBarba) + (m1_extras * currentExtrasTicket);
    const m1_prodCosmeticos = m1_cosmClientes * currentCosmeticsTicket;
    const m1_prodTotal = m1_prodServicos + m1_prodCosmeticos;
    const m1_commServicos = m1_prodServicos * rateServicosCommission;
    const m1_commCosmeticos = m1_prodCosmeticos * rateCosmeticosCommission;
    const m1_commTotal = m1_commServicos + m1_commCosmeticos;
    const m1_diffClients = m1_clientes - currentClients;
    const m1_diffPct = Math.round((m1_diffClients / currentClients) * 100);

    // MODEL 2: MAIS VENDA POR CLIENTE (Higher conversion of extras 56% and cosmetics 14%)
    const rateExtrasM2 = 0.556; // 56% dos clientes
    const rateCosmM2 = 0.139; // 14% dos clientes
    const commPerClientM2 = (currentTicketCorteBarba + rateExtrasM2 * currentExtrasTicket) * rateServicosCommission +
      (rateCosmM2 * currentCosmeticsTicket) * rateCosmeticosCommission;
    const m2_clientes = Math.round(targetCommission / (commPerClientM2 || 55.6));
    const m2_extras = Math.round(m2_clientes * rateExtrasM2);
    const m2_cosmClientes = Math.round(m2_clientes * rateCosmM2);
    const m2_prodServicos = (m2_clientes * currentTicketCorteBarba) + (m2_extras * currentExtrasTicket);
    const m2_prodCosmeticos = m2_cosmClientes * currentCosmeticsTicket;
    const m2_prodTotal = m2_prodServicos + m2_prodCosmeticos;
    const m2_commServicos = m2_prodServicos * rateServicosCommission;
    const m2_commCosmeticos = m2_prodCosmeticos * rateCosmeticosCommission;
    const m2_commTotal = m2_commServicos + m2_commCosmeticos;
    const m2_diffClients = m2_clientes - currentClients;
    const m2_diffPct = Math.round((m2_diffClients / currentClients) * 100);

    // MODEL 3: EQUILIBRADO (RECOMENDADO) (Balanced conversion: extras 48% and cosmetics 14%)
    const rateExtrasM3 = 0.476; // 48% dos clientes
    const rateCosmM3 = 0.135; // 14% dos clientes
    const commPerClientM3 = (currentTicketCorteBarba + rateExtrasM3 * currentExtrasTicket) * rateServicosCommission +
      (rateCosmM3 * currentCosmeticsTicket) * rateCosmeticosCommission;
    const m3_clientes = Math.round(targetCommission / (commPerClientM3 || 54.1));
    const m3_extras = Math.round(m3_clientes * rateExtrasM3);
    const m3_cosmClientes = Math.round(m3_clientes * rateCosmM3);
    const m3_prodServicos = (m3_clientes * currentTicketCorteBarba) + (m3_extras * currentExtrasTicket);
    const m3_prodCosmeticos = m3_cosmClientes * currentCosmeticsTicket;
    const m3_prodTotal = m3_prodServicos + m3_prodCosmeticos;
    const m3_commServicos = m3_prodServicos * rateServicosCommission;
    const m3_commCosmeticos = m3_prodCosmeticos * rateCosmeticosCommission;
    const m3_commTotal = m3_commServicos + m3_commCosmeticos;
    const m3_diffClients = m3_clientes - currentClients;
    const m3_diffPct = Math.round((m3_diffClients / currentClients) * 100);

    // Daily Goals (Base Model 3)
    const effectiveDays = diasBase > 0 ? diasBase : 22;
    const dailyClients = (m3_clientes / effectiveDays).toFixed(1).replace(".", ",");
    const dailyExtras = Math.round(m3_extras / effectiveDays);
    const dailyCosmetics = (m3_cosmClientes / effectiveDays).toFixed(1).replace(".", ",");

    return {
      currentClients,
      currentTicketCorteBarba,
      currentExtrasQtd,
      currentExtrasValor,
      currentExtrasTicket,
      currentCosmeticsClients,
      currentCosmeticsValor,
      currentCosmeticsTicket,
      pctClientsWithExtras,
      pctClientsWithCosmetics,
      producaoTotalAtual,
      comissaoTotalAtual,
      comissaoServicosAtual,
      comissaoCosmeticosAtual,
      producaoNecessariaMeta,
      faltaProduzir,
      faltaComissao,
      // Model 1
      m1_clientes,
      m1_extras,
      m1_cosmClientes,
      m1_prodTotal,
      m1_commServicos,
      m1_commCosmeticos,
      m1_commTotal,
      m1_diffClients,
      m1_diffPct,
      // Model 2
      m2_clientes,
      m2_extras,
      m2_cosmClientes,
      m2_prodTotal,
      m2_commServicos,
      m2_commCosmeticos,
      m2_commTotal,
      m2_diffClients,
      m2_diffPct,
      // Model 3
      m3_clientes,
      m3_extras,
      m3_cosmClientes,
      m3_prodTotal,
      m3_commServicos,
      m3_commCosmeticos,
      m3_commTotal,
      m3_diffClients,
      m3_diffPct,
      // Daily
      dailyClients,
      dailyExtras,
      dailyCosmetics,
      effectiveDays,
    };
  }, [entries, currentUser, monthStr, catalog, monthlyBarberStats, targetCommission, diasBase, rateServicosCommission, rateCosmeticosCommission]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* TOP CONTROLS & NAVIGATOR BAR */}
      <div className="app-themed-panel flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-wider">
                Autogestão & Performance Estratégica
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                PROJEÇÃO INTELIGENTE
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Planejamento e metas do profissional • {months[parseInt(selectedMonth) - 1]} de {selectedYear}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-white transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 min-w-[110px] text-center capitalize">
              {months[parseInt(selectedMonth) - 1]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-950 dark:hover:text-white transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Target Config Toggle */}
          <button
            onClick={() => setShowGoalConfig(!showGoalConfig)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-zinc-200 rounded-xl transition-all shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>Ajustar Meta</span>
          </button>
        </div>
      </div>

      {/* EXPANDABLE GOAL SETTINGS DRAWER */}
      {showGoalConfig && (
        <div className="bg-zinc-900/95 border border-amber-500/30 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                Configurar Objetivo de Comissão e Dias Trabalhados
              </h4>
              <p className="text-xs text-zinc-400">
                Selecione ou digite sua meta mensal de comissão para recalcular os 3 caminhos de crescimento.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[8000, 10000, 12000, 15000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTargetCommission(preset)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    targetCommission === preset
                      ? "bg-amber-500 text-black border-amber-400 shadow-md font-black"
                      : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  {preset / 1000}K
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Meta Mensal (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">
                  R$
                </span>
                <input
                  type="number"
                  step="500"
                  min="1000"
                  value={targetCommission}
                  onChange={(e) => setTargetCommission(Math.max(1000, parseInt(e.target.value) || 0))}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Dias no Mês
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="31"
                  value={diasBase}
                  onChange={(e) => setDiasBase(Math.max(1, parseInt(e.target.value) || 22))}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                % Com. Serviços
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={Math.round(rateServicosCommission * 100)}
                  onChange={(e) => setRateServicosCommission(Math.max(0.01, Math.min(1, parseInt(e.target.value) / 100 || 0)))}
                  className="w-full pl-4 pr-8 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold focus:border-amber-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                % Com. Cosméticos
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={Math.round(rateCosmeticosCommission * 100)}
                  onChange={(e) => setRateCosmeticosCommission(Math.max(0.01, Math.min(1, parseInt(e.target.value) / 100 || 0)))}
                  className="w-full pl-4 pr-8 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold focus:border-amber-500 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN BANNER TITLE */}
      <div className="text-center space-y-3 py-2 flex flex-col items-center">
        <div 
          className="flex items-center gap-3 justify-center group cursor-text"
          title="Clique no valor para editar sua meta mensal"
        >
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight uppercase flex items-center gap-2">
            PLANO 
            <div className="relative inline-flex items-center">
              <span className="text-white/40 font-black text-3xl sm:text-4xl mr-1">R$</span>
              <input
                type="number"
                value={targetCommission}
                onChange={(e) => setTargetCommission(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-40 sm:w-56 bg-transparent border-b-4 border-amber-500/30 group-hover:border-amber-500 text-4xl sm:text-5xl font-black text-white outline-none text-center hover:bg-white/5 focus:bg-white/10 transition-all rounded-t-xl"
              />
              <button 
                onClick={() => setShowGoalConfig(true)}
                className="absolute -right-12 p-2 bg-zinc-800/50 rounded-full text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Configurações avançadas (Dias úteis e % de comissão)"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          </h1>
        </div>
        <p className="text-sm sm:text-base font-semibold text-zinc-400">
          Objetivo ajustável: {targetCommission.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de comissão por mês
        </p>
      </div>

      {/* TOP SECTION: 3 PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* PANEL 1: ONDE ESTAMOS HOJE */}
        <div className="lg:col-span-4 bg-[#0a0d14] border border-zinc-800/90 rounded-3xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-5">
            <div className="text-center pb-3 border-b border-zinc-800/80">
              <h3 className="text-sm font-black text-white tracking-widest uppercase">
                ONDE ESTAMOS HOJE
              </h3>
              <span className="text-[11px] font-semibold text-zinc-400">
                Performance atual
              </span>
            </div>

            {/* Metrics List */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>CLIENTES</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.currentClients}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Scissors className="w-4 h-4 text-zinc-400" />
                  <span>TICKET CORTE + BARBA</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.currentTicketCorteBarba.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>SERVIÇOS EXTRAS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-white text-sm">
                    {stats.currentExtrasQtd}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    ({stats.currentExtrasTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} por cliente)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>COSMÉTICOS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-xs">
                    {stats.currentCosmeticsClients} clientes
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    ({stats.currentCosmeticsValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} vendidos)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Breakdown Grid */}
          <div className="mt-6 pt-4 border-t border-zinc-800/80 grid grid-cols-2 gap-4 text-2xs">
            <div className="space-y-1">
              <span className="font-black text-zinc-400 uppercase tracking-wider block">
                PRODUÇÃO TOTAL
              </span>
              <p className="text-zinc-500 text-[10px] leading-tight">
                • Serviços (corte + barba + extras)
              </p>
              <p className="text-zinc-400 text-[10px]">
                • Cosméticos: <span className="font-mono font-bold text-zinc-300">{stats.currentCosmeticsValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
              </p>
            </div>

            <div className="space-y-1 text-right">
              <span className="font-black text-zinc-400 uppercase tracking-wider block">
                COMISSÃO TOTAL
              </span>
              <span className="font-mono font-black text-white text-xs block">
                {stats.comissaoTotalAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              <p className="text-zinc-500 text-[10px]">
                • Serviços (39%): {stats.comissaoServicosAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-zinc-500 text-[10px]">
                • Cosméticos (15%): {stats.comissaoCosmeticosAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
        </div>

        {/* PANEL 2: PARA CHEGAR AOS 10K (HIGHLIGHT CENTER) */}
        <div className="lg:col-span-4 bg-gradient-to-b from-[#111724] to-[#0d121c] border-2 border-emerald-500/30 rounded-3xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden text-center">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-black text-white tracking-widest uppercase">
                PARA CHEGAR AOS {targetCommission >= 1000 ? `${targetCommission / 1000}K` : targetCommission}
              </h3>
              <span className="text-[11px] font-semibold text-zinc-400">
                Precisamos de:
              </span>
            </div>

            {/* Big Green Target */}
            <div className="py-2">
              <span className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight font-mono block drop-shadow-md">
                {targetCommission.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                de comissão
              </span>
            </div>

            {/* Needed Production */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-400 block">
                Você precisa produzir:
              </span>
              <span className="text-3xl font-black text-white font-mono block">
                {stats.producaoNecessariaMeta.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-zinc-500 font-semibold block">
                (comissão de 39% em serviços)
              </span>
            </div>
          </div>

          {/* Falta Produzir & Falta em Comissão Pills */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-zinc-800">
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-2.5 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>FALTA PRODUZIR</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                {stats.faltaProduzir.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-2.5 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Coins className="w-3.5 h-3.5" />
                <span>FALTA EM COMISSÃO</span>
              </div>
              <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                {stats.faltaComissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
        </div>

        {/* PANEL 3: REFERÊNCIAS ATUAIS */}
        <div className="lg:col-span-4 bg-[#0a0d14] border border-zinc-800/90 rounded-3xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-5">
            <div className="text-center pb-3 border-b border-zinc-800/80">
              <h3 className="text-sm font-black text-white tracking-widest uppercase">
                REFERÊNCIAS ATUAIS
              </h3>
              <span className="text-[11px] font-semibold text-zinc-400">
                Médias por cliente
              </span>
            </div>

            {/* Reference List */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Scissors className="w-4 h-4 text-zinc-400" />
                  <span>Ticket corte + barba</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.currentTicketCorteBarba.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Ticket médio de extras</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.currentExtrasTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Ticket médio cosméticos</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.currentCosmeticsTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Percent className="w-4 h-4 text-zinc-400" />
                  <span>% clientes com extras</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.pctClientsWithExtras}%
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-zinc-300 font-bold">
                  <Percent className="w-4 h-4 text-zinc-400" />
                  <span>% clientes com cosméticos</span>
                </div>
                <span className="font-mono font-black text-white text-sm">
                  {stats.pctClientsWithCosmetics}%
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Highlight */}
          <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
            <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider block mb-1">
              COMISSÃO ATUAL
            </span>
            <span className="text-2xl font-black text-white font-mono">
              {stats.comissaoTotalAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: 3 CAMINHOS PARA ALCANÇAR R$ 10.000 */}
      <div className="space-y-6 pt-4">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
            3 CAMINHOS PARA ALCANÇAR {targetCommission.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} DE COMISSÃO
          </h2>
        </div>

        {/* 3 Model Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* MODELO 1: MAIS CLIENTES (BLUE) */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-800 text-zinc-900 rounded-3xl p-6 shadow-2xl flex flex-col justify-between border border-blue-200">
            <div className="space-y-5">
              {/* Header Badge & Title */}
              <div className="flex flex-col items-center text-center space-y-1.5 pb-2">
                <span className="px-3.5 py-1 rounded-full bg-[#1E3A8A] text-white text-xs font-black uppercase tracking-wider">
                  MODELO 1
                </span>
                <h3 className="text-lg font-black text-[#1E3A8A] uppercase">
                  MAIS CLIENTES
                </h3>
                <p className="text-xs text-zinc-600 font-medium">
                  Manter performance atual e aumentar volume
                </p>
              </div>

              {/* 3 Metric White Boxes */}
              <div className="grid grid-cols-3 gap-2">
                {/* Metric 1 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Users className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m1_clientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-blue-700 leading-tight">
                    +{stats.m1_diffClients} clientes<br />
                    ({stats.m1_diffPct}% a mais)
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Sparkles className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m1_extras}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      extras
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    {stats.pctClientsWithExtras}% dos clientes com extras
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <ShoppingBag className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m1_cosmClientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    {stats.pctClientsWithCosmetics}% dos clientes com cosméticos
                  </div>
                </div>
              </div>

              {/* 2x2 Mini Financial Table */}
              <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    PRODUÇÃO TOTAL
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m1_prodTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-right">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO SERVIÇOS (39%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m1_commServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO COSMÉTICOS (15%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m1_commCosmeticos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-[#1E3A8A] text-white p-2 rounded-xl text-right shadow-sm">
                  <span className="text-[9px] text-blue-200 font-bold uppercase block">
                    COMISSÃO TOTAL ESTIMADA
                  </span>
                  <span className="font-mono font-black text-sm">
                    {stats.m1_commTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Banner */}
            <div className="mt-5 bg-[#0F172A] text-white py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold text-center">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>FOCO: ATRAIR MAIS CLIENTES E MANTER A CONSISTÊNCIA</span>
            </div>
          </div>

          {/* MODELO 2: MAIS VENDA POR CLIENTE (GREEN) */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-800 text-zinc-900 rounded-3xl p-6 shadow-2xl flex flex-col justify-between border border-emerald-200">
            <div className="space-y-5">
              {/* Header Badge & Title */}
              <div className="flex flex-col items-center text-center space-y-1.5 pb-2">
                <span className="px-3.5 py-1 rounded-full bg-[#065F46] text-white text-xs font-black uppercase tracking-wider">
                  MODELO 2
                </span>
                <h3 className="text-lg font-black text-[#065F46] uppercase">
                  MAIS VENDA POR CLIENTE
                </h3>
                <p className="text-xs text-zinc-600 font-medium">
                  Menos dependência de volume, mais eficiência
                </p>
              </div>

              {/* 3 Metric White Boxes */}
              <div className="grid grid-cols-3 gap-2">
                {/* Metric 1 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Users className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m2_clientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-emerald-700 leading-tight">
                    +{stats.m2_diffClients} clientes<br />
                    ({stats.m2_diffPct}% a mais)
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Sparkles className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m2_extras}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      extras
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    56% dos clientes com extras
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <ShoppingBag className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m2_cosmClientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    14% dos clientes com cosméticos
                  </div>
                </div>
              </div>

              {/* 2x2 Mini Financial Table */}
              <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    PRODUÇÃO TOTAL
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m2_prodTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-right">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO SERVIÇOS (39%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m2_commServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO COSMÉTICOS (15%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m2_commCosmeticos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-[#065F46] text-white p-2 rounded-xl text-right shadow-sm">
                  <span className="text-[9px] text-emerald-200 font-bold uppercase block">
                    COMISSÃO TOTAL ESTIMADA
                  </span>
                  <span className="font-mono font-black text-sm">
                    {stats.m2_commTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Banner */}
            <div className="mt-5 bg-[#022C22] text-white py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold text-center">
              <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>FOCO: AUMENTAR CONVERSÃO DE EXTRAS E COSMÉTICOS</span>
            </div>
          </div>

          {/* MODELO 3: EQUILIBRADO (ORANGE/BROWN) */}
          <div className="bg-[#FAF9F5] dark:bg-zinc-800 text-zinc-900 rounded-3xl p-6 shadow-2xl flex flex-col justify-between border-2 border-[#C2410C]">
            <div className="space-y-5">
              {/* Header Badge & Title */}
              <div className="flex flex-col items-center text-center space-y-1.5 pb-2">
                <span className="px-3.5 py-1 rounded-full bg-[#C2410C] text-white text-xs font-black uppercase tracking-wider shadow-sm">
                  MODELO 3
                </span>
                <h3 className="text-lg font-black text-[#C2410C] uppercase">
                  EQUILIBRADO (RECOMENDADO)
                </h3>
                <p className="text-xs text-zinc-600 font-medium">
                  Crescimento equilibrado entre volume e vendas
                </p>
              </div>

              {/* 3 Metric White Boxes */}
              <div className="grid grid-cols-3 gap-2">
                {/* Metric 1 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Users className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m3_clientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-amber-800 leading-tight">
                    +{stats.m3_diffClients} clientes<br />
                    ({stats.m3_diffPct}% a mais)
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <Sparkles className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m3_extras}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      extras
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    48% dos clientes com extras
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 text-center shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
                  <ShoppingBag className="w-5 h-5 mx-auto text-zinc-800 dark:text-zinc-200 mb-1" />
                  <div>
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 block font-mono">
                      {stats.m3_cosmClientes}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                      clientes
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-bold text-zinc-600 leading-tight">
                    14% dos clientes com cosméticos
                  </div>
                </div>
              </div>

              {/* 2x2 Mini Financial Table */}
              <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    PRODUÇÃO TOTAL
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m3_prodTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-right">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO SERVIÇOS (39%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m3_commServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                    COMISSÃO COSMÉTICOS (15%)
                  </span>
                  <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 text-xs">
                    {stats.m3_commCosmeticos.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-[#C2410C] text-white p-2 rounded-xl text-right shadow-sm">
                  <span className="text-[9px] text-orange-200 font-bold uppercase block">
                    COMISSÃO TOTAL ESTIMADA
                  </span>
                  <span className="font-mono font-black text-sm">
                    {stats.m3_commTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Footer Banner */}
            <div className="mt-5 bg-[#431407] text-white py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold text-center">
              <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>FOCO: EQUILÍBRIO ENTRE FLUXO, VENDA E RELACIONAMENTO</span>
            </div>
          </div>

        </div>
      </div>

      {/* BOTTOM SECTION: METAS DIÁRIAS (MODELO EQUILIBRADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Daily Targets Card */}
        <div className="lg:col-span-8 bg-[#0a0d14] border border-zinc-800/90 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-white tracking-wider uppercase">
              METAS DIÁRIAS (MODELO EQUILIBRADO)
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Base: {stats.effectiveDays} dias trabalhados
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Daily Metric 1 */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300">
                <Users className="w-5 h-5 text-zinc-200" />
              </div>
              <div>
                <span className="text-2xl font-black text-white font-mono block leading-none">
                  {stats.dailyClients}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  clientes/dia
                </span>
              </div>
            </div>

            {/* Daily Metric 2 */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-black text-white font-mono block leading-none">
                  {stats.dailyExtras}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  extras/dia
                </span>
              </div>
            </div>

            {/* Daily Metric 3 */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-emerald-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xl font-black text-white font-mono block leading-none">
                  {stats.dailyCosmetics}
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">
                  clientes de cosméticos/dia
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Right Banner */}
        <div className="lg:col-span-4 bg-gradient-to-r from-amber-950/30 to-zinc-900/60 border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex items-center justify-center gap-3 text-center">
          <Star className="w-7 h-7 text-amber-400 fill-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black text-amber-200 uppercase tracking-wider leading-snug">
            PEQUENAS AÇÕES DIÁRIAS GERAM GRANDES RESULTADOS!
          </span>
        </div>

      </div>
    </div>
  );
}

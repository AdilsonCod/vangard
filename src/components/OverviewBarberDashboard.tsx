import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Target, TrendingUp, Calendar, ChevronLeft, ChevronRight, Award, CircleDollarSign, Megaphone, Percent, ShoppingBag, Sparkles, Smile } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, YAxis, Cell } from 'recharts';
import { appControlClass, cn } from './ui/AppPrimitives';

export function OverviewBarberDashboard() {
  const { currentUser, entries, catalog, monthlyBarberStats, announcements, targets } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  
  const monthStr = `${selectedYear}-${selectedMonth}`;

  // Filter announcements for this user
  const relevantAnnouncements = useMemo(() => {
    return (announcements || [])
      .filter(a => a.unitId === 'ALL' || (currentUser?.unit && a.unitId === currentUser.unit))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [announcements, currentUser]);

  const currentStats = useMemo(() => {
    const userEntries = entries.filter((e) => e.userId === currentUser?.id && e.date.startsWith(monthStr));
    
    let faturamentoAvulso = 0;
    let faturamentoAssinatura = 0;
    let vendaProdutosValor = 0;
    let vendasProdutosQtd = 0;
    let clientesAtendidos = 0;
    let uniqueClientesAtendidos = 0;
    let workedDaysCount = 0;
    let entriesWithProducts = 0;
    let entriesWithExtras = 0;
    const extraCounts: Record<string, number> = {};

    userEntries.forEach((e) => {
      if (!e.isDayOff) {
        workedDaysCount++;
        clientesAtendidos += e.clientsServed || 0;
        uniqueClientesAtendidos += e.uniqueClientsServed || e.clientsServed || 0;

        let hasProduct = false;
        let hasExtra = false;

        Object.keys(e.items || {}).forEach((k) => {
          const catItem = catalog.find((c) => c.id === k);
          const itemVal = e.items[k];
          if (itemVal && catItem) {
             const comm = itemVal.commission || 0;
             const amt = itemVal.amount || 0;
             
             if (catItem.name.toLowerCase().includes('assinatura')) {
                faturamentoAssinatura += comm;
             } else {
                faturamentoAvulso += comm;
             }

             if (catItem.type === 'PRODUCT') {
                vendaProdutosValor += comm;
                vendasProdutosQtd += amt;
                if (amt > 0) hasProduct = true;
             }
             if (catItem.type === 'EXTRA_SERVICE') {
                extraCounts[catItem.id] = (extraCounts[catItem.id] || 0) + amt;
                if (amt > 0) hasExtra = true;
             }
          }
        });

        if (hasProduct) entriesWithProducts++;
        if (hasExtra) entriesWithExtras++;
      }
    });

    const histStat = monthlyBarberStats?.find(s => s.month === monthStr && s.barberId === currentUser?.id);
    if (histStat) {
       const histAssinatura = histStat.faturamentoAssinatura || 0;
       const histAvulso = histStat.faturamentoAvulso !== undefined
         ? histStat.faturamentoAvulso
         : Math.max(0, (histStat.faturamentoTotal || 0) - histAssinatura);

       faturamentoAssinatura += histAssinatura;
       faturamentoAvulso += histAvulso;
       vendaProdutosValor += histStat.vendaProdutosValor || 0;
       vendasProdutosQtd += histStat.vendasProdutosQtd || 0;
       clientesAtendidos += histStat.clientesAtendidos || 0;
       uniqueClientesAtendidos += histStat.clientesAtendidos || 0;
       if (histStat.extraCounts) {
           Object.entries(histStat.extraCounts).forEach(([id, q]) => {
               extraCounts[id] = (extraCounts[id] || 0) + (q || 0);
           });
       }
    }

    const faturamentoTotal = faturamentoAvulso + faturamentoAssinatura;
    const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0;
    const penetrationProdutos = workedDaysCount > 0 ? (entriesWithProducts / workedDaysCount) * 100 : 0;
    const penetrationExtras = workedDaysCount > 0 ? (entriesWithExtras / workedDaysCount) * 100 : 0;

    return {
      faturamentoTotal,
      faturamentoAvulso,
      faturamentoAssinatura,
      vendaProdutosValor,
      vendasProdutosQtd,
      clientesAtendidos,
      uniqueClientesAtendidos,
      extraCounts,
      ticketMedio,
      penetrationProdutos,
      penetrationExtras,
      workedDaysCount
    };

  }, [entries, currentUser, monthStr, catalog, monthlyBarberStats]);

  const COLORS = ["var(--theme-500)", "var(--theme-400)", "var(--theme-600)", "var(--theme-300)", "var(--theme-700)", "var(--theme-200)"];

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
     let m = parseInt(selectedMonth) - 1;
     let y = selectedYear;
     if (m < 1) {
        m = 12;
        y--;
     }
     setSelectedMonth(String(m).padStart(2, '0'));
     setSelectedYear(y);
  };

  const handleNextMonth = () => {
     let m = parseInt(selectedMonth) + 1;
     let y = selectedYear;
     if (m > 12) {
        m = 1;
        y++;
     }
     setSelectedMonth(String(m).padStart(2, '0'));
     setSelectedYear(y);
  };

  const totalsData = [
    { name: 'Fat. Total', value: currentStats?.faturamentoTotal || 0 },
    { name: 'Avulso', value: currentStats?.faturamentoAvulso || 0 },
    { name: 'Assinaturas', value: currentStats?.faturamentoAssinatura || 0 },
    { name: 'Produtos', value: currentStats?.vendaProdutosValor || 0 },
  ];

  const extrasCatalog = catalog.filter(c => c.type === 'EXTRA_SERVICE');
  
  const extraServicesData = useMemo(() => {
    if (!currentStats?.extraCounts) return [];
    return Object.entries(currentStats.extraCounts).map(([id, quantity]) => {
      const item = extrasCatalog.find(c => c.id === id);
      return { 
        name: item?.name || 'Desc.', 
        quantity 
      };
    }).sort((a, b) => b.quantity - a.quantity).slice(0, 5); // top 5
  }, [currentStats, extrasCatalog]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--theme-color)]">Painel profissional</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">Meu desempenho</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">Acompanhe resultados, objetivos e oportunidades do seu período.</p>
        </div>
        <div className={cn(appControlClass, "flex items-center overflow-hidden p-0")}>
          <button onClick={handlePrevMonth} aria-label="Mês anterior" className="px-3 py-2.5 transition hover:bg-gray-200 dark:hover:bg-zinc-700">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[150px] px-3 py-2 text-center text-sm font-black">
            {MONTH_NAMES[parseInt(selectedMonth) - 1]} {selectedYear}
          </div>
          <button onClick={handleNextMonth} aria-label="Próximo mês" className="px-3 py-2.5 transition hover:bg-gray-200 dark:hover:bg-zinc-700">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 📢 QUADRO DE AVISOS DO MURAL DO ADMINISTRADOR */}
      {relevantAnnouncements.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800/30 p-5 rounded-2xl relative overflow-hidden shadow-xs">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
            <Megaphone className="w-48 h-48 -rotate-12 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 text-amber-850 dark:text-amber-400 font-bold mb-3 border-b border-amber-100 dark:border-amber-850/30 pb-2">
            <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-550 animate-bounce" />
            <span className="text-xs uppercase tracking-wider font-extrabold text-amber-800 dark:text-amber-400">Canal de Comunicados & Mural de Avisos da Barbearia</span>
          </div>
          <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
            {relevantAnnouncements.map((announcement) => {
              const badgeColors = {
                IMPORTANT: 'bg-orange-100 text-orange-950 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900/50',
                ALERT: 'bg-red-100 text-red-950 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
                INFO: 'bg-blue-105 text-blue-950 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
                CELEBRATION: 'bg-emerald-100 text-emerald-950 border-emerald-250 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50'
              };
              const emoji = {
                IMPORTANT: '⚠️',
                ALERT: '🚨',
                CELEBRATION: '🎉',
                INFO: '💡'
              };
              return (
                <div key={announcement.id} className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/60 rounded-xl hover:border-gray-300 dark:hover:border-zinc-700 transition">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${badgeColors[announcement.type as keyof typeof badgeColors] || badgeColors.INFO}`}>
                      {emoji[announcement.type as keyof typeof emoji] || '💡'} {announcement.type === 'IMPORTANT' ? 'Importante' : announcement.type === 'ALERT' ? 'Urgente' : announcement.type === 'CELEBRATION' ? 'Celebração' : 'Aviso'}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      {new Date(announcement.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-gray-800 dark:text-zinc-150 mb-1">{announcement.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="app-themed-panel min-h-[120px] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
           <span className="block text-2xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Fat. Total (Avulso + Assin.)</span>
           <span className="text-2xl font-black text-gray-800 dark:text-zinc-100 font-mono">
             {(currentStats?.faturamentoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
           </span>
        </div>
        <div className="app-themed-panel min-h-[120px] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
           <span className="block text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Fat. Avulso</span>
           <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
             {(currentStats?.faturamentoAvulso || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
           </span>
        </div>
        <div className="app-themed-panel min-h-[120px] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
           <span className="block text-2xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Fat. Assinaturas</span>
           <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
             {(currentStats?.faturamentoAssinatura || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
           </span>
        </div>
        <div className="app-themed-panel min-h-[120px] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
           <span className="block text-2xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Clientes Atendidos</span>
           <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
             {currentStats?.clientesAtendidos || 0} un
           </span>
        </div>
        <div className="app-themed-panel min-h-[120px] bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
           <span className="block text-2xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Produtos (Qtd)</span>
           <span className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono">
             {currentStats?.vendasProdutosQtd || 0} un
           </span>
        </div>
      </div>

      {/* SEÇÃO DE AUTOGESTÃO: INDICADORES INTELECTUAIS E DE DESEMPENHO */}
      <div className="app-themed-panel bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm animate-in fade-in duration-300">
         <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-zinc-400">📊 Suas Métricas de Autogestão (Foco em Alta Performance)</span>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ticket Médio */}
            <div className="bg-zinc-50 dark:bg-zinc-805/40 border border-gray-150 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Ticket Médio por Cliente</span>
                <span className="text-2xl font-black text-gray-900 dark:text-zinc-50 font-mono">
                  {currentStats.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-3 leading-relaxed">
                Faturamento médio trazido por atendimento. Aumente oferecendo combos e combos com produtos finalizadores!
              </p>
            </div>

            {/* Penetração de Produtos */}
            <div className="bg-zinc-50 dark:bg-zinc-805/40 border border-gray-150 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Conversão de Vendas (Produtos)</span>
                  <span className="text-xs font-bold text-emerald-605 font-mono">{currentStats.penetrationProdutos.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-250 dark:bg-zinc-850 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, currentStats.penetrationProdutos)}%` }}></div>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-2 leading-relaxed">
                Porcentagem de dias ativos com comercialização de itens do catálogo de produtos. Almeje sempre superar 35%!
              </p>
            </div>

            {/* Penetração de Extras */}
            <div className="bg-zinc-50 dark:bg-zinc-805/40 border border-gray-150 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Aproveitamento de Serviços Extras</span>
                  <span className="text-xs font-bold text-orange-605 font-mono">{currentStats.penetrationExtras.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-250 dark:bg-zinc-850 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, currentStats.penetrationExtras)}%` }}></div>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-2 leading-relaxed">
                Porcentagem de expedientes com serviços complementares adicionados (ex: sobrancelhas, barboterapia, pigmentações).
              </p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="app-themed-panel bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col min-h-[320px]">
           <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
             <CircleDollarSign className="w-5 h-5 text-green-500" />
             Raio-x do Faturamento
           </h3>
           {currentStats && currentStats.faturamentoTotal > 0 ? (
             <div className="flex-1 max-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={totalsData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `R$ ${v}`} tick={{fontSize: 11, fill: '#888'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                       {totalsData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           ) : <div className="text-center py-6 text-gray-400 dark:text-zinc-500 text-sm flex-1 flex items-center justify-center">Sem faturamento no período</div>}
         </div>

         <div className="app-themed-panel bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col min-h-[320px]">
           <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
             <Award className="w-5 h-5 text-amber-500" />
             Top Serviços Extras
           </h3>
           {extraServicesData.length > 0 ? (
             <div className="flex-1 max-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={extraServicesData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} formatter={(v: number) => [v + ' unid.', 'Qtd']} />
                    <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={32} isAnimationActive={false}>
                       {extraServicesData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                       ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           ) : <div className="text-center py-6 text-gray-400 dark:text-zinc-500 text-sm flex-1 flex items-center justify-center">Nenhum serviço extra registrado</div>}
         </div>
      </div>
      
    </div>
  );
}

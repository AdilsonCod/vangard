import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, FileSearch, HelpCircle } from 'lucide-react';
import { calculateTotalRevenue, inferStandaloneRevenue } from '../services/financialEngine';

export function BarberReportsView() {
  const { currentUser, monthlyBarberStats, catalog } = useStore();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  const monthStr = `${selectedYear}-${selectedMonth}`;

  const currentStats = useMemo(() => {
    return monthlyBarberStats.find(s => s.barberId === currentUser?.id && s.month === monthStr);
  }, [monthlyBarberStats, currentUser, monthStr]);

  const ticketMedio = useMemo(() => {
    if (!currentStats || !currentStats.clientesAtendidos) return 0;
    return currentStats.clientesAtendidos > 0
      ? currentStats.faturamentoTotal / currentStats.clientesAtendidos
      : 0;
  }, [currentStats]);

  const geracaoDemanda = useMemo(() => {
    if (!currentStats) return 0;
    return (currentStats.clientesNovos || 0) + (currentStats.clientesSemPreferencia || 0);
  }, [currentStats]);

  const extraServices = useMemo(() => {
    return (catalog || []).filter(c => c.type === 'EXTRA_SERVICE');
  }, [catalog]);

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

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="app-themed-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div>
           <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
             <FileSearch className="w-6 h-6 text-indigo-500" />
             Meus Relatórios (Admin)
           </h2>
           <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
             Análise de desempenho preenchida e disponibilizada pela gestão.
           </p>
        </div>
        
        <div className="flex items-center bg-gray-50 dark:bg-zinc-800 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700">
           <button onClick={handlePrevMonth} className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition">
             <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
           </button>
           <div className="px-4 py-2 font-bold text-gray-800 dark:text-zinc-100 min-w-[140px] text-center select-none">
             {MONTH_NAMES[parseInt(selectedMonth) - 1]} / {selectedYear}
           </div>
           <button onClick={handleNextMonth} className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition">
             <ChevronRight className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
           </button>
        </div>
      </div>

      {!currentStats ? (
        <div className="app-themed-panel bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 sm:p-12 flex flex-col items-center justify-center text-center shadow-sm">
           <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-gray-400 dark:text-zinc-500">
             <HelpCircle className="w-8 h-8" />
           </div>
           <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2">Sem dados para este período</h3>
           <p className="text-gray-500 dark:text-zinc-400 max-w-sm">
             A administração ainda não lançou a sua análise de desempenho para {MONTH_NAMES[parseInt(selectedMonth) - 1]} de {selectedYear}.
           </p>
        </div>
      ) : (
        <div className="app-themed-panel bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          {(() => {
            const fatAssinatura = currentStats.faturamentoAssinatura || 0;
            const fatAvulso = currentStats.faturamentoAvulso !== undefined
              ? currentStats.faturamentoAvulso
              : inferStandaloneRevenue(currentStats.faturamentoTotal, fatAssinatura, currentStats.vendaProdutosValor);
            const fatTotal = calculateTotalRevenue(fatAvulso, fatAssinatura, currentStats.vendaProdutosValor);

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Fat. Total (Avulso + Assin.)</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {formatCurrency(fatTotal)}
                   </span>
                </div>
                
                <div className="p-5 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                   <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Fat. Avulso</span>
                   <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                     {formatCurrency(fatAvulso)}
                   </span>
                </div>

                <div className="p-5 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/20">
                   <span className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Fat. Assinaturas</span>
                   <span className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">
                     {formatCurrency(fatAssinatura)}
                   </span>
                </div>

                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20">
                   <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Participação nas assinaturas</span>
                   <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
                     {currentStats.percentualAssinatura || 0}%
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Serviços de assinatura</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.servicosAssinatura || 0}
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Fichas de assinatura</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.fichasAssinatura || 0}
                   </span>
                </div>

                <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                   <span className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Comissão</span>
                   <span className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                     {formatCurrency(currentStats.comissao || 0)}
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Clientes Atendidos</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.clientesAtendidos || 0}
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Serviços Realizados</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.servicosRealizados || 0}
                   </span>
                </div>

                <div className="p-5 bg-orange-50/50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/20">
                   <span className="block text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">Venda Produtos (R$)</span>
                   <span className="text-2xl font-black text-orange-700 dark:text-orange-300 font-mono">
                     {formatCurrency(currentStats.vendaProdutosValor || 0)}
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Venda Produtos (Qtd)</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.vendasProdutosQtd || 0}
                   </span>
                </div>

                <div className="p-5 bg-green-50/50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                   <span className="block text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">Taxa de Retorno</span>
                   <span className="text-2xl font-black text-green-700 dark:text-green-300 font-mono">
                     {(currentStats.taxaRetorno || 0)}%
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Clientes Novos</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.clientesNovos || 0}
                   </span>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800">
                   <span className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Clientes Sem Preferência</span>
                   <span className="text-2xl font-black text-gray-900 dark:text-zinc-100 font-mono">
                     {currentStats.clientesSemPreferencia || 0}
                   </span>
                </div>

                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20">
                   <span className="block text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-2">Ticket Médio</span>
                   <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
                     {formatCurrency(ticketMedio)}
                   </span>
                </div>

                <div className="p-5 bg-teal-50/50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/20">
                   <span className="block text-xs font-bold text-teal-650 dark:text-teal-400 uppercase tracking-wider mb-2">Geração de Demanda</span>
                   <span className="text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">
                     {geracaoDemanda}
                   </span>
                </div>
              </div>
            );
          })()}

          {extraServices.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-150 dark:border-zinc-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-4 flex items-center gap-2">
                Serviços Extras
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {extraServices.map(ex => {
                   const qtd = (currentStats.extraCounts || {})[ex.id] || 0;
                   const val = (currentStats.extraValues || {})[ex.id] || 0;
                   return (
                     <div key={ex.id} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-xl shadow-sm">
                       <div className="text-xs font-extrabold text-amber-800 dark:text-amber-500 uppercase mb-2 truncate" title={ex.name}>
                         {ex.name}
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                         <div>
                           <span className="block text-4xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5 font-sans">Qtd</span>
                           <span className="text-base font-black text-gray-900 dark:text-zinc-100 font-mono">{qtd}</span>
                         </div>
                         <div>
                           <span className="block text-4xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5 font-sans">Valor</span>
                           <span className="text-base font-black text-amber-700 dark:text-amber-400 font-mono">{formatCurrency(val)}</span>
                         </div>
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

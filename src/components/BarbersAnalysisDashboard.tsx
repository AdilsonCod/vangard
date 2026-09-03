import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, Users, TrendingUp, ChevronDown, ChevronUp, Calendar, User as UserIcon, Sparkles, Trash2 } from 'lucide-react';
import { MonthlyBarberStats, User } from '../types';
import { ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CardInput = ({ 
  label, value, onChange, prefix, suffix, isReadOnly = false
}: { 
  label: string; value: number; onChange?: (val: number) => void; prefix?: string; suffix?: string; isReadOnly?: boolean;
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
      <span className="text-2xs font-extrabold text-gray-400 dark:text-zinc-500 select-none uppercase tracking-wider tooltip" title={label}>{label.length > 20 ? label.substring(0, 18) + '...' : label}</span>
      <div className="flex items-center gap-1.5 mt-0.5">
        {prefix && <span className="text-xs font-bold text-gray-400 dark:text-zinc-555 select-none">{prefix}</span>}
        <input
          type="number"
          readOnly={isReadOnly}
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleBlur();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`w-full bg-transparent text-sm font-bold text-gray-800 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isReadOnly ? 'cursor-not-allowed text-gray-400 dark:text-zinc-500' : ''}`}
          placeholder="0"
        />
        {suffix && <span className="text-xs font-bold text-gray-400 dark:text-zinc-555 select-none">{suffix}</span>}
      </div>
    </div>
  );
};

export function BarbersAnalysisDashboard() {
  const { systemUnits, catalog, monthlyBarberStats, updateMonthlyBarberStats, deleteMonthlyBarberStats, users } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(new Date().getMonth());
  const [isSimulating, setIsSimulating] = useState(false);
  const [isShowingSimulateMenu, setIsShowingSimulateMenu] = useState(false);

  const extraServices = useMemo(() => {
    return catalog.filter(c => c.type === 'EXTRA_SERVICE' && c.id !== 'ex_manicure' && c.id !== 'ex_pedicure');
  }, [catalog]);

  const handleSimulateStats = async (allMonths: boolean) => {
    if (unitBarbers.length === 0) return;
    setIsSimulating(true);
    setIsShowingSimulateMenu(false);
    
    try {
      const monthsToFill = allMonths
        ? MONTH_NAMES.map((_, idx) => String(idx + 1).padStart(2, '0'))
        : [String(selectedMonthIdx + 1).padStart(2, '0')];

      // Sort months chronologically to ensure sequential MoM growth logic runs in order
      monthsToFill.sort((a, b) => a.localeCompare(b));

      // Keep an in-memory session record so we can immediately read prior month's data we just generated
      const simulatedInSession: Record<string, MonthlyBarberStats> = {};

      const getPrevMonthStr = (monthStr: string): string => {
        const [year, month] = monthStr.split('-').map(Number);
        if (month === 1) {
          return `${year - 1}-12`;
        }
        return `${year}-${String(month - 1).padStart(2, '0')}`;
      };

      const promises: Promise<void>[] = [];

      for (const mNum of monthsToFill) {
        const monthStr = `${selectedYear}-${mNum}`;
        for (const barber of unitBarbers) {
          const statsId = `${monthStr}_${barber.id}`;
          
          // Try to find the most recent previous stats for MoM growth-oriented simulation
          let prevStats: MonthlyBarberStats | null = null;
          let checkMonth = monthStr;
          // Look back up to 12 months for any existing baseline
          for (let i = 0; i < 12; i++) {
            checkMonth = getPrevMonthStr(checkMonth);
            const prevId = `${checkMonth}_${barber.id}`;
            if (simulatedInSession[prevId]) {
              prevStats = simulatedInSession[prevId];
              break;
            }
            const foundDb = monthlyBarberStats?.find(s => s.id === prevId);
            if (foundDb) {
              prevStats = foundDb;
              break;
            }
          }

          let faturamentoTotal: number;
          let faturamentoAvulso: number;
          let clientesAtendidos: number;
          let servicosRealizados: number;
          let comissao: number;
          let faturamentoAssinatura: number;
          let vendaProdutosValor: number;
          let vendasProdutosQtd: number;
          let taxaRetorno: number;
          let clientesNovos: number;
          let clientesSemPreferencia: number;
          const extras: Record<string, number> = {};
          const extraVals: Record<string, number> = {};

          if (prevStats) {
            // Apply healthy growth rate (MoM growth mindset)
            const growth = 0.02 + Math.random() * 0.05; // 2% to 7% monthly growth factor
            
            const prevAssinatura = prevStats.faturamentoAssinatura || 0;
            const prevAvulso = prevStats.faturamentoAvulso !== undefined
              ? prevStats.faturamentoAvulso
              : Math.max(0, (prevStats.faturamentoTotal || 0) - prevAssinatura);

            faturamentoAvulso = Math.floor(prevAvulso * (1 + growth) * (0.97 + Math.random() * 0.06));
            faturamentoAssinatura = Math.floor(prevAssinatura * (1 + growth * 1.1) * (0.96 + Math.random() * 0.08));
            faturamentoTotal = faturamentoAvulso + faturamentoAssinatura;

            clientesAtendidos = Math.floor(prevStats.clientesAtendidos * (1 + growth * 0.7) * (0.97 + Math.random() * 0.06));
            servicosRealizados = Math.floor(clientesAtendidos * (1.1 + Math.random() * 0.25));
            comissao = Math.floor(faturamentoTotal * (0.45 + Math.random() * 0.05));
            vendaProdutosValor = Math.floor(prevStats.vendaProdutosValor * (1 + growth * 1.25) * (0.95 + Math.random() * 0.1));
            vendasProdutosQtd = Math.max(1, Math.floor(vendaProdutosValor / (25 + Math.random() * 15)));
            taxaRetorno = Math.min(95, Math.max(30, Math.floor(prevStats.taxaRetorno * (1 + (Math.random() * 0.04 - 0.02)))));
            clientesNovos = Math.max(2, Math.floor(prevStats.clientesNovos * (1 + (Math.random() * 0.1 - 0.04))));
            clientesSemPreferencia = Math.max(2, Math.floor(prevStats.clientesSemPreferencia * (1 + (Math.random() * 0.1 - 0.05))));

            extraServices.forEach(ex => {
              const prevCount = prevStats?.extraCounts?.[ex.id] ?? Math.floor(3 + Math.random() * 12);
              const count = Math.max(1, Math.floor(prevCount * (1 + growth) * (0.9 + Math.random() * 0.2)));
              extras[ex.id] = count;
              extraVals[ex.id] = count * 35;
            });
          } else {
            // Fallback baseline for the first simulation
            faturamentoAvulso = Math.floor(4000 + Math.random() * 6500);
            faturamentoAssinatura = Math.floor(500 + Math.random() * 1000);
            faturamentoTotal = faturamentoAvulso + faturamentoAssinatura;

            clientesAtendidos = Math.floor(100 + Math.random() * 80);
            servicosRealizados = Math.floor(clientesAtendidos * (1.1 + Math.random() * 0.22)); 
            comissao = Math.floor(faturamentoTotal * (0.45 + Math.random() * 0.05));
            vendaProdutosValor = Math.floor(150 + Math.random() * 600);
            vendasProdutosQtd = Math.max(1, Math.floor(vendaProdutosValor / (20 + Math.random() * 20)));
            taxaRetorno = Math.floor(50 + Math.random() * 30);
            clientesNovos = Math.floor(10 + Math.random() * 15);
            clientesSemPreferencia = Math.floor(15 + Math.random() * 20);

            extraServices.forEach(ex => {
              const count = Math.floor(3 + Math.random() * 12);
              extras[ex.id] = count;
              extraVals[ex.id] = count * 35;
            });
          }

          const record: MonthlyBarberStats = {
            id: statsId,
            barberId: barber.id,
            unitId: selectedUnitId === 'ALL' ? (barber.unit || 'MAIN') : selectedUnitId,
            month: monthStr,
            faturamentoTotal,
            faturamentoAvulso,
            faturamentoAssinatura,
            comissao,
            clientesAtendidos,
            servicosRealizados,
            vendaProdutosValor,
            vendasProdutosQtd,
            taxaRetorno,
            clientesNovos,
            clientesSemPreferencia,
            extraCounts: extras,
            extraValues: extraVals
          };

          simulatedInSession[statsId] = record;
          promises.push(updateMonthlyBarberStats(record));
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
    if (unitBarbers.length === 0) return;
    const confirmMsg = allMonths 
      ? `Tem certeza que deseja apagar a simulação do ano completo (${selectedYear}) para os barbeiros desta unidade?`
      : `Tem certeza que deseja apagar a simulação do mês de ${MONTH_NAMES[selectedMonthIdx]} para os barbeiros desta unidade?`;
    
    setClearConfirmMsg(confirmMsg);
    clearConfirmAll; // keep reference or assign
    setClearConfirmAll(allMonths);
    setIsShowingSimulateMenu(false);
  };

  const executeClearStats = async () => {
    setIsSimulating(true);
    setClearConfirmMsg(null);
    
    try {
      const monthsToClear = clearConfirmAll
        ? MONTH_NAMES.map((_, idx) => String(idx + 1).padStart(2, '0'))
        : [String(selectedMonthIdx + 1).padStart(2, '0')];

      const promises: Promise<void>[] = [];

      for (const mNum of monthsToClear) {
        const monthStr = `${selectedYear}-${mNum}`;
        for (const barber of unitBarbers) {
          const statsId = `${monthStr}_${barber.id}`;
          promises.push(deleteMonthlyBarberStats(statsId));
        }
      }

      await Promise.all(promises);
    } catch (err) {
      console.error("Erro ao apagar estatísticas:", err);
    } finally {
      setIsSimulating(false);
    }
  };
  
  const availableUnits = useMemo(() => {
    const list = [...(systemUnits || [])];
    const statUnitIds = new Set((monthlyBarberStats || []).map(s => s.unitId).filter(Boolean));
    statUnitIds.forEach(id => {
      if (!list.find(u => u.id === id) && id !== 'ALL') {
        list.push({ id, name: id, createdAt: '' } as any);
      }
    });
    const userUnitIds = new Set((users || []).map(u => u.unit).filter(Boolean));
    userUnitIds.forEach(id => {
      if (!list.find(u => u.id === id) && id !== 'ALL') {
         list.push({ id: id!, name: id!, createdAt: '' } as any);
      }
    });
    return list;
  }, [systemUnits, monthlyBarberStats, users]);

  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');

  const unitBarbers = useMemo(() => {
    return users.filter(u => u.role === 'BARBER' && (selectedUnitId === 'ALL' || u.unit === selectedUnitId));
  }, [users, selectedUnitId]);

  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    initial[currentMonthStr] = true;
    return initial;
  });

  const [expandedBarbers, setExpandedBarbers] = useState<Record<string, boolean>>({});

  const toggleBarber = (monthStr: string, barberId: string) => {
    const key = `${monthStr}_${barberId}`;
    setExpandedBarbers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdate = async (barberId: string, monthStr: string, field: string, val: number, extraId?: string, isExtraCount?: boolean) => {
    const statsId = `${monthStr}_${barberId}`;
    const existing = monthlyBarberStats?.find(s => s.id === statsId);
    
    const existingAssinatura = existing?.faturamentoAssinatura || 0;
    const existingAvulso = existing?.faturamentoAvulso !== undefined
      ? existing.faturamentoAvulso
      : Math.max(0, (existing?.faturamentoTotal || 0) - existingAssinatura);
    const existingTotal = existing?.faturamentoTotal || (existingAvulso + existingAssinatura);

    const updatePayload: any = {
      id: statsId,
      barberId: barberId,
      unitId: selectedUnitId === 'ALL' ? (users.find(u => u.id === barberId)?.unit || 'MAIN') : selectedUnitId,
      month: monthStr,
      faturamentoTotal: existingTotal,
      faturamentoAvulso: existingAvulso,
      faturamentoAssinatura: existingAssinatura,
      comissao: existing?.comissao || 0,
      clientesAtendidos: existing?.clientesAtendidos || 0,
      servicosRealizados: existing?.servicosRealizados || 0,
      vendaProdutosValor: existing?.vendaProdutosValor || 0,
      vendasProdutosQtd: existing?.vendasProdutosQtd || 0,
      taxaRetorno: existing?.taxaRetorno || 0,
      clientesNovos: existing?.clientesNovos || 0,
      clientesSemPreferencia: existing?.clientesSemPreferencia || 0,
      extraCounts: { ...(existing?.extraCounts || {}) },
      extraValues: { ...(existing?.extraValues || {}) }
    };

    if (extraId) {
      if (isExtraCount) {
        updatePayload.extraCounts[extraId] = val;
      } else {
        updatePayload.extraValues[extraId] = val;
      }
    } else if (field === 'faturamentoAvulso') {
      updatePayload.faturamentoAvulso = val;
      updatePayload.faturamentoTotal = val + (updatePayload.faturamentoAssinatura || 0);
    } else if (field === 'faturamentoAssinatura') {
      updatePayload.faturamentoAssinatura = val;
      updatePayload.faturamentoTotal = (updatePayload.faturamentoAvulso || 0) + val;
    } else if (field === 'faturamentoTotal') {
      updatePayload.faturamentoTotal = val;
      updatePayload.faturamentoAvulso = Math.max(0, val - (updatePayload.faturamentoAssinatura || 0));
    } else {
      updatePayload[field] = val;
    }

    await updateMonthlyBarberStats(updatePayload);
  };

  const toggleAll = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    MONTH_NAMES.forEach((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const monthStr = `${selectedYear}-${monthNum}`;
      newExpanded[monthStr] = expand;
    });
    setExpandedMonths(newExpanded);
  };

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthStr]: !prev[monthStr]
    }));
  };

  const currentMonthData = useMemo(() => {
     const monthNum = String(selectedMonthIdx + 1).padStart(2, '0');
     const currentMonthStr = `${selectedYear}-${monthNum}`;
     const data = unitBarbers.map(b => {
        const stat = monthlyBarberStats?.find(s => s.id === `${currentMonthStr}_${b.id}`);
        return {
           name: b.name.split(' ')[0],
           faturamento: stat?.faturamentoTotal || 0,
           atendimentos: stat?.clientesAtendidos || 0,
           comissao: stat?.comissao || 0
        };
     });
     return data;
  }, [selectedYear, selectedMonthIdx, unitBarbers, monthlyBarberStats]);

  const [selectedHistoricalBarber, setSelectedHistoricalBarber] = useState<string>(unitBarbers[0]?.id || '');

  useEffect(() => {
     if (!selectedHistoricalBarber && unitBarbers.length > 0) {
        setSelectedHistoricalBarber(unitBarbers[0].id);
     }
     if (selectedHistoricalBarber && !unitBarbers.find(u => u.id === selectedHistoricalBarber)) {
        setSelectedHistoricalBarber(unitBarbers[0]?.id || '');
     }
  }, [unitBarbers, selectedHistoricalBarber]);

  const historicalData = useMemo(() => {
     return MONTH_NAMES.map((mName, idx) => {
        const monthNum = String(idx + 1).padStart(2, '0');
        const monthStr = `${selectedYear}-${monthNum}`;
        const stat = monthlyBarberStats?.find(s => s.id === `${monthStr}_${selectedHistoricalBarber}`);
        return {
           month: mName.substring(0, 3),
           faturamento: stat?.faturamentoTotal || 0,
           atendimentos: stat?.clientesAtendidos || 0
        };
     });
  }, [selectedYear, selectedHistoricalBarber, monthlyBarberStats]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col p-6 overflow-hidden mt-6">
      {clearConfirmMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div>
            <p className="text-sm font-semibold text-red-900 dark:text-red-400">{clearConfirmMsg}</p>
            <p className="text-xs text-red-500 mt-1">Essa operação é permanente e não poderá ser desfeita.</p>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800 gap-4">
        <div>
           <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
             <Users className="w-6 h-6 text-purple-500" />
             Análise de Barbeiros
           </h2>
           <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
             Acompanhamento de desempenho individual e preenchimento de indicadores.
           </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <select
             value={selectedUnitId}
             onChange={(e) => setSelectedUnitId(e.target.value)}
             className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg text-sm font-semibold outline-none text-gray-755 dark:text-zinc-200 cursor-pointer"
           >
             <option value="ALL">Todas as Unidades</option>
             {availableUnits.map(su => (
               <option key={su.id} value={su.id}>{su.name}</option>
             ))}
           </select>

           <select
             value={selectedMonthIdx}
             onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
             className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-2 rounded-lg text-sm font-semibold outline-none text-gray-755 dark:text-zinc-200 cursor-pointer"
           >
             {MONTH_NAMES.map((m, idx) => (
               <option key={idx} value={idx}>{m}</option>
             ))}
           </select>
           <div className="flex items-center bg-gray-50 dark:bg-zinc-800 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
             <button 
               onClick={() => setSelectedYear(y => y - 1)}
               className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
             >
               <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="px-4 py-2 font-bold text-gray-800 dark:text-zinc-100 min-w-[80px] text-center">
               {selectedYear}
             </div>
             <button 
               onClick={() => setSelectedYear(y => y + 1)}
               className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
             >
               <ChevronRight className="w-5 h-5" />
             </button>
           </div>

            <div className="relative">
              <button
                disabled={isSimulating}
                onClick={() => setIsShowingSimulateMenu(!isShowingSimulateMenu)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-black shadow-sm transition-all active:scale-95 cursor-pointer border select-none ${
                  isSimulating
                    ? 'bg-zinc-850 text-zinc-500 border-zinc-700 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                {isSimulating ? 'Preenchendo...' : 'Preenchimento Rápido'}
              </button>
              
              {isShowingSimulateMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg z-50 py-2.5 font-sans animate-in fade-in slide-in-from-top-1">
                  {unitBarbers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-zinc-400 text-center select-none">
                      Nenhum barbeiro disponível para simular nesta unidade.<br />
                      <span className="text-3xs text-purple-400 mt-1.5 block leading-normal">
                        Selecione "Todas as Unidades" ou cadastre um barbeiro.
                      </span>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
         </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
           <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-2 w-full">Faturamento por Barbeiro ({MONTH_NAMES[selectedMonthIdx]})</h3>
           <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentMonthData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                   <XAxis dataKey="name" tick={{fontSize: 12, fill: '#888'}} />
                   <YAxis tickFormatter={(v) => `R$${v}`} tick={{fontSize: 12, fill: '#888'}} width={60} />
                   <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                   <Bar dataKey="faturamento" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
           <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-2 w-full">Atendimentos por Barbeiro ({MONTH_NAMES[selectedMonthIdx]})</h3>
           <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentMonthData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                   <XAxis dataKey="name" tick={{fontSize: 12, fill: '#888'}} />
                   <YAxis tick={{fontSize: 12, fill: '#888'}} width={40} />
                   <Tooltip />
                   <Bar dataKey="atendimentos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="mb-8 bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h3 className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Comparativo Anual por Barbeiro</h3>
            <select
               value={selectedHistoricalBarber}
               onChange={e => setSelectedHistoricalBarber(e.target.value)}
               className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
            >
               {unitBarbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
         </div>
         {unitBarbers.length === 0 ? (
           <div className="text-center py-6 text-gray-400 dark:text-zinc-500 text-sm">Nenhum barbeiro disponível.</div>
         ) : (
           <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                   <XAxis dataKey="month" tick={{fontSize: 12, fill: '#888'}} />
                   <YAxis yAxisId="left" tickFormatter={(v) => `R$${v}`} tick={{fontSize: 12, fill: '#888'}} width={50} />
                   <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#888'}} width={30} />
                   <Tooltip formatter={(value: number, name: string) => {
                     if (name === 'faturamento') return [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Faturamento'];
                     return [value, 'Atendimentos'];
                   }} />
                   <Legend wrapperStyle={{ fontSize: '12px' }} />
                   <Line yAxisId="left" type="monotone" dataKey="faturamento" name="faturamento" stroke="#a855f7" strokeWidth={3} dot={{r: 4, fill: '#a855f7'}} activeDot={{r: 6}} />
                   <Line yAxisId="right" type="monotone" dataKey="atendimentos" name="atendimentos" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
           </div>
         )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 bg-slate-50 dark:bg-zinc-800/45 px-4 py-3 rounded-2xl border border-gray-150 dark:border-zinc-800 gap-2">
        <span className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 font-medium">
          Selecione o mês para preencher ou visualizar o desempenho de cada barbeiro.
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAll(true)}
            className="text-2xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/10 transition-all cursor-pointer"
          >
            Expandir
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="text-2xs font-bold text-gray-650 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700/55 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 transition-all cursor-pointer"
          >
            Recolher
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {MONTH_NAMES.map((monthName, idx) => {
          const monthNum = String(idx + 1).padStart(2, '0');
          const monthStr = `${selectedYear}-${monthNum}`;
          const isExpanded = !!expandedMonths[monthStr];

          return (
            <div key={monthStr} className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div 
                onClick={() => toggleMonth(monthStr)}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60 cursor-pointer transition-all select-none gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/15 rounded-xl text-purple-500">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm sm:text-base">{monthName} / {selectedYear}</h3>
                    <span className="text-3xs font-mono text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Mês {monthNum}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-150 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-950/10">
                   {unitBarbers.length === 0 ? (
                     <div className="text-center py-6 text-gray-500 dark:text-zinc-400 text-sm">
                       Nenhum barbeiro cadastrado nesta unidade.
                     </div>
                   ) : (
                     <div className="space-y-6">
                       {unitBarbers.map(barber => {
                          const statsId = `${monthStr}_${barber.id}`;
                          const bStats = monthlyBarberStats?.find(s => s.id === statsId) || {
                            faturamentoTotal: 0, faturamentoAvulso: 0, faturamentoAssinatura: 0, comissao: 0, clientesAtendidos: 0,
                            servicosRealizados: 0, vendaProdutosValor: 0, vendasProdutosQtd: 0, taxaRetorno: 0,
                            clientesNovos: 0, clientesSemPreferencia: 0, extraCounts: {}, extraValues: {}
                          };
                          
                          const fatAssinatura = bStats.faturamentoAssinatura || 0;
                          const fatAvulso = bStats.faturamentoAvulso !== undefined
                            ? bStats.faturamentoAvulso
                            : Math.max(0, (bStats.faturamentoTotal || 0) - fatAssinatura);
                          const fatTotal = (bStats.faturamentoTotal !== undefined && bStats.faturamentoTotal > 0)
                            ? bStats.faturamentoTotal
                            : (fatAvulso + fatAssinatura);

                          const ticketMedio = bStats.clientesAtendidos > 0 ? (fatTotal / bStats.clientesAtendidos) : 0;
                          const geracaoDemanda = (bStats.clientesNovos || 0) + (bStats.clientesSemPreferencia || 0);

                          return (
                              <div key={barber.id} className="border border-gray-100 dark:border-zinc-800/80 rounded-2xl bg-gray-50/30 dark:bg-zinc-900/50 shadow-sm overflow-hidden">
                                <div 
                                  onClick={() => toggleBarber(monthStr, barber.id)}
                                  className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                       <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-gray-800 dark:text-zinc-200">{barber.name}</h4>
                                      <div className="text-2xs text-gray-500 dark:text-zinc-500 font-mono mt-0.5">
                                        Fat. Total: {fatTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Avulso: {fatAvulso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Assin.: {fatAssinatura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) • Atend: {bStats.clientesAtendidos}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end mt-2 md:mt-0">
                                    {!!expandedBarbers[`${monthStr}_${barber.id}`] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                  </div>
                                </div>

                                {!!expandedBarbers[`${monthStr}_${barber.id}`] && (
                                  <div className="p-4 border-t border-gray-100 dark:border-zinc-800/80">
                                    <h5 className="text-3xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
                                      Indicadores Principais (Faturamento Total = Avulso + Assinaturas)
                                    </h5>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                      <CardInput label="Fat. Total (Avulso+Assin)" value={fatTotal} onChange={v => handleUpdate(barber.id, monthStr, 'faturamentoTotal', v)} prefix="R$" />
                                      <CardInput label="Fat. Avulso" value={fatAvulso} onChange={v => handleUpdate(barber.id, monthStr, 'faturamentoAvulso', v)} prefix="R$" />
                                      <CardInput label="Fat. Assinaturas" value={fatAssinatura} onChange={v => handleUpdate(barber.id, monthStr, 'faturamentoAssinatura', v)} prefix="R$" />
                                      <CardInput label="Ticket Médio" value={ticketMedio} prefix="R$" isReadOnly />
                                      <CardInput label="Comissão" value={bStats.comissao} onChange={v => handleUpdate(barber.id, monthStr, 'comissao', v)} prefix="R$" />
                                      <CardInput label="Clientes Atendidos" value={bStats.clientesAtendidos} onChange={v => handleUpdate(barber.id, monthStr, 'clientesAtendidos', v)} suffix="un" />
                                      <CardInput label="Serviços Realizados" value={bStats.servicosRealizados} onChange={v => handleUpdate(barber.id, monthStr, 'servicosRealizados', v)} suffix="un" />
                                      <CardInput label="Vendas Produtos Qtd" value={bStats.vendasProdutosQtd} onChange={v => handleUpdate(barber.id, monthStr, 'vendasProdutosQtd', v)} suffix="un" />
                                      <CardInput label="Vendas Produtos (R$)" value={bStats.vendaProdutosValor} onChange={v => handleUpdate(barber.id, monthStr, 'vendaProdutosValor', v)} prefix="R$" />
                                      <CardInput label="Taxa Retorno" value={bStats.taxaRetorno} onChange={v => handleUpdate(barber.id, monthStr, 'taxaRetorno', v)} suffix="%" />
                                      <CardInput label="Clientes Novos" value={bStats.clientesNovos} onChange={v => handleUpdate(barber.id, monthStr, 'clientesNovos', v)} suffix="un" />
                                      <CardInput label="Sem Preferência" value={bStats.clientesSemPreferencia} onChange={v => handleUpdate(barber.id, monthStr, 'clientesSemPreferencia', v)} suffix="un" />
                                      <CardInput label="Geração Demanda" value={geracaoDemanda} suffix="un" isReadOnly />
                                    </div>

                                    {extraServices.length > 0 && (
                                      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-zinc-800/60">
                                        <h5 className="text-3xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-3 block">
                                          Serviços Extras
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                          {extraServices.map(ex => {
                                             const qtd = (bStats.extraCounts || {})[ex.id] || 0;
                                             const val = (bStats.extraValues || {})[ex.id] || 0;
                                             return (
                                               <div key={ex.id} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/50 dark:border-amber-900/40 p-3 rounded-xl shadow-sm">
                                                 <div className="text-2xs font-extrabold text-amber-800 dark:text-amber-500 uppercase select-none mb-2 truncate" title={ex.name}>
                                                   {ex.name}
                                                 </div>
                                                 <div className="grid grid-cols-2 gap-2">
                                                   <CardInput label="Qtd" value={qtd} onChange={v => handleUpdate(barber.id, monthStr, 'extraCounts', v, ex.id, true)} />
                                                   <CardInput label="R$" value={val} onChange={v => handleUpdate(barber.id, monthStr, 'extraValues', v, ex.id, false)} />
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
                       })}
                     </div>
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

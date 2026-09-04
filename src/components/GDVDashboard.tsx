import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, TrendingUp, Calendar, AlertCircle, Edit2, X, Save, Settings } from 'lucide-react';
import { GDVEntry, GDVUnitData, GDVSettings } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { AppPageHeader } from './ui/AppPrimitives';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function GDVDashboard() {
  const { gdvEntries, users, updateGDVEntry, gdvSettings, updateGDVSettings, systemUnits } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [editingDay, setEditingDay] = useState<any | null>(null);
  const [editingSettings, setEditingSettings] = useState<GDVSettings | null>(null);
  const [showUnitChartsModal, setShowUnitChartsModal] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Find units from the users
    const units = useMemo(() => {
    if (systemUnits && systemUnits.length > 0) {
      return systemUnits.map(su => su.id);
    }
    // Fallback to active users units
    const unitSet = new Set<string>();
    users.forEach(u => {
      if ((u.role === 'BARBER' || u.role === 'MANICURE') && u.unit) unitSet.add(u.unit);
    });
    return Array.from(unitSet).sort();
  }, [systemUnits, users]);

  const getUnitName = (unitId: string) => {
    return systemUnits?.find(su => su.id === unitId)?.name || unitId;
  };

  
  const settingsId = `${year}-${String(month + 1).padStart(2, '0')}`;
  const currentSettings = useMemo(() => {
    const s = gdvSettings.find(set => set.id === settingsId);
    if (s) return s;
    const defaultUnits: Record<string, any> = {};
    units.forEach(u => defaultUnits[u] = { metaQuinzenal: 0, metaMensal: 0, diasNaoUteisQuinzenal: 0, diasNaoUteisMensal: 0 });
    return { id: settingsId, metaGeral: 0, units: defaultUnits };
  }, [gdvSettings, settingsId, units]);

  // Aggregate daily data
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const reportData = useMemo(() => {
    const data: Record<number, any> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStrStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayData: any = {
        date: dateStrStr,
        weekday: WEEKDAY_NAMES[dateObj.getDay()],
        units: {},
        svaTotal: 0,
        recorrencia: 0,
      };

      // Initialize empty
      units.forEach(unit => {
        dayData.units[unit] = { servicos: null, produtos: null, assinaturas: null, total: 0, isNonWorkingDay: false, isFilled: false };
      });

      // Override with manual data if exists
      const entryIdx = gdvEntries.findIndex(e => e.id === dateStrStr);
      if (entryIdx >= 0) {
        const e = gdvEntries[entryIdx];
        dayData.recorrencia = e.recorrencia || 0;
        units.forEach(unit => {
           if (e.units && e.units[unit]) {
             const u = e.units[unit];
             const hasServicos = u.servicos !== null && u.servicos !== undefined && (u.servicos as any) !== '';
             const hasProdutos = u.produtos !== null && u.produtos !== undefined && (u.produtos as any) !== '';
             const hasAssinaturas = u.assinaturas !== null && u.assinaturas !== undefined && (u.assinaturas as any) !== '';

             dayData.units[unit].servicos = hasServicos ? Number(u.servicos) : null;
             dayData.units[unit].produtos = hasProdutos ? Number(u.produtos) : null;
             dayData.units[unit].assinaturas = hasAssinaturas ? Number(u.assinaturas) : null;
             dayData.units[unit].isNonWorkingDay = u.isNonWorkingDay || false;
             dayData.units[unit].isFilled = hasServicos && hasProdutos && hasAssinaturas;
           }
        });
      }

      // Calculate totals
      let daySva = 0;
      let dayRecorrencia = 0;
      units.forEach(unit => {
        const u = dayData.units[unit];
        u.total = (u.servicos || 0) + (u.produtos || 0) + (u.assinaturas || 0);
        daySva += u.total;
        dayRecorrencia += (u.assinaturas || 0);
      });
      dayData.svaTotal = daySva;
      dayData.recorrencia = dayRecorrencia;
      dayData.faturamentoTotal = dayData.svaTotal + dayData.recorrencia;

      data[day] = dayData;
    }

    return Object.values(data);
  }, [year, month, daysInMonth, gdvEntries, units]);

  // Aggregate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: any = { units: {}, svaTotal: 0, faturamentoTotal: 0, recorrenciaTotal: 0 };
    units.forEach(unit => {
      totals.units[unit] = { servicos: 0, produtos: 0, assinaturas: 0, total: 0, diasNaoUteis: 0, diasApurados: 0 };
    });

    reportData.forEach(day => {
      units.forEach(unit => {
        totals.units[unit].servicos += day.units[unit].servicos;
        totals.units[unit].produtos += day.units[unit].produtos;
        totals.units[unit].assinaturas += day.units[unit].assinaturas;
        totals.units[unit].total += day.units[unit].total;
        if (day.units[unit].isNonWorkingDay) totals.units[unit].diasNaoUteis++;
        if (day.units[unit].isFilled && !day.units[unit].isNonWorkingDay) totals.units[unit].diasApurados++;
      });
      totals.svaTotal += day.svaTotal;
      totals.recorrenciaTotal += day.recorrencia;
      totals.faturamentoTotal += day.faturamentoTotal;
    });

    return totals;
  }, [reportData, units]);

  const quinzenalTotals = useMemo(() => {
    const totals: any = { units: {}, svaTotal: 0, faturamentoTotal: 0, recorrenciaTotal: 0 };
    units.forEach(unit => {
      totals.units[unit] = { servicos: 0, produtos: 0, assinaturas: 0, total: 0, diasNaoUteis: 0, diasApurados: 0 };
    });

    // Only sum days 1-15
    reportData.filter(d => {
      const match = d.date.match(/-(\d{2})$/);
      return match && parseInt(match[1], 10) <= 15;
    }).forEach(day => {
      units.forEach(unit => {
        totals.units[unit].servicos += day.units[unit].servicos;
        totals.units[unit].produtos += day.units[unit].produtos;
        totals.units[unit].assinaturas += day.units[unit].assinaturas;
        totals.units[unit].total += day.units[unit].total;
        if (day.units[unit].isNonWorkingDay) totals.units[unit].diasNaoUteis++;
        if (day.units[unit].isFilled && !day.units[unit].isNonWorkingDay) totals.units[unit].diasApurados++;
      });
      totals.svaTotal += day.svaTotal;
      totals.recorrenciaTotal += day.recorrencia;
      totals.faturamentoTotal += day.faturamentoTotal;
    });
    return totals;
  }, [reportData, units]);

  const openSettingsModal = () => {
    // Clone currentsettings to avoid mutate
    setEditingSettings(JSON.parse(JSON.stringify(currentSettings)));
  };

  const handleSaveSettings = async () => {
    if (!editingSettings) return;
    await updateGDVSettings(editingSettings);
    setEditingSettings(null);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const openEditModal = (dayData: any) => {
    setEditingDay(JSON.parse(JSON.stringify(dayData)));
  };

  const handleSaveModal = async () => {
    if (!editingDay) return;
    
    const entry: GDVEntry = {
      id: editingDay.date,
      date: editingDay.date,
      units: {},
      recorrencia: Number(editingDay.recorrencia) || 0
    };

    units.forEach(u => {
      const sVal = editingDay.units[u].servicos;
      const pVal = editingDay.units[u].produtos;
      const aVal = editingDay.units[u].assinaturas;

      const isServicosEmpty = sVal === '' || sVal === undefined || sVal === null;
      const isProdutosEmpty = pVal === '' || pVal === undefined || pVal === null;
      const isAssinaturasEmpty = aVal === '' || aVal === undefined || aVal === null;

      entry.units[u] = {
        servicos: isServicosEmpty ? null : Number(sVal),
        produtos: isProdutosEmpty ? null : Number(pVal),
        assinaturas: isAssinaturasEmpty ? null : Number(aVal),
        isNonWorkingDay: editingDay.units[u].isNonWorkingDay || false
      };
    });

    await updateGDVEntry(entry);
    setEditingDay(null);
  };

  return (
    <div className="space-y-6">
      <AppPageHeader
        eyebrow="Operação"
        title="Indicadores SVA"
        description="Acompanhe a evolução diária, recorrências e objetivos de cada unidade."
        icon={<TrendingUp className="h-5 w-5" />}
      />
    <div className="relative overflow-x-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800 gap-4">
        <div>
           <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
             <TrendingUp className="w-6 h-6 text-amber-500" />
             Gráfico de resultados
           </h2>
           <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
             Gráfico de resultados SVA. Preenchimento manual pelo ADM.
           </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={openSettingsModal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 font-bold rounded-xl transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Configurar Objetivos
          </button>
          
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800">
             <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg text-gray-500 dark:text-zinc-400 transition cursor-pointer">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-2 min-w-[140px] justify-center">
               <Calendar className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
               <span className="font-bold text-gray-700 dark:text-zinc-200 tracking-tight">
                 {MONTH_NAMES[month].toUpperCase()} {year}
               </span>
             </div>
             <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg text-gray-500 dark:text-zinc-400 transition cursor-pointer">
               <ChevronRight className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>

      {/* Dashboard Chart */}
      {units.length > 0 && reportData.length > 0 && (
        <div className="mb-8 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wide">Evolução Diária - SVA</h3>
              <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">Comparativo de SVA e Recorrências ao longo do mês</p>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-4 md:mt-0">
              <button 
                onClick={() => setShowUnitChartsModal(true)}
                className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/30 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition uppercase text-xs tracking-wider"
              >
                <TrendingUp className="w-4 h-4" />
                Por Unidade
              </button>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800">
                 <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                 <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase">SVA Total</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800">
                 <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
                 <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase">Recorrências</span>
              </div>
            </div>
          </div>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reportData.map(d => ({ day: d.date.split('-')[2], SVA: d.svaTotal, Recorrencia: d.recorrencia }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSVA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d18e24" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d18e24" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="day" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#a1a1aa" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val >= 1000 ? `R$ ${(val/1000).toFixed(0)}k` : `R$ ${val}`} 
                  width={55}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7', fontWeight: 'bold' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                  formatter={(value: number) => [formatCurrency(value), '']} 
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Area type="monotone" dataKey="SVA" stroke="#d18e24" strokeWidth={3} fillOpacity={1} fill="url(#colorSVA)" />
                <Area type="monotone" dataKey="Recorrencia" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Objetivo Geral & Gráficos Summary */}
      {units.length > 0 && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Gráfico de Resultados SVA */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="bg-amber-900/40 text-center font-black p-4 text-2xl sm:text-3xl uppercase text-gray-900 dark:text-zinc-100 shadow-sm tracking-tight">
              Gráfico de Resultados SVA
            </div>
            <div className="flex-1 p-0 overflow-x-auto">
              <table className="w-full text-center border-collapse min-w-[450px] sm:min-w-0">
                <thead>
                  <tr className="text-gray-900 dark:text-zinc-100 text-[10px] sm:text-xs bg-gray-50 border-gray-200 dark:bg-zinc-950 border-b border-gray-300 dark:border-zinc-700">
                     <th className="p-1 sm:p-2 bg-gray-100 dark:bg-zinc-800"></th>
                     <th className="p-1 sm:p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 uppercase font-black">SVA (Quinz.)</th>
                     <th className="p-1 sm:p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 uppercase font-black">Objetivo (Quinz.)</th>
                     <th className="p-1 sm:p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 uppercase font-black">SVA (Mensal)</th>
                     <th className="p-1 sm:p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 uppercase font-black">Objetivo (Mensal)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 dark:text-zinc-100 font-mono text-xs sm:text-sm leading-relaxed">
                  {units.map((unit, idx) => {
                    const quinzenalSVA = quinzenalTotals.units[unit]?.total || 0;
                    const mensalSVA = monthlyTotals.units[unit]?.total || 0;
                    const metaQuinz = currentSettings.units[unit]?.metaQuinzenal || 0;
                    const metaMensal = currentSettings.units[unit]?.metaMensal || 0;
                    return (
                      <tr key={unit} className="border-b border-gray-300 dark:border-zinc-700 hover:bg-gray-500/5">
                        <td className="p-2 sm:p-4 font-black bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 uppercase font-sans text-[11px] sm:text-sm tracking-wide">{getUnitName(unit)}</td>
                        <td className="p-2 sm:p-4 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 text-xs sm:text-lg">{formatCurrency(quinzenalSVA)}</td>
                        <td className="p-2 sm:p-4 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 text-xs sm:text-lg">{formatCurrency(metaQuinz)}</td>
                        <td className="p-2 sm:p-4 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 text-xs sm:text-lg">{formatCurrency(mensalSVA)}</td>
                        <td className="p-2 sm:p-4 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 text-xs sm:text-lg">{formatCurrency(metaMensal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Objetivo Geral (SVA) */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="bg-amber-900/40 text-center font-black p-3 text-xl sm:text-2xl text-gray-900 dark:text-zinc-100 uppercase tracking-wide">
              Objetivo Geral (SVA)
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center border-b border-gray-300 dark:border-zinc-700">
               <div className="p-3.5 sm:p-4 flex sm:flex-col items-center sm:justify-center justify-between border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800 min-h-[50px] sm:min-h-[100px] bg-gray-100 dark:bg-zinc-800">
                 <span className="text-xs text-gray-900 dark:text-zinc-100 font-extrabold uppercase sm:mb-4">SVA (Total)</span>
                 <span className="text-gray-900 dark:text-zinc-100 font-mono bg-gray-50 border border-gray-200 dark:border-zinc-950 dark:bg-zinc-950 px-2 py-1.5 sm:py-2 rounded text-sm sm:text-lg">{formatCurrency(monthlyTotals.svaTotal)}</span>
               </div>
               <div className="p-3.5 sm:p-4 flex sm:flex-col items-center sm:justify-center justify-between border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 min-h-[50px] sm:min-h-[100px]">
                 <span className="text-xs text-gray-900 dark:text-zinc-100 font-extrabold uppercase sm:mb-4">Recorrências (Total)</span>
                 <span className="text-gray-900 dark:text-zinc-100 font-mono text-sm sm:text-lg">{formatCurrency(monthlyTotals.recorrenciaTotal)}</span>
               </div>
               <div className="p-3.5 sm:p-4 flex sm:flex-col items-center sm:justify-center justify-between min-h-[50px] sm:min-h-[100px] bg-gray-100 dark:bg-zinc-800">
                 <span className="text-xs text-gray-900 dark:text-zinc-100 font-extrabold uppercase sm:mb-4">Objetivo Geral SVA</span>
                 <span className="text-gray-900 dark:text-zinc-100 font-mono bg-gray-50 border border-gray-200 dark:border-zinc-950 dark:bg-zinc-950 px-2 py-1.5 sm:py-2 rounded text-sm sm:text-lg">{formatCurrency(currentSettings.metaGeral)}</span>
               </div>
            </div>

            <div className="bg-amber-900/40 text-center font-black p-2 text-md sm:text-lg text-gray-900 dark:text-zinc-100 italic tracking-wider uppercase">
               PROGRESSO GERAL
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 text-center flex-1">
               <div className={`p-4 sm:p-6 flex sm:flex-col items-center sm:justify-center justify-between border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-zinc-800 ${currentSettings.metaGeral - monthlyTotals.svaTotal <= 0 ? 'bg-green-600' : 'bg-[#f97316]'}`}>
                 <span className="text-[10px] text-white font-black italic uppercase sm:mb-2 text-shadow-sm">Faturamento Restante</span>
                 <span className="text-white font-bold text-lg sm:text-2xl md:text-3xl font-mono text-shadow-sm">
                   {currentSettings.metaGeral - monthlyTotals.svaTotal <= 0 ? 'OBJETIVO BATIDO 🎉' : formatCurrency(currentSettings.metaGeral - monthlyTotals.svaTotal)}
                 </span>
               </div>
               <div className="p-4 sm:p-6 flex sm:flex-col items-center sm:justify-center justify-between bg-gray-50 border-gray-200 dark:bg-zinc-950 min-w-0 sm:min-w-[160px]">
                 <span className="text-[10px] text-gray-900 dark:text-zinc-100 font-black italic uppercase sm:mb-2 whitespace-nowrap">% Atingido (Objetivo Geral SVA)</span>
                 <span className="text-gray-900 dark:text-zinc-100 font-bold text-xl sm:text-3xl font-mono">
                   {currentSettings.metaGeral > 0 
                     ? ((monthlyTotals.svaTotal / currentSettings.metaGeral) * 100).toFixed(2) 
                     : "0.00"}%
                 </span>
               </div>
            </div>
          </div>
          
        </div>
      )}

      {/* Progress Cards per Unit */}
      {units.length > 0 && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* QUINZENAL SVA */}
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col">
              <div className="bg-amber-900/40 text-center font-black italic p-3 text-2xl uppercase text-gray-900 dark:text-zinc-100 shadow-sm tracking-wide">
                QUINZENAL (SVA)
              </div>
              <div className="p-0 space-y-4 pt-4 pb-4">
            {units.map((unit, idx) => {
              const uMeta = currentSettings.units[unit];
              const qMeta = uMeta?.metaQuinzenal || 0;
              const qSVA = quinzenalTotals.units[unit]?.total || 0;
              
              // SVA da quinzena - dias restantes = termino da quinzena - dias apurados - dias não úteis.
              const diasApurados = quinzenalTotals.units[unit]?.diasApurados || 0;
              const diasNaoUteis = quinzenalTotals.units[unit]?.diasNaoUteis || 0;
              const daysLeft = Math.max(0, 15 - diasApurados - diasNaoUteis);

              // Use SVA total (mensal) to know faturamento restante da quinzena? The screenshot compares "SVA (Quinzena)"
              const leftSVA = qMeta - qSVA;
              const leftPerDay = daysLeft > 0 ? (leftSVA / daysLeft) : 0;
              const pct = qMeta > 0 ? ((qSVA / qMeta) * 100).toFixed(2) : "0.00";

              return (
                <div key={unit} className="flex flex-col border-b border-gray-300 dark:border-zinc-700">
                  <div className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-center font-black italic p-2 uppercase text-lg">
                    {getUnitName(unit)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 text-center bg-gray-50 border-gray-200 dark:bg-zinc-950 font-mono text-sm border-t border-gray-200 dark:border-zinc-800">
                    <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">DIAS ÚTEIS RESTANTES</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-2xl bg-gray-50 dark:bg-zinc-950">
                        {daysLeft}
                      </div>
                    </div>
                    <div className="flex flex-col border-b border-l border-gray-200 dark:border-zinc-800 md:border-l-0 md:border-b-0 md:border-r">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">FATURAMENTO RESTANTE</div>
                      <div className={`p-4 flex-1 flex items-center justify-center font-bold text-white text-xl md:text-2xl min-h-[5rem] ${leftSVA <= 0 ? 'bg-green-600' : 'bg-[#ea580c]'}`}>
                        {leftSVA <= 0 ? 'OBJETIVO BATIDO 🎉' : formatCurrency(leftSVA)}
                      </div>
                    </div>
                    <div className="flex flex-col border-b md:border-b-0 border-r border-gray-200 dark:border-zinc-800">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">RESTANTE POR DIA</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-xl bg-gray-50 dark:bg-zinc-950">
                        {leftSVA <= 0 ? '-' : (leftPerDay > 0 ? formatCurrency(leftPerDay) : "R$ 0,00")}
                      </div>
                    </div>
                    <div className="flex flex-col border-b md:border-b-0 border-l border-gray-200 dark:border-zinc-800 md:border-l-0">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">PERCENTUAL ATINGIDO</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-xl bg-gray-50 dark:bg-zinc-950">
                        {pct}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
              
              {/* Dia de Apuração Block Quinzenal */}
              <div className="flex flex-col text-sm border-t border-gray-300 dark:border-zinc-700 font-mono">
                {units.map((unit, idx) => (
                  <div key={`apuracao-${unit}`} className="flex border-b border-gray-300 dark:border-zinc-700">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      DIA DE APURAÇÃO {getUnitName(unit)}
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      {quinzenalTotals.units[unit]?.diasApurados || 0}
                    </div>
                  </div>
                ))}
                <div className="flex">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      TÉRMINO DA QUINZENA
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      15
                    </div>
                </div>
              </div>
            </div>

            {/* Dias Não Úteis Quinzenal */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col">
              <div className="bg-gray-100 dark:bg-zinc-800 text-center font-black p-2 text-xl uppercase text-gray-900 dark:text-zinc-100 tracking-wide border-b border-gray-300 dark:border-zinc-700">
                DIAS NÃO ÚTEIS
              </div>
              <div className="flex flex-col text-sm font-mono">
                {units.map((unit, idx) => (
                  <div key={`naouteis-${unit}`} className="flex border-b border-gray-300 dark:border-zinc-700">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      DIAS NÃO ÚTEIS {getUnitName(unit)}
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      {quinzenalTotals.units[unit]?.diasNaoUteis || 0}
                    </div>
                  </div>
                ))}
                <div className="flex">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      TÉRMINO DA QUINZENA
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-xs">
                      15/{String(month + 1).padStart(2,'0')}/{year}
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* MENSAL COLUMN */}
          <div className="flex flex-col gap-4">
            {/* MENSAL SVA */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col">
              <div className="bg-amber-900/40 text-center font-black italic p-3 text-2xl uppercase text-gray-900 dark:text-zinc-100 shadow-sm tracking-wide">
                MENSAL (SVA)
              </div>
              <div className="p-0 space-y-4 pt-4 pb-4">
            {units.map((unit, idx) => {
              const uMeta = currentSettings.units[unit];
              const mMeta = uMeta?.metaMensal || 0;
              const mSVA = monthlyTotals.units[unit]?.total || 0;
              
              // Va mensal - dias restantes = termino do mês - dias apurados - dias não uteis
              const diasApurados = monthlyTotals.units[unit]?.diasApurados || 0;
              const diasNaoUteis = monthlyTotals.units[unit]?.diasNaoUteis || 0;
              const daysLeft = Math.max(0, daysInMonth - diasApurados - diasNaoUteis);

              const leftSVA = mMeta - mSVA;
              const leftPerDay = daysLeft > 0 ? (leftSVA / daysLeft) : 0;
              const pct = mMeta > 0 ? ((mSVA / mMeta) * 100).toFixed(2) : "0.00";

              return (
                <div key={unit} className="flex flex-col border-b border-gray-300 dark:border-zinc-700">
                  <div className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-center font-black italic p-2 uppercase text-lg">
                    {getUnitName(unit)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 text-center bg-gray-50 border-gray-200 dark:bg-zinc-950 font-mono text-sm border-t border-gray-200 dark:border-zinc-800">
                    <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">DIAS ÚTEIS RESTANTES</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-2xl bg-gray-50 dark:bg-zinc-950">
                        {daysLeft}
                      </div>
                    </div>
                    <div className="flex flex-col border-b border-l border-gray-200 dark:border-zinc-800 md:border-l-0 md:border-b-0 md:border-r">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">FATURAMENTO RESTANTE</div>
                      <div className={`p-4 flex-1 flex items-center justify-center font-bold text-white text-xl md:text-2xl min-h-[5rem] ${leftSVA <= 0 ? 'bg-green-600' : 'bg-[#ea580c]'}`}>
                        {leftSVA <= 0 ? 'OBJETIVO BATIDO 🎉' : formatCurrency(leftSVA)}
                      </div>
                    </div>
                    <div className="flex flex-col border-b md:border-b-0 border-r border-gray-200 dark:border-zinc-800">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">RESTANTE POR DIA</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-xl bg-gray-50 dark:bg-zinc-950">
                        {leftSVA <= 0 ? '-' : (leftPerDay > 0 ? formatCurrency(leftPerDay) : "R$ 0,00")}
                      </div>
                    </div>
                    <div className="flex flex-col border-b md:border-b-0 border-l border-gray-200 dark:border-zinc-800 md:border-l-0">
                      <div className="p-2 bg-amber-900/40 text-gray-900 dark:text-zinc-100 text-[10px] font-black italic uppercase shadow-sm">PERCENTUAL ATINGIDO</div>
                      <div className="p-4 flex-1 flex items-center justify-center font-bold text-gray-900 dark:text-white text-xl bg-gray-50 dark:bg-zinc-950">
                        {pct}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>

              {/* Dia de Apuração Block Mensal */}
              <div className="flex flex-col text-sm border-t border-gray-300 dark:border-zinc-700 font-mono">
                {units.map((unit, idx) => (
                  <div key={`apuracao-${unit}`} className="flex border-b border-gray-300 dark:border-zinc-700">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      DIA DE APURAÇÃO {getUnitName(unit)}
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      {monthlyTotals.units[unit]?.diasApurados || 0}
                    </div>
                  </div>
                ))}
                <div className="flex">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      FINAL DO MÊS
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      {daysInMonth}
                    </div>
                </div>
              </div>
            </div>

            {/* Dias Não Úteis Mensal */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col justify-start flex-1 min-h-[min-content]">
              <div className="bg-gray-100 dark:bg-zinc-800 text-center font-black p-2 text-xl uppercase text-gray-900 dark:text-zinc-100 tracking-wide border-b border-gray-300 dark:border-zinc-700">
                DIAS NÃO ÚTEIS
              </div>
              <div className="flex flex-col text-sm font-mono h-full">
                {units.map((unit, idx) => (
                  <div key={`naouteis-${unit}`} className="flex border-b border-gray-300 dark:border-zinc-700 last:border-b-0 h-full min-h-[46px]">
                    <div className="flex-1 p-2 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-bold uppercase text-right flex items-center justify-end border-r border-[#27272a]">
                      DIAS NÃO ÚTEIS {getUnitName(unit)}
                    </div>
                    <div className="w-[120px] sm:w-[160px] p-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold text-center flex items-center justify-center text-lg">
                      {monthlyTotals.units[unit]?.diasNaoUteis || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
           <AlertCircle className="w-10 h-10 mb-2 text-amber-400" />
           <p>Nenhuma unidade com barbeiros cadastrados no sistema.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-4">
           <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
             <thead>
               <tr className="text-gray-900 dark:text-zinc-100 font-sans">
                 <th colSpan={3} className="p-3 bg-white dark:bg-zinc-900 border-b border-r border-gray-300 dark:border-zinc-700 sticky left-0 z-30 text-center font-black uppercase text-xs tracking-wider">
                    Data
                 </th>
                 {units.map((unit, idx) => (
                   <th key={unit} colSpan={4} className="p-3 border-b border-r border-gray-300 dark:border-zinc-700 text-center font-black uppercase bg-gray-100 dark:bg-zinc-800 text-xs tracking-wider">
                     {getUnitName(unit)}
                   </th>
                 ))}
               <th colSpan={2} className="p-3 border-b border-amber-700/50 text-center font-black text-gray-900 dark:text-zinc-100 uppercase bg-amber-900/40 text-xs tracking-wider shadow-sm">
                   Gerais
                 </th>
               </tr>
               <tr className="text-[10px] uppercase font-black text-gray-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 tracking-wider">
                 <th className="p-3 border-b border-r border-gray-300 dark:border-zinc-700 sticky left-0 z-30 bg-white dark:bg-zinc-900">Dia</th>
                 <th className="p-3 border-b border-r border-gray-300 dark:border-zinc-700 sticky left-12 z-30 bg-white dark:bg-zinc-900">Semana</th>
                 <th className="p-3 border-b border-r border-gray-300 dark:border-zinc-700 sticky left-32 z-30 bg-white dark:bg-zinc-900 text-center">Ação</th>
                 
                 {units.map((unit) => (
                   <React.Fragment key={unit}>
                     <th className="p-3 border-b border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">Serviços</th>
                     <th className="p-3 border-b border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">Produtos</th>
                     <th className="p-3 border-b border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[#f97316]">Assin.</th>
                     <th className="p-3 border-b border-r border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 bg-gray-100 dark:bg-zinc-800">SVA</th>
                   </React.Fragment>
                 ))}

                 <th className="p-3 border-b border-r border-amber-700/50 text-gray-900 dark:text-zinc-100 bg-amber-900/40">SVA Total</th>
                 <th className="p-3 border-b border-amber-700/50 text-gray-900 dark:text-zinc-100 bg-amber-900/40">Recorrências</th>
               </tr>
             </thead>
             <tbody>
               {reportData.map((dayData, idx) => {
                 const isWeekend = dayData.weekday === 'Domingo' || dayData.weekday === 'Sábado';
                 return (
                 <tr key={idx} className={`border-b border-gray-200 dark:border-zinc-800 transition-colors ${isWeekend ? 'bg-orange-50/40' : 'bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100'} hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300`}>
                   <td className="p-2.5 px-3 border-r font-medium text-gray-900 dark:text-zinc-100 sticky left-0 z-30 bg-inherit shadow-[1px_0_0_0_#f3f4f6]">
                     {String(idx + 1).padStart(2, '0')}
                   </td>
                   <td className={`p-2.5 px-3 border-r font-medium sticky left-12 z-30 bg-inherit shadow-[1px_0_0_0_#f3f4f6] ${isWeekend ? 'text-orange-600' : 'text-gray-500 dark:text-zinc-400'}`}>
                     {dayData.weekday}
                   </td>
                   <td className="p-1 border-r text-center sticky left-32 z-30 bg-inherit shadow-[1px_0_0_0_#f3f4f6] w-[40px]">
                     <button
                       onClick={() => openEditModal(dayData)} 
                       className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-amber-500 hover:bg-amber-900/20 rounded transition-colors mx-auto"
                     >
                       <Edit2 className="w-4 h-4" />
                     </button>
                   </td>

                   {units.map((unit) => {
                     const uData = dayData.units[unit];
                     return (
                       <React.Fragment key={unit}>
                         <td className="p-2.5 px-3 font-mono text-gray-500 dark:text-zinc-400">{formatCurrency(uData.servicos)}</td>
                         <td className="p-2.5 px-3 font-mono text-gray-500 dark:text-zinc-400">{formatCurrency(uData.produtos)}</td>
                         <td className="p-2.5 px-3 font-mono text-gray-500 dark:text-zinc-400">{formatCurrency(uData.assinaturas)}</td>
                         <td className="p-2.5 px-3 border-r font-mono font-bold text-gray-900 dark:text-zinc-100 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300">{formatCurrency(uData.total)}</td>
                       </React.Fragment>
                     );
                   })}

                   <td className="p-2.5 px-3 font-mono font-bold text-gray-900 dark:text-zinc-100 bg-amber-900/20 border-r border-amber-700/50">{formatCurrency(dayData.svaTotal)}</td>
                   <td className="p-2.5 px-3 font-mono text-gray-500 dark:text-zinc-400 bg-amber-900/20">{formatCurrency(dayData.recorrencia)}</td>
                 </tr>
               )})}

               {/* Sum Row */}
               <tr className="bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-bold sticky bottom-0 z-30 shadow-[0_-1px_0_0_#27272a]">
                 <td colSpan={3} className="p-3 border-r border-gray-300 dark:border-zinc-700 sticky left-0 z-30 bg-gray-50 border-gray-200 dark:bg-zinc-950">
                    TOTAL DO MÊS
                 </td>
                 {units.map((unit) => {
                     const uData = monthlyTotals.units[unit];
                     return (
                       <React.Fragment key={unit}>
                         <td className="p-3 font-mono">{formatCurrency(uData.servicos)}</td>
                         <td className="p-3 font-mono">{formatCurrency(uData.produtos)}</td>
                         <td className="p-3 font-mono">{formatCurrency(uData.assinaturas)}</td>
                         <td className="p-3 border-r border-gray-300 dark:border-zinc-700 font-mono text-[var(--theme-color)]">{formatCurrency(uData.total)}</td>
                       </React.Fragment>
                     );
                 })}
                 <td className="p-3 font-mono text-gray-900 dark:text-zinc-100 font-black text-lg bg-amber-900/40 border-r border-amber-700/50">{formatCurrency(monthlyTotals.svaTotal)}</td>
                 <td className="p-3 font-mono text-gray-900 dark:text-zinc-100 font-black text-lg bg-amber-900/40">{formatCurrency(monthlyTotals.recorrenciaTotal)}</td>
               </tr>
             </tbody>
           </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingDay && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300">
              <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-zinc-100">
                Lançamento SVA - {editingDay.date.split('-').reverse().join('/')}
              </h2>
              <button 
                onClick={() => setEditingDay(null)}
                className="p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[80vh] overflow-y-auto space-y-8">
              {units.map((unit, idx) => (
                <div key={unit} className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-zinc-200 text-sm uppercase tracking-wider">{getUnitName(unit)}</h3>
                    <label className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
                      <input 
                        type="checkbox" 
                        checked={editingDay.units[unit].isNonWorkingDay || false} 
                        onChange={(e) => {
                          const n = { ...editingDay };
                          n.units[unit].isNonWorkingDay = e.target.checked;
                          if (e.target.checked) {
                            n.units[unit].servicos = 0;
                            n.units[unit].produtos = 0;
                            }
                          setEditingDay(n);
                        }}
                        className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 dark:bg-zinc-800 dark:border-zinc-600 outline-none"
                      />
                      <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase">Dia não útil</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`transition-opacity ${editingDay.units[unit].isNonWorkingDay ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-2 uppercase">Serviços R$</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingDay.units[unit].servicos || ''}
                        onChange={e => {
                          const n = { ...editingDay };
                          n.units[unit].servicos = e.target.value;
                          setEditingDay(n);
                        }}
                        className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono shadow-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div className={`transition-opacity ${editingDay.units[unit].isNonWorkingDay ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-2 uppercase">Produtos R$</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingDay.units[unit].produtos || ''}
                        onChange={e => {
                          const n = { ...editingDay };
                          n.units[unit].produtos = e.target.value;
                          setEditingDay(n);
                        }}
                        className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono shadow-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-2 uppercase">Nova Assin. R$</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingDay.units[unit].assinaturas || ''}
                        onChange={e => {
                          const n = { ...editingDay };
                          n.units[unit].assinaturas = e.target.value;
                          setEditingDay(n);
                        }}
                        className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono shadow-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}

            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingDay(null)}
                className="px-6 py-2.5 text-gray-500 dark:text-zinc-400 font-semibold hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveModal}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 active:scale-95 transition-all text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Valores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {editingSettings && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-600 dark:text-zinc-300">
              <h2 className="text-xl font-bold font-sans text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                <Settings className="w-6 h-6 text-amber-500" />
                Configurar Objetivos - {MONTH_NAMES[month]} {year}
              </h2>
              <button 
                onClick={() => setEditingSettings(null)}
                className="p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-amber-900/20 p-5 rounded-2xl border border-amber-800/40">
                <label className="block text-sm font-bold text-amber-900 dark:text-amber-100 mb-2 uppercase">Objetivo Geral (Mensal) SVA - R$</label>
                <input type="number" 
                  min="0"
                  step="0.01"
                  value={editingSettings.metaGeral || ''}
                  onChange={e => {
                    setEditingSettings({ ...editingSettings, metaGeral: Number(e.target.value) });
                  }}
                  className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 w-full max-w-sm px-4 py-2.5 rounded-xl border border-amber-600 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono shadow-sm"
                  placeholder="0.00"
                />
              </div>

              {units.map((unit, idx) => (
                <div key={unit} className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800">
                  <h3 className="font-bold text-gray-700 dark:text-zinc-200 mb-4 text-sm uppercase tracking-wider border-b border-gray-200 dark:border-zinc-800 pb-2">{getUnitName(unit)}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase hidden md:block">Quinzenal</h4>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">Objetivo Quinzenal R$</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingSettings.units[unit]?.metaQuinzenal || ''}
                          onChange={e => {
                            const n = { ...editingSettings };
                            if (!n.units[unit]) n.units[unit] = { metaQuinzenal:0, metaMensal:0, diasNaoUteisQuinzenal:0, diasNaoUteisMensal:0 };
                            n.units[unit].metaQuinzenal = Number(e.target.value);
                            setEditingSettings(n);
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-lg border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono"
                        />
                      </div>
                      
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-500 dark:text-zinc-400 text-xs uppercase hidden md:block">Mensal</h4>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 mb-1">Objetivo Mensal R$</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingSettings.units[unit]?.metaMensal || ''}
                          onChange={e => {
                            const n = { ...editingSettings };
                            if (!n.units[unit]) n.units[unit] = { metaQuinzenal:0, metaMensal:0, diasNaoUteisQuinzenal:0, diasNaoUteisMensal:0 };
                            n.units[unit].metaMensal = Number(e.target.value);
                            setEditingSettings(n);
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-lg border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono"
                        />
                      </div>
                      
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setEditingSettings(null)}
                className="px-6 py-2.5 text-gray-500 dark:text-zinc-400 font-semibold hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 active:scale-95 transition-all text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Objetivos
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Unit Charts Modal */}
      {showUnitChartsModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex-shrink-0">
              <h2 className="text-xl font-bold font-sans flex items-center gap-2 text-gray-900 dark:text-zinc-100">
                <TrendingUp className="w-6 h-6 text-amber-500" />
                Evolução Diária - Por Unidade
              </h2>
              <button 
                onClick={() => setShowUnitChartsModal(false)}
                className="p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:bg-zinc-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 bg-gray-100/50 dark:bg-zinc-900/30">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {units.map((unit, idx) => (
                  <div key={unit} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-bold text-gray-700 dark:text-zinc-200 uppercase tracking-wide">
                        {getUnitName(unit)}
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-600"></div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">SVA Total</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Recorrências</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={reportData.map(d => ({ day: d.date.split('-')[2], SVA: d.units[unit]?.total || 0, Recorrencia: d.units[unit]?.assinaturas || 0 }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                           <defs>
                             <linearGradient id={`colorSVA-${unit.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#d18e24" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#d18e24" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id={`colorRec-${unit.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-zinc-800" vertical={false} />
                           <XAxis dataKey="day" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                           <YAxis 
                             stroke="#a1a1aa" 
                             fontSize={10} 
                             tickLine={false} 
                             axisLine={false} 
                             tickFormatter={(val) => val >= 1000 ? `R$ ${(val/1000).toFixed(0)}k` : `R$ ${val}`} 
                             width={50}
                           />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                             itemStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                             formatter={(value: number) => [`R$ ${value.toFixed(2)}`, undefined]}
                             labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                           />
                           <Area type="monotone" dataKey="SVA" stroke="#d18e24" strokeWidth={3} fillOpacity={1} fill={`url(#colorSVA-${unit.replace(/\s+/g, '-')})`} activeDot={{ r: 5, fill: '#d18e24', stroke: '#fff', strokeWidth: 2 }} />
                           <Area type="monotone" dataKey="Recorrencia" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill={`url(#colorRec-${unit.replace(/\s+/g, '-')})`} activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

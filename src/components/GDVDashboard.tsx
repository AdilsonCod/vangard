import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, TrendingUp, Calendar, AlertCircle, Edit2, X, Save, Settings } from 'lucide-react';
import { GDVEntry, GDVUnitData, GDVSettings } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { AppPageHeader } from './ui/AppPrimitives';
import { SVAOverview } from './SVAOverview';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function GDVDashboard() {
  const { gdvEntries, users, updateGDVEntry, gdvSettings, updateGDVSettings, systemUnits } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  
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
      dayData.faturamentoTotal = dayData.svaTotal;

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
    setSaveError('');
    // Clone currentsettings to avoid mutate
    setEditingSettings(JSON.parse(JSON.stringify(currentSettings)));
  };

  const handleSaveSettings = async () => {
    if (!editingSettings || saving) return;
    setSaveError('');
    setSaving(true);
    try {
      await updateGDVSettings(editingSettings);
      setEditingSettings(null);
    } catch { setSaveError('Não foi possível salvar as metas. Tente novamente.'); }
    finally { setSaving(false); }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const openEditModal = (dayData: any) => {
    setSaveError('');
    setEditingDay(JSON.parse(JSON.stringify(dayData)));
  };

  const handleSaveModal = async () => {
    if (!editingDay || saving) return;
    
    const entry: GDVEntry = {
      id: editingDay.date,
      date: editingDay.date,
      units: { ...(gdvEntries.find(item => item.id === editingDay.date)?.units || {}) },
      recorrencia: Number(editingDay.recorrencia) || 0
    };

    units.filter(u => selectedUnit === 'ALL' || u === selectedUnit).forEach(u => {
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

    if (Object.values(entry.units).some(data => [data.servicos, data.produtos, data.assinaturas].some(value => value !== null && (!Number.isFinite(value) || value < 0)))) {
      setSaveError('Informe valores válidos e não negativos.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await updateGDVEntry(entry);
      setEditingDay(null);
    } catch { setSaveError('Não foi possível salvar os valores. Tente novamente.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SVAOverview days={reportData} units={units} settings={currentSettings} unit={selectedUnit} setUnit={setSelectedUnit} unitName={getUnitName} date={currentDate} setDate={setCurrentDate} edit={openEditModal} adjust={openSettingsModal} />

      {/* Edit Modal */}
      {editingDay && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 border-gray-200 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
            
            <div className="p-4 sm:p-6 min-h-0 overflow-y-auto space-y-8">
              {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
              {units.filter(unit => selectedUnit === 'ALL' || unit === selectedUnit).map((unit, idx) => (
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
                        value={editingDay.units[unit].servicos ?? ''}
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
                        value={editingDay.units[unit].produtos ?? ''}
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
                        value={editingDay.units[unit].assinaturas ?? ''}
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
                disabled={saving}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 active:scale-95 transition-all text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando…' : 'Salvar Valores'}
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
              {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
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
                disabled={saving}
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
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--theme-color)]"></div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Recorrências</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={reportData.map(d => ({ day: d.date.split('-')[2], SVA: d.units[unit]?.total || 0, Recorrencia: d.units[unit]?.assinaturas || 0 }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                           <defs>
                             <linearGradient id={`colorSVA-${unit.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="var(--theme-color-strong)" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="var(--theme-color-strong)" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id={`colorRec-${unit.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="var(--theme-color)" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="var(--theme-color)" stopOpacity={0}/>
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
                           <Area type="monotone" dataKey="SVA" stroke="var(--theme-color-strong)" strokeWidth={3} fillOpacity={1} fill={`url(#colorSVA-${unit.replace(/\s+/g, '-')})`} activeDot={{ r: 5, fill: 'var(--theme-color-strong)', stroke: '#fff', strokeWidth: 2 }} />
                           <Area type="monotone" dataKey="Recorrencia" stroke="var(--theme-color)" strokeWidth={3} fillOpacity={1} fill={`url(#colorRec-${unit.replace(/\s+/g, '-')})`} activeDot={{ r: 5, fill: 'var(--theme-color)', stroke: '#fff', strokeWidth: 2 }} />
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
  );
}

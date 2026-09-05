import React, { useState } from 'react';
import { Scissors, ShoppingBag, Crown, Plus, Edit2, Download } from 'lucide-react';
import { GDVSettings } from '../types';
import { appControlClass } from './ui/AppPrimitives';

type Day = { date: string; units: Record<string, { servicos: number | null; produtos: number | null; assinaturas: number | null; isNonWorkingDay: boolean; isFilled: boolean }> };
export function SVAOverview({ days, units, settings, unit, setUnit, unitName, date, setDate, edit, adjust }: {
  days: Day[]; units: string[]; settings: GDVSettings; unit: string; setUnit: (unit: string) => void; unitName: (unit: string) => string;
  date: Date; setDate: (date: Date) => void; edit: (day: Day) => void; adjust: () => void;
}) {
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [dayChoice, chooseDay] = useState('');
  const activeDate = dayChoice.startsWith(period) ? dayChoice : today.startsWith(period) ? today : days.at(-1)?.date;
  const scope = unit === 'ALL' ? units : units.filter(id => id === unit);
  const schedules = scope.map(id => {
    const closed = days.filter(day => day.units[id]?.isNonWorkingDay).length;
    const plannedClosed = Math.max(closed, settings.units[id]?.diasNaoUteisMensal || 0);
    const workdays = Math.max(0, days.length - plannedClosed);
    const passed = days.filter(day => day.date <= today && !day.units[id]?.isNonWorkingDay).length;
    return { id, workdays, passed: Math.min(workdays, passed), daily: workdays > 0 ? (settings.units[id]?.metaMensal || 0) / workdays : 0 };
  });
  const unitGoal = scope.reduce((sum, id) => sum + (settings.units[id]?.metaMensal || 0), 0);
  const goal = unit === 'ALL' && settings.metaGeral > 0 ? settings.metaGeral : unitGoal;
  const scale = unitGoal > 0 ? goal / unitGoal : 1;
  const elapsed = days.filter(day => day.date <= today).length;
  const expected = unitGoal > 0 ? schedules.reduce((sum, item) => sum + item.daily * item.passed, 0) * scale : goal * elapsed / Math.max(1, days.length);
  const rows = days.map(day => {
    const records = scope.map(id => day.units[id]).filter(Boolean);
    const services = records.reduce((sum, item) => sum + (item.servicos || 0), 0);
    const products = records.reduce((sum, item) => sum + (item.produtos || 0), 0);
    const subscriptions = records.reduce((sum, item) => sum + (item.assinaturas || 0), 0);
    const filled = records.some(item => item.servicos != null || item.produtos != null || item.assinaturas != null);
    const closed = records.length > 0 && records.every(item => item.isNonWorkingDay);
    const dailyGoal = closed ? 0 : unitGoal > 0 ? schedules.reduce((sum, item) => sum + (day.units[item.id]?.isNonWorkingDay ? 0 : item.daily), 0) * scale : goal / Math.max(1, days.length);
    return { day, services, products, subscriptions, total: services + products + subscriptions, filled, closed, complete: records.length > 0 && records.every(item => item.isFilled || item.isNonWorkingDay), dailyGoal };
  });
  const active = rows.find(row => row.day.date === activeDate) || rows[0];
  const realized = rows.reduce((sum, row) => sum + row.total, 0);
  const realizedToDate = rows.filter(row => row.day.date <= today).reduce((sum, row) => sum + row.total, 0);
  const difference = realizedToDate - expected;
  const remainingDays = schedules.length ? Math.max(...schedules.map(item => Math.max(0, item.workdays - item.passed))) : 0;
  const remaining = Math.max(0, goal - realizedToDate);
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const panel = 'app-themed-panel min-w-0 rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';
  const max = Math.max(1, ...rows.map(row => Math.max(row.total, row.dailyGoal)));
  const exportRows = () => {
    const csv = [['Data', 'Serviços', 'Produtos', 'Assinaturas', 'Total', 'Meta diária', 'Situação'], ...rows.map(row => [row.day.date, ...[row.services, row.products, row.subscriptions, row.total, row.dailyGoal].map(value => value.toFixed(2).replace('.', ',')), row.closed ? 'Fechado' : !row.filled ? 'Sem lançamento' : row.complete ? 'Completo' : 'Parcial'])].map(row => row.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `SVA-${period}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-4 text-gray-950 dark:text-zinc-100">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div><h1 className="text-2xl font-black">SVA • Faturamento e metas</h1><p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Acompanhe o dia e mantenha o mês no ritmo.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Unidade do SVA" value={unit} onChange={event => setUnit(event.target.value)} className={appControlClass}><option value="ALL">Todas as unidades</option>{units.map(id => <option key={id} value={id}>{unitName(id)}</option>)}</select>
        <input type="month" aria-label="Período do SVA" value={period} onChange={event => { if (event.target.value) { const [year, month] = event.target.value.split('-').map(Number); setDate(new Date(year, month - 1, 1)); } }} className={appControlClass} />
        <button disabled={!active || !scope.length} onClick={() => active && edit(active.day)} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--theme-color)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={18} />Lançar faturamento</button>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-3"><h2 className="font-bold">Resultado do dia</h2><input type="date" aria-label="Dia do resultado" min={`${period}-01`} max={days.at(-1)?.date} value={active?.day.date || ''} onChange={event => { if (rows.some(row => row.day.date === event.target.value)) chooseDay(event.target.value); }} className={appControlClass} /></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={panel}><p className="text-sm text-gray-600 dark:text-zinc-400">Faturamento total</p><p className="mt-2 text-2xl font-black">{active?.filled ? money(active.total) : active?.closed ? 'Fechado' : 'Sem lançamento'}</p><p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">Meta diária: {active?.dailyGoal ? money(active.dailyGoal) : 'Não definida'}</p>{active?.filled && <p className="mt-2 text-sm">{active.dailyGoal > 0 ? `${(active.total / active.dailyGoal * 100).toFixed(0)}% da meta` : 'Meta não definida'}{!active.complete ? ' · parcial' : ''}</p>}</div>
      {([{ label: 'Serviços', value: active?.services, icon: Scissors, color: 'text-[#2563eb] dark:text-[#60a5fa]' }, { label: 'Produtos', value: active?.products, icon: ShoppingBag, color: 'text-[#9333ea] dark:text-[#c084fc]' }, { label: 'Assinaturas', value: active?.subscriptions, icon: Crown, color: 'text-teal-600 dark:text-teal-400' }]).map(card => <div key={card.label} className={panel}><div className={`flex items-center gap-3 ${card.color}`}><card.icon size={24} /><span className="text-sm font-semibold">{card.label}</span></div><p className="mt-3 text-2xl font-black">{active?.filled ? money(card.value || 0) : '—'}</p></div>)}
    </div>
    <section className={panel}><h2 className="font-bold">Progresso do mês</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{[['Realizado no mês', realized], ['Esperado até hoje', expected], ['Meta do mês', goal]].map(([label, value]) => <div key={label}><p className="text-sm text-gray-600 dark:text-zinc-400">{label}</p><p className="mt-1 text-xl font-bold">{money(Number(value))}</p></div>)}</div>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative h-3 flex-1 rounded-full bg-gray-200 dark:bg-zinc-700"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${goal > 0 ? Math.min(100, realized / goal * 100) : 0}%` }} /><span title="Esperado até hoje" className="absolute -top-1 h-5 border-l-2 border-dashed border-amber-500" style={{ left: `${goal > 0 ? Math.min(100, expected / goal * 100) : 0}%` }} /></div><p className="text-sm">{goal > 0 ? `${money(Math.abs(difference))} ${difference >= 0 ? 'acima' : 'abaixo'} do esperado até hoje` : 'Defina a meta do período'}</p></div>
      <p className="mt-3 text-xs text-gray-600 dark:text-zinc-400">{goal > 0 ? `${(realized / goal * 100).toFixed(1)}% realizado · ${(expected / goal * 100).toFixed(1)}% esperado` : 'Sem meta cadastrada'} · Ritmo estimado pelas metas e dias não úteis cadastrados; marque as datas fechadas nos lançamentos para refinar o calendário.</p>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <section className={panel}><h2 className="font-bold">Evolução diária</h2><p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">Toque em uma barra para conferir o dia · escala até {money(max)}</p><div className="mt-5 grid h-48 items-end gap-0.5 border-b border-gray-300 dark:border-zinc-700" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>{rows.map(row => <button key={row.day.date} aria-label={`${row.day.date}: ${row.filled ? money(row.total) : 'sem lançamento'}`} onClick={() => { chooseDay(row.day.date); edit(row.day); }} className="relative flex h-full min-w-0 flex-col justify-end rounded-t outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--theme-color)]" title={`${row.day.date}: ${money(row.total)}`}>
        <span className="absolute w-full border-t border-dashed border-gray-600 dark:border-zinc-300" style={{ bottom: `${row.dailyGoal / max * 100}%` }} />
        <span className="w-full bg-teal-500" style={{ height: `${row.subscriptions / max * 100}%` }} /><span className="w-full bg-[#a855f7]" style={{ height: `${row.products / max * 100}%` }} /><span className="w-full bg-[#3b82f6]" style={{ height: `${row.services / max * 100}%` }} />
      </button>)}</div><div className="mt-1 flex justify-between text-xs text-gray-600 dark:text-zinc-400"><span>01/{period.slice(5)}</span><span>15/{period.slice(5)}</span><span>{days.length}/{period.slice(5)}</span></div><div className="mt-4 flex flex-wrap gap-3 text-xs"><span className="text-[#2563eb] dark:text-[#60a5fa]">● Serviços</span><span className="text-[#9333ea] dark:text-[#c084fc]">● Produtos</span><span className="text-teal-600 dark:text-teal-400">● Assinaturas</span><span>┄ Meta diária</span></div></section>
      <section className={panel}><h2 className="font-bold">Ritmo necessário</h2><p className="mt-4 text-sm text-gray-600 dark:text-zinc-400">Faltam</p><p className="text-2xl font-black">{goal > 0 ? money(remaining) : 'Meta não definida'}</p><p className="my-4 border-y border-gray-200 py-4 text-sm dark:border-zinc-700">{remainingDays} dias estimados de funcionamento restantes{unit === 'ALL' ? ' · maior calendário das unidades' : ''}</p><p className="text-2xl font-black">{goal > 0 && remainingDays > 0 ? money(remaining / remainingDays) : '—'}</p><p className="text-sm text-gray-600 dark:text-zinc-400">por dia após hoje</p><button onClick={adjust} className={`${appControlClass} mt-4 w-full`}>Ajustar metas</button></section>
    </div>
    <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Lançamentos do período</h2><button onClick={exportRows} className={`${appControlClass} flex items-center gap-2`}><Download size={16} />Exportar</button></div><div className="space-y-2">{rows.filter(row => row.day.date <= today || row.filled || row.closed).slice().reverse().map(row => <button key={row.day.date} onClick={() => { chooseDay(row.day.date); edit(row.day); }} className="grid w-full grid-cols-2 gap-2 rounded-xl border border-gray-200 p-3 text-left text-sm hover:border-[var(--theme-color)] dark:border-zinc-800 sm:grid-cols-6">
      <strong>{row.day.date.slice(8)}/{period.slice(5)}</strong><span><small className="block text-gray-600 dark:text-zinc-400">Serviços</small>{row.filled ? money(row.services) : '—'}</span><span><small className="block text-gray-600 dark:text-zinc-400">Produtos</small>{row.filled ? money(row.products) : '—'}</span><span><small className="block text-gray-600 dark:text-zinc-400">Assinaturas</small>{row.filled ? money(row.subscriptions) : '—'}</span><strong><small className="block font-normal text-gray-600 dark:text-zinc-400">Total</small>{row.filled ? money(row.total) : '—'}</strong><span className="flex items-center justify-between gap-2">{row.closed ? 'Fechado' : !row.filled ? 'Sem lançamento' : !row.complete ? 'Parcial' : row.dailyGoal > 0 ? `${(row.total / row.dailyGoal * 100).toFixed(0)}% da meta` : 'Sem meta'}<Edit2 size={16} className="shrink-0" /></span>
    </button>)}</div></section>
    <p className="text-xs text-gray-600 dark:text-zinc-400">Assinaturas: faturamento do dia. Recebimentos D+31 são acompanhados no Financeiro.</p>
  </div>;
}

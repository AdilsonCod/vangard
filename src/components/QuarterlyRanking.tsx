import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useStore } from '../store';
import { calculateQuarterlyRanking } from '../utils/quarterlyRanking';
import { appControlClass } from './ui/AppPrimitives';

export function QuarterlyRanking({ year, month, unit = 'ALL', management = false }: { year: number; month: number; unit?: string; management?: boolean }) {
  const { currentUser, users, monthlyBarberStats, quarterlyRankingVisible, setQuarterlyRankingVisible } = useStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { quarter, months, ranking } = useMemo(() => calculateQuarterlyRanking(monthlyBarberStats, users, year, month, unit), [monthlyBarberStats, users, year, month, unit]);
  const canManage = management && currentUser?.role === 'ADMIN';
  if (!management && quarterlyRankingVisible !== true) return null;
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const toggle = async () => {
    setSaving(true);
    setMessage('');
    try {
      await setQuarterlyRankingVisible(!quarterlyRankingVisible);
      setMessage(quarterlyRankingVisible ? 'Ranking ocultado para os barbeiros.' : 'Ranking liberado para os barbeiros.');
    } catch {
      setMessage('Não foi possível salvar a visibilidade. Tente novamente.');
    } finally { setSaving(false); }
  };
  return <section className="app-themed-panel min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-black text-gray-950 dark:text-zinc-100"><Trophy className="h-5 w-5 shrink-0 text-amber-500" />Melhores do {quarter}º trimestre de {year}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{months[0].slice(5)}/{year} a {months[2].slice(5)}/{year} · {unit === 'ALL' ? 'Todas as unidades' : 'Unidade selecionada'}</p>
      </div>
      {canManage && <button type="button" onClick={toggle} disabled={saving || quarterlyRankingVisible === null} aria-pressed={quarterlyRankingVisible === false} className={appControlClass}>
        {saving ? 'Salvando…' : quarterlyRankingVisible === null ? 'Aguardando configuração…' : quarterlyRankingVisible ? 'Ocultar para barbeiros' : 'Mostrar para barbeiros'}
      </button>}
    </div>
    {management && <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">Visibilidade para profissionais: {quarterlyRankingVisible === null ? 'indisponível no momento' : quarterlyRankingVisible ? 'visível' : 'oculto'}. Esta opção vale para todos os trimestres e unidades.</p>}
    {message && <p role="status" className="mt-2 text-sm text-gray-700 dark:text-zinc-300">{message}</p>}
    {ranking.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-600 dark:border-zinc-700 dark:text-zinc-400">Sem dados consolidados no trimestre.</p> : <ol className="mt-4 space-y-2">
      {ranking.map((row, index) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800">
        <div className="min-w-0"><p className="break-words font-bold text-gray-900 dark:text-zinc-100">{index + 1}º · {row.name}{row.id === currentUser?.id ? ' (você)' : ''}</p><p className="mt-1 text-xs text-gray-600 dark:text-zinc-300">Faturamento {money(row.revenue)} · Produtos {money(row.products)} · Ticket {money(row.ticket)}</p></div>
        <strong className="shrink-0 text-sm text-[var(--theme-color)]">{row.score.toFixed(1).replace('.', ',')} pts</strong>
      </li>)}
    </ol>}
    <details className="mt-4 text-sm text-gray-600 dark:text-zinc-400"><summary className="cursor-pointer font-semibold">Critérios do ranking</summary><p className="mt-2 leading-relaxed">Soma dos consolidados mensais dos três meses. Faturamento, venda de produtos em reais e ticket médio têm o mesmo peso: até 100 pontos cada, em relação ao maior resultado do grupo. Ticket médio = faturamento total ÷ clientes. São exibidos os cinco primeiros; empates são ordenados pelo nome.</p></details>
  </section>;
}

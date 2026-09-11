import { useMemo, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import { useStore } from '../store';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './ui/Pagination';

const actionLabels: Record<string, string> = {
  CREATED: 'Criado', UPDATED: 'Alterado', DELETED: 'Excluído', CLOSED: 'Fechado',
  REOPENED: 'Reaberto', IMPORTED: 'Importado', CALCULATED: 'Calculado', TRANSFERRED: 'Transferido',
};
const entityLabels: Record<string, string> = {
  TRANSACTION: 'Lançamento', PAYMENT: 'Pagamento', RECONCILIATION: 'Conciliação',
  IMPORT: 'Importação', COMMISSION: 'Comissão', CASH_CLOSING: 'Fechamento de caixa',
};

export default function FinancialAuditTrail() {
  const { financialAuditEvents, systemUnits, users } = useStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [unitId, setUnitId] = useState('ALL');
  const [actorId, setActorId] = useState('ALL');

  const events = useMemo(() => financialAuditEvents
    .filter(event => unitId === 'ALL' || event.unitId === unitId)
    .filter(event => actorId === 'ALL' || event.actorId === actorId)
    .filter(event => !from || event.occurredOn >= from)
    .filter(event => !to || event.occurredOn <= to)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  [financialAuditEvents, from, to, unitId, actorId]);

  const { currentData, currentPage, totalPages, goToPage, totalItems } = usePagination(events);

  const actors = useMemo(() => Array.from(new Map(financialAuditEvents.map(event => [event.actorId, event.actorName])).entries()), [financialAuditEvents]);
  const unitName = (id: string) => systemUnits.find(unit => unit.id === id)?.name || id;
  const actorName = (id: string, fallback: string) => users.find(user => user.id === id || user.authUid === id)?.name || fallback;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[var(--app-accent-soft)] p-3 text-[var(--app-accent)]"><ClipboardList size={22} /></span>
          <div><p className="text-xs font-black uppercase tracking-widest text-[var(--app-accent)]">Financeiro</p><h1 className="text-2xl font-black">Trilha de auditoria</h1><p className="text-sm text-zinc-500">Histórico imutável das operações financeiras críticas.</p></div>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-bold text-zinc-500">De<input aria-label="Data inicial" type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700" /></label>
          <label className="text-xs font-bold text-zinc-500">Até<input aria-label="Data final" type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700" /></label>
          <label className="text-xs font-bold text-zinc-500">Unidade<select value={unitId} onChange={e => setUnitId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"><option value="ALL">Todas as unidades</option>{systemUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          <label className="text-xs font-bold text-zinc-500">Usuário<select value={actorId} onChange={e => setActorId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"><option value="ALL">Todos os usuários</option>{actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-black">Eventos registrados</h2><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-800">{events.length}</span></div>
        {events.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-zinc-500"><Search size={28} /><p className="font-bold">Nenhum evento encontrado</p><p className="text-sm">Ajuste os filtros ou realize uma operação financeira.</p></div> : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{currentData.map(event => (
            <details key={event.id} className="group p-4">
              <summary className="grid cursor-pointer list-none gap-2 sm:grid-cols-[140px_1fr_1fr_1fr] sm:items-center">
                <time className="text-xs text-zinc-500">{new Date(event.createdAt).toLocaleString('pt-BR')}</time>
                <span className="font-bold">{entityLabels[event.entityType]} · {actionLabels[event.action]}</span>
                <span className="text-sm text-zinc-500">{unitName(event.unitId)}</span>
                <span className="text-sm text-zinc-500">{actorName(event.actorId, event.actorName)}</span>
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <pre className="max-h-72 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-950">Antes{`\n`}{JSON.stringify(event.previousValue ?? null, null, 2)}</pre>
                <pre className="max-h-72 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-950">Depois{`\n`}{JSON.stringify(event.newValue ?? null, null, 2)}</pre>
              </div>
            </details>
          ))}</div>
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} />
      </section>
    </div>
  );
}

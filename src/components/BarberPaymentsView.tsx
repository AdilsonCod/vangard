import React, { useState } from 'react';
import { useStore } from '../store';
import { appControlClass, cn } from './ui/AppPrimitives';

export function BarberPaymentsView() {
  const { currentUser, payments } = useStore();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [period, setPeriod] = useState('');
  const money = (value: number = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateLabel = (date: string) => date?.split('-').reverse().join('/') || 'Data não informada';
  const statusOf = (payment: typeof payments[number]) => payment.status || (payment.isPaid ? 'PAGO' : 'PENDENTE');
  const mine = payments.filter(payment => payment.userId === currentUser?.id);
  const filtered = mine.filter(payment => (!period || payment.date.startsWith(period)) && (statusFilter === 'ALL' || statusOf(payment) === statusFilter))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = (status: 'open' | 'paid') => filtered.filter(payment => status === 'paid' ? statusOf(payment) === 'PAGO' : statusOf(payment) !== 'PAGO').reduce((sum, payment) => sum + (payment.amountToBePaid || 0), 0);
  const panel = 'app-themed-panel rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900';

  if (!currentUser) return null;
  return (
    <div className="space-y-5 text-gray-900 dark:text-zinc-100">
      <header>
        <p className="text-xs font-bold text-[var(--theme-color)]">Resultados</p>
        <h1 className="text-2xl font-black">Meus pagamentos</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Confira valores líquidos, comissões e descontos. Abra um pagamento para ver a composição.</p>
      </header>
      <div className={cn(panel, 'flex flex-wrap items-end gap-3')}>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">Período
          <input type="month" value={period} onChange={event => setPeriod(event.target.value)} className={cn(appControlClass, 'max-w-full')} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Situação
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={appControlClass}>
            <option value="ALL">Todos</option><option value="PENDENTE">Pendentes</option><option value="AGENDADO">Agendados</option><option value="PAGO">Pagos</option>
          </select>
        </label>
        <button onClick={() => { setPeriod(''); setStatusFilter('ALL'); }} className={appControlClass}>Limpar filtros</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={panel}><p className="text-sm text-gray-600 dark:text-zinc-400">Líquido em aberto · filtro atual</p><p className="mt-2 text-2xl font-black">{money(total('open'))}</p></div>
        <div className={panel}><p className="text-sm text-gray-600 dark:text-zinc-400">Líquido pago · filtro atual</p><p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400">{money(total('paid'))}</p></div>
      </div>
      {filtered.length === 0 && <p className={panel}>{mine.length ? 'Nenhum pagamento corresponde aos filtros.' : 'A gerência ainda não registrou pagamentos para você.'}</p>}
      <div className="space-y-3">
        {filtered.map(payment => {
          const status = statusOf(payment);
          const discounts = payment.discounts?.length ? payment.discounts : payment.discount > 0 ? [{ description: payment.discountDescription || 'Desconto', value: payment.discount }] : [];
          const commissions = [
            ['Serviços avulsos', payment.commissionAvulso || 0],
            ['Produtos gerais', payment.commissionProductGeneral || 0],
            ['Produtos Avant', payment.commissionProductAvant || 0],
            ['Assinaturas', payment.commissionSubscriptions || 0],
          ] as const;
          const gross = commissions.reduce((sum, [, value]) => sum + value, 0);
          const discountTotal = discounts.reduce((sum, discount) => sum + discount.value, 0);
          return <details key={payment.id} className={cn(panel, 'group')}>
            <summary className="cursor-pointer rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-color)]">
              <span className="ml-1 inline-flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 align-middle">
                <span className="text-sm font-bold">{status === 'PAGO' ? 'Pago' : 'Previsão'} · {dateLabel(payment.date)}</span>
                <span className={cn('rounded-full px-3 py-1 text-xs font-bold', status === 'PAGO' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300')}>{status === 'PAGO' ? 'Pago' : status === 'AGENDADO' ? 'Agendado' : 'Pendente'}</span>
                <strong className="text-xl">{money(payment.amountToBePaid)}</strong>
                <span className="text-xs text-gray-600 dark:text-zinc-400">Líquido · ver detalhes</span>
              </span>
            </summary>
            <div className="mt-4 grid gap-5 border-t border-gray-200 pt-4 dark:border-zinc-700 md:grid-cols-2">
              <section>
                <h2 className="mb-3 font-bold">Composição das comissões</h2>
                <dl className="space-y-2 text-sm">{commissions.map(([name, value]) => <div key={name} className="flex flex-wrap justify-between gap-2"><dt>{name}</dt><dd className="font-semibold">{money(value)}</dd></div>)}</dl>
                <p className="mt-3 flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3 font-bold dark:border-zinc-700"><span>Comissão bruta</span><span>{money(gross)}</span></p>
              </section>
              <section>
                <h2 className="mb-3 font-bold">Descontos e vales registrados</h2>
                {discounts.length ? <ul className="space-y-2 text-sm">{discounts.map((discount, index) => <li key={index} className="flex justify-between gap-3"><span className="min-w-0 break-words">{discount.description || 'Sem descrição'}</span><strong className="shrink-0 text-red-700 dark:text-red-400">− {money(discount.value)}</strong></li>)}</ul> : <p className="text-sm text-gray-600 dark:text-zinc-400">Nenhum desconto informado.</p>}
                <p className="mt-3 text-sm">Total de descontos: <strong>{money(discountTotal)}</strong></p>
                <p className="mt-2 text-sm">Valor líquido registrado: <strong>{money(payment.amountToBePaid)}</strong></p>
                {Math.abs(gross - discountTotal - payment.amountToBePaid) > 0.01 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">A composição difere do líquido registrado. Solicite à gerência a conferência dos ajustes.</p>}
              </section>
              <section className="min-w-0 md:col-span-2">
                <h2 className="font-bold">Participação nas assinaturas</h2>
                <p className="mt-2 text-sm">Participação no faturamento: {payment.potPercentage !== undefined ? `${payment.potPercentage}%` : 'Não informada'}</p>
                {payment.potData?.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{payment.potData.map(item => <li key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800"><strong>{item.name}</strong><p>{item.quantity} serviços · {item.tokens} fichas</p></li>)}</ul> : <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">Sem detalhamento de serviços e fichas neste pagamento.</p>}
              </section>
              <p className="text-xs leading-relaxed text-gray-600 dark:text-zinc-400 md:col-span-2">Valores e datas informados pela gerência. Comissão bruta = serviços + produtos + assinaturas; líquido calculado = comissão bruta − descontos. O valor a receber exibido é o líquido registrado no pagamento.</p>
            </div>
          </details>;
        })}
      </div>
    </div>
  );
}

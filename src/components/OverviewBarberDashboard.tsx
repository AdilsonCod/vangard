import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { appControlClass, cn } from './ui/AppPrimitives';
import { useProfessionalGoal } from './useProfessionalGoal';

export function OverviewBarberDashboard({ onNavigate }: { onNavigate: (page: 'AUTOGESTAO' | 'PAGAMENTOS' | 'METAS' | 'AVISOS') => void }) {
  const { currentUser, entries, catalog, monthlyBarberStats, announcements, payments } = useStore();
  const [goal] = useProfessionalGoal(currentUser?.id);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  
  const monthStr = `${selectedYear}-${selectedMonth}`;

  // Filter announcements for this user
  const relevantAnnouncements = useMemo(() => {
    return (announcements || [])
      .filter(a =>
        (a.unitId === 'ALL' || (currentUser?.unit && a.unitId === currentUser.unit)) &&
        (!a.targetRoles?.length || (!!currentUser && a.targetRoles.includes(currentUser.role)))
      )
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

  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const periodEntries = entries.filter(entry => entry.userId === currentUser?.id && entry.date.startsWith(monthStr));
  const periodStats = monthlyBarberStats?.find(stat => stat.barberId === currentUser?.id && stat.month === monthStr);
  const hasProduction = periodEntries.length > 0 || Boolean(periodStats);
  const myPayments = payments.filter(payment => payment.userId === currentUser?.id);
  const periodPayments = myPayments.filter(payment => payment.date.startsWith(monthStr));
  const isPaid = (payment: typeof myPayments[number]) => payment.status === 'PAGO' || (!payment.status && payment.isPaid);
  const nextPayment = myPayments.filter(payment => !isPaid(payment)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const commission = periodPayments.length
    ? periodPayments.reduce((sum, payment) => sum + (payment.commissionAvulso || 0) + (payment.commissionProductGeneral || 0) + (payment.commissionProductAvant || 0) + (payment.commissionSubscriptions || 0), 0)
    : periodStats?.comissao;
  const remaining = Math.max(0, goal - (commission ?? 0));
  const progress = goal > 0 && commission !== undefined ? Math.max(0, Math.min(100, commission / goal * 100)) : 0;
  const today = new Date();
  const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const calendarDays = monthStr < currentPeriod ? 0 : new Date(selectedYear, Number(selectedMonth), 0).getDate() - (monthStr === currentPeriod ? today.getDate() - 1 : 0);
  const [plannedDays, setPlannedDays] = useState<Record<string, number>>({});
  const daysLeft = plannedDays[monthStr] ?? calendarDays;
  const panel = 'app-themed-panel min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900';
  const dateLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Data não informada';

  return (
    <div className="space-y-5 text-gray-900 dark:text-zinc-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--theme-color)]">Painel profissional</p>
          <h1 className="text-2xl font-black">Meu desempenho</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Produção, pagamentos e próximos passos.</p>
        </div>
        <div className={cn(appControlClass, 'flex items-center justify-between p-0')}>
          <button onClick={handlePrevMonth} aria-label="Mês anterior" className="p-3"><ChevronLeft size={20} /></button>
          <span className="text-sm font-bold">{MONTH_NAMES[Number(selectedMonth) - 1]} {selectedYear}</span>
          <button onClick={handleNextMonth} aria-label="Próximo mês" className="p-3"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={panel}>
          <p className="text-sm text-gray-600 dark:text-zinc-400">Faturamento do período</p>
          <p className="mt-2 break-words text-2xl font-black">{hasProduction ? money(currentStats.faturamentoTotal) : 'Sem dados'}</p>
          <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">{hasProduction ? 'Avulso + assinaturas registrados' : 'Aguardando lançamentos ou importação'}</p>
        </div>
        <button onClick={() => onNavigate('PAGAMENTOS')} className={cn(panel, 'text-left transition hover:border-[var(--theme-color)]')}>
          <p className="text-sm text-gray-600 dark:text-zinc-400">Comissão prevista · bruta</p>
          <p className="mt-2 break-words text-2xl font-black text-emerald-700 dark:text-emerald-400">{commission !== undefined ? money(commission) : 'Ainda não informada'}</p>
          <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">Antes de descontos · conferir pagamentos →</p>
        </button>
        <button onClick={() => onNavigate('PAGAMENTOS')} className={cn(panel, 'text-left transition hover:border-[var(--theme-color)]')}>
          <p className="text-sm text-gray-600 dark:text-zinc-400">Próximo pagamento em aberto</p>
          <p className="mt-2 break-words text-2xl font-black">{nextPayment ? money(nextPayment.amountToBePaid) : 'Nenhum previsto'}</p>
          <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">{nextPayment ? `${dateLabel(nextPayment.date)} · valor líquido` : 'Considera todos os períodos'}</p>
        </button>
        <button onClick={() => onNavigate('AUTOGESTAO')} className={cn(panel, 'text-left transition hover:border-[var(--theme-color)]')}>
          <p className="text-sm text-gray-600 dark:text-zinc-400">Progresso da meta de comissão</p>
          <p className="mt-2 text-2xl font-black">{commission !== undefined && goal > 0 ? `${progress.toFixed(0)}%` : 'A definir'}</p>
          <progress aria-label="Progresso da meta de comissão" value={progress} max={100} className="mt-2 h-2 w-full accent-[var(--theme-color)]" />
          <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">Meta pessoal: {money(goal)} · ajustar →</p>
        </button>
      </div>

      <section className={panel}>
        <h2 className="text-lg font-bold">Seu próximo passo</h2>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm">{commission === undefined ? 'A comissão do período ainda não foi informada.' : remaining === 0 ? 'Meta de comissão atingida neste período!' : `Faltam ${money(remaining)} para atingir sua meta.`}</p>
            {commission !== undefined && remaining > 0 && <p className="font-bold text-[var(--theme-color)]">{daysLeft > 0 ? `Objetivo diário: ${money(remaining / daysLeft)} de comissão em ${daysLeft} dias planejados.` : 'Período encerrado ou sem dias planejados.'}</p>}
            <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
              Dias de trabalho restantes
              <input aria-label="Dias de trabalho restantes" type="number" min="0" max={calendarDays} value={daysLeft} onChange={event => setPlannedDays(previous => ({ ...previous, [monthStr]: Math.min(calendarDays, Math.max(0, Math.trunc(Number(event.target.value) || 0))) }))} className={cn(appControlClass, 'w-20')} />
            </label>
            <p className="text-xs text-gray-600 dark:text-zinc-400">Inicialmente considera os dias corridos restantes, incluindo hoje. Ajuste às suas folgas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigate('METAS')} className={cn(appControlClass, 'min-h-11')}>Registrar produção</button>
            <button onClick={() => onNavigate('AUTOGESTAO')} className={cn(appControlClass, 'min-h-11')}>Planejar minhas metas</button>
          </div>
        </div>
      </section>

      <details className={panel}>
        <summary className="cursor-pointer py-1 text-sm font-bold">Comunicados ({relevantAnnouncements.length}) · {relevantAnnouncements[0]?.title || 'Nenhum aviso disponível'}</summary>
        <div className="mt-4 space-y-3">
          {relevantAnnouncements.slice(0, 3).map(announcement => <article key={announcement.id} className="rounded-xl border border-gray-200 p-3 dark:border-zinc-700">
            <p className="font-bold">{announcement.title}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-zinc-300">{announcement.content}</p>
          </article>)}
          <button onClick={() => onNavigate('AVISOS')} className={appControlClass}>Ver todos os comunicados</button>
        </div>
      </details>

      <section className={panel}>
        <h2 className="text-lg font-bold">Indicadores da rotina</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ['Ticket médio', currentStats.clientesAtendidos > 0 ? money(currentStats.ticketMedio) : 'Sem base de clientes', 'Faturamento registrado dividido pelos clientes atendidos.'],
            ['Dias com venda de produtos', currentStats.workedDaysCount > 0 ? `${currentStats.penetrationProdutos.toFixed(1)}%` : 'Sem registros diários', 'Dias com produtos ÷ dias registrados de trabalho.'],
            ['Dias com serviços extras', currentStats.workedDaysCount > 0 ? `${currentStats.penetrationExtras.toFixed(1)}%` : 'Sem registros diários', 'Dias com extras ÷ dias registrados de trabalho.'],
          ].map(([label, value, explanation]) => <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-zinc-800">
            <p className="text-sm font-semibold">{label}</p><p className="mt-2 text-xl font-black">{value}</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{explanation}</p>
          </div>)}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: 'Faturamento registrado', rows: totalsData.map(row => ({ name: row.name, value: row.value, label: money(row.value) })) },
          { title: 'Serviços extras mais realizados', rows: extraServicesData.map(row => ({ name: row.name, value: row.quantity, label: `${row.quantity} un.` })) },
        ].map(chart => <section key={chart.title} className={panel}>
          <h2 className="text-lg font-bold">{chart.title}</h2>
          {!hasProduction ? <p className="mt-4 text-sm text-gray-600 dark:text-zinc-400">Ainda não há dados registrados no período.</p> : chart.rows.length === 0 ? <p className="mt-4 text-sm text-gray-600 dark:text-zinc-400">Nenhum serviço extra informado.</p> : <ul className="mt-4 space-y-4">{chart.rows.map(row => <li key={row.name}>
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span>{row.name}</span><strong>{row.label}</strong></div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[var(--theme-color)]" style={{ width: `${Math.max(0, row.value) / Math.max(1, ...chart.rows.map(item => item.value)) * 100}%` }} /></div>
          </li>)}</ul>}
        </section>)}
      </div>
      <details className={panel}>
        <summary className="cursor-pointer py-1 text-sm font-bold">Como estes números são calculados?</summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
          <p>Produção: soma dos lançamentos diários e do consolidado mensal do profissional. Registros que representem a mesma produção nas duas fontes precisam ser conferidos pela gerência.</p>
          <p>Comissão: soma bruta das comissões nos pagamentos datados no mês; quando não há pagamentos, usa a comissão do consolidado mensal. Não corresponde ao valor líquido após descontos.</p>
          <p>Próximo pagamento: primeiro registro em aberto por data, inclusive atrasados, considerando todos os meses. A data é a registrada pela gerência.</p>
          <p>Meta: preferência pessoal salva neste navegador. Projeção diária = comissão que falta ÷ dias planejados. É uma estimativa, não um pagamento confirmado.</p>
          <p>Fontes neste período: {periodEntries.length} lançamentos diários, {periodStats ? 1 : 0} consolidado mensal e {periodPayments.length} pagamentos. “Sem dados” significa ausência de registros; zero só é exibido quando existe uma base registrada.</p>
        </div>
      </details>
    </div>
  );
}

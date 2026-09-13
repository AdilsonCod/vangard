import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudDownload, Database, RefreshCw, Settings, ShieldCheck, WalletCards, X } from 'lucide-react';
import { authenticatedApi } from '../services/apiClient';
import { useStore } from '../store';
import type { FinancialTransaction } from '../types';
import { AppBadge, AppEmptyState, AppPageHeader, appControlClass } from './ui/AppPrimitives';

type ConnectionStatus = { configured: boolean; connected?: boolean; environment: 'sandbox' | 'production'; account?: string };
type ReportItem = { id: string; externalId: string; amount: number; dueDate: string; settledAt?: string; createdAt?: string; status: string; statusDescription: string; paymentMethod: string; customerName?: string; installment?: number };
type Report = { transactions: ReportItem[]; receivables: ReportItem[]; total: number; fetchedAt: string };
type SessionCredentials = { id: string; hash: string; environment: 'sandbox' | 'production' };

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function CelcoinIntegration() {
  const { addTransaction, transactions, systemUnits, currentUser } = useStore();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [unitId, setUnitId] = useState(currentUser?.unit || systemUnits[0]?.id || '');
  const [report, setReport] = useState<Report | null>(null);
  const [view, setView] = useState<'transactions' | 'receivables'>('transactions');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [credentials, setCredentials] = useState<SessionCredentials>({ id: '', hash: '', environment: 'production' });
  const [sessionCredentials, setSessionCredentials] = useState<SessionCredentials | undefined>();

  useEffect(() => {
    authenticatedApi.json<ConnectionStatus>('/api/celcoin?action=status').then(setConnection).catch(error => setMessage(error.message));
  }, []);

  const rows = report?.[view] || [];
  const total = useMemo(() => rows.reduce((sum, item) => sum + item.amount, 0), [rows]);

  const testConnection = async () => {
    setBusy(true); setMessage('');
    try {
      const selectedCredentials = credentials.id && credentials.hash ? credentials : sessionCredentials;
      const result = await authenticatedApi.json<ConnectionStatus>('/api/celcoin?action=test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: selectedCredentials }),
      });
      if (selectedCredentials) setSessionCredentials(selectedCredentials);
      setConnection(result); setMessage('Conexão autenticada com sucesso.');
      setCredentials(value => ({ ...value, hash: '' }));
      setShowConfiguration(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao testar a conexão.'); }
    finally { setBusy(false); }
  };

  const loadReport = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await authenticatedApi.json<Report>('/api/celcoin?action=transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, limit: 500, credentials: sessionCredentials }),
      });
      setReport(result); setMessage(`${result.total} transação(ões) carregada(s) da Celcoin.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar o relatório.'); }
    finally { setBusy(false); }
  };

  const syncForReconciliation = async () => {
    if (!unitId || !report) { setMessage('Selecione a unidade antes de sincronizar.'); return; }
    const known = new Set(transactions.map(item => item.id));
    const pending = report.transactions.filter(item => !known.has(item.id));
    setBusy(true); setMessage('');
    try {
      for (const item of pending) {
        const settled = Boolean(item.settledAt) || /paid|payed|captured|liquid|baixad/i.test(`${item.status} ${item.statusDescription}`);
        const transaction: FinancialTransaction = {
          id: item.id, type: 'INCOME', category: 'Recebimento Celcoin',
          description: `Celcoin · ${item.customerName || item.externalId}`,
          amount: item.amount, date: item.settledAt || item.dueDate, dueDate: item.dueDate, unitId,
          status: settled ? 'RECEBIDO' : 'PENDENTE', sourceChannel: 'SUBSCRIPTION_GATEWAY',
          paymentMethod: item.paymentMethod === 'PIX' ? 'PIX' : item.paymentMethod === 'CARTÃO' ? 'CREDIT' : 'SUBSCRIPTION',
          movementNature: 'REVENUE', reconciliationStatus: settled ? 'RECONCILED' : 'AWAITING_SETTLEMENT',
          sourceReference: item.externalId, clientName: item.customerName,
        };
        await addTransaction(transaction);
      }
      setMessage(`${pending.length} transação(ões) enviada(s) para as conciliações; ${report.transactions.length - pending.length} já existia(m).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao sincronizar as transações.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <AppPageHeader eyebrow="Integração financeira" title="Celcoin · Galax Pay" description="Consulte transações e previsão de recebíveis para usar nas conciliações." icon={<WalletCards className="h-6 w-6" />} actions={<button onClick={()=>setShowConfiguration(true)} className="rounded-xl bg-[var(--theme-color)] px-4 py-2.5 text-sm font-bold text-white"><Settings className="mr-2 inline h-4 w-4"/>Configurar conexão</button>} />
    {message && <div role="status" className="rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">{message}</div>}
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-[var(--theme-color)]"/><div><h3 className="font-black">Conexão segura pelo servidor</h3><p className="text-xs text-gray-500">As credenciais nunca são enviadas ao navegador.</p></div></div><AppBadge tone={connection?.connected ? 'success' : connection?.configured ? 'warning' : 'danger'}>{connection?.connected ? 'Conectado' : connection?.configured ? 'Configurado' : 'Não configurado'}</AppBadge></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800"><span className="text-xs text-gray-500">Ambiente</span><strong className="block">{connection?.environment === 'sandbox' ? 'Sandbox' : 'Produção'}</strong></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-zinc-800"><span className="text-xs text-gray-500">Conta</span><strong className="block">{connection?.account || 'Não informada'}</strong></div><button disabled={busy || !connection?.configured} onClick={testConnection} className="rounded-xl bg-[var(--theme-color)] px-4 py-3 font-bold text-white disabled:opacity-50"><RefreshCw className="mr-2 inline h-4 w-4"/>{busy ? 'Verificando…' : 'Testar conexão'}</button></div>
      {!connection?.configured && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Use “Configurar conexão” para conectar nesta sessão ou configure as credenciais no ambiente seguro do servidor.</p>}
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold">Data inicial<input className={`${appControlClass} mt-2`} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-xs font-bold">Data final<input className={`${appControlClass} mt-2`} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label className="text-xs font-bold">Unidade<select className={`${appControlClass} mt-2`} value={unitId} onChange={e=>setUnitId(e.target.value)}><option value="">Selecione</option>{systemUnits.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><button disabled={busy || !connection?.configured || !from || !to} onClick={loadReport} className="self-end rounded-xl bg-gray-900 px-4 py-3 font-bold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"><CloudDownload className="mr-2 inline h-4 w-4"/>{busy ? 'Carregando…' : 'Consultar API'}</button></div></section>
    {report && <><section className="grid gap-3 sm:grid-cols-3"><button onClick={()=>setView('transactions')} className={`rounded-2xl border p-4 text-left ${view==='transactions'?'border-[var(--theme-color)]':'border-gray-200 dark:border-zinc-800'}`}><span className="text-xs text-gray-500">Transações</span><strong className="block text-2xl">{report.transactions.length}</strong></button><button onClick={()=>setView('receivables')} className={`rounded-2xl border p-4 text-left ${view==='receivables'?'border-[var(--theme-color)]':'border-gray-200 dark:border-zinc-800'}`}><span className="text-xs text-gray-500">Recebíveis previstos</span><strong className="block text-2xl">{report.receivables.length}</strong></button><div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800"><span className="text-xs text-gray-500">Total exibido</span><strong className="block text-2xl">{money.format(total)}</strong></div></section>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center"><h3 className="font-black">{view==='transactions'?'Relatório de transações':'Previsão de recebíveis'}</h3><button disabled={busy || !report.transactions.length} onClick={syncForReconciliation} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Database className="mr-2 inline h-4 w-4"/>Sincronizar com conciliações</button></div>{rows.length===0?<AppEmptyState title="Nenhum registro no período" description="Ajuste as datas e consulte novamente."/>:<div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="bg-gray-50 text-left dark:bg-zinc-800">{['Vencimento','Referência','Cliente','Forma','Status','Valor'].map(label=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.id} className="border-t border-gray-100 dark:border-zinc-800"><td className="px-4 py-3">{item.dueDate}</td><td className="px-4 py-3 font-mono">{item.externalId}</td><td className="px-4 py-3">{item.customerName||'—'}</td><td className="px-4 py-3">{item.paymentMethod}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500"/>{item.statusDescription}</span></td><td className="px-4 py-3 text-right font-bold">{money.format(item.amount)}</td></tr>)}</tbody></table></div>}</section></>}
    {showConfiguration && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setShowConfiguration(false)}}><section role="dialog" aria-modal="true" aria-labelledby="celcoin-config-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[var(--theme-color)]">Credenciais da API</p><h2 id="celcoin-config-title" className="text-xl font-black">Configurar conexão Celcoin</h2></div><button aria-label="Fechar" onClick={()=>setShowConfiguration(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5"/></button></div><p className="mt-2 text-xs text-gray-500">Os dados ficam apenas na memória desta aba e são apagados ao recarregar ou fechar a página.</p><div className="mt-5 space-y-4"><label className="block text-xs font-bold">Ambiente<select className={`${appControlClass} mt-2 w-full`} value={credentials.environment} onChange={e=>setCredentials(value=>({...value,environment:e.target.value as SessionCredentials['environment']}))}><option value="production">Produção</option><option value="sandbox">Sandbox</option></select></label><label className="block text-xs font-bold">Galax ID<input className={`${appControlClass} mt-2 w-full`} inputMode="numeric" autoComplete="off" value={credentials.id} onChange={e=>setCredentials(value=>({...value,id:e.target.value}))} placeholder="Informe o Galax ID"/></label><label className="block text-xs font-bold">Galax Hash<input className={`${appControlClass} mt-2 w-full`} type="password" autoComplete="new-password" value={credentials.hash} onChange={e=>setCredentials(value=>({...value,hash:e.target.value}))} placeholder="Informe o Galax Hash"/></label></div><button disabled={busy||!credentials.id.trim()||!credentials.hash.trim()} onClick={testConnection} className="mt-5 w-full rounded-xl bg-[var(--theme-color)] px-4 py-3 font-bold text-white disabled:opacity-50"><RefreshCw className="mr-2 inline h-4 w-4"/>{busy?'Testando…':'Conectar e usar nesta sessão'}</button></section></div>}
  </div>;
}

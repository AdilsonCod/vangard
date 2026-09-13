import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Download, History, Search, X } from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../store';
import { Pagination } from './ui/Pagination';

type AuditSource = 'changes' | 'logins';
type AuditRow = { id:string; userId:string; userName?:string; userRole:string; action:string; timestamp:string; module?:string; recordId?:string; beforeState?:unknown; afterState?:unknown; ipAddress?:string; userAgent?:string };

const control = 'mt-1 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700';
const actionLabels: Record<string,string> = { login_sucesso:'Login realizado', login_falha:'Tentativa de login falhou', CREATED:'Registro criado', UPDATED:'Registro alterado', DELETED:'Registro excluído', CLOSED:'Caixa fechado', REOPENED:'Caixa reaberto', IMPORTED:'Dados importados', CALCULATED:'Cálculo realizado', TRANSFERRED:'Transferência registrada' };
const moduleLabels: Record<string,string> = { TRANSACTION:'Lançamentos', PAYMENT:'Pagamentos', RECONCILIATION:'Conciliação', IMPORT:'Importações', COMMISSION:'Comissões', CASH_CLOSING:'Fechamento de caixa' };

export default function AuditHistory() {
  const { currentUser, users, financialAuditEvents } = useStore();
  const [source,setSource] = useState<AuditSource>('changes');
  const [loginRows,setLoginRows] = useState<AuditRow[]>([]);
  const [busy,setBusy] = useState(true), [error,setError] = useState('');
  const [search,setSearch] = useState(''), [action,setAction] = useState('ALL'), [role,setRole] = useState('ALL'), [module,setModule] = useState(''), [from,setFrom] = useState(''), [to,setTo] = useState('');
  const [pageSize,setPageSize] = useState(25), [page,setPage] = useState(1), [selected,setSelected] = useState<AuditRow|null>(null);

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') return;
    setBusy(true); setError('');
    return onSnapshot(query(collection(db,'loginAudit'),orderBy('timestamp','desc'),limit(500)), snapshot => {
      setLoginRows(snapshot.docs.map(item => ({id:item.id,...item.data()} as AuditRow))); setBusy(false);
    }, snapshotError => {
      console.error('Erro ao carregar histórico de logins:',snapshotError);
      setError('Não foi possível carregar os registros de login. Verifique as permissões da conta de gerência.'); setBusy(false);
    });
  },[currentUser?.role]);

  const changeRows = useMemo<AuditRow[]>(() => financialAuditEvents.map(event => ({ id:event.id, userId:event.actorId, userName:event.actorName, userRole:event.actorRole, action:event.action, timestamp:event.createdAt, module:event.entityType, recordId:event.entityId, beforeState:event.previousValue, afterState:event.newValue })),[financialAuditEvents]);
  const userName = (row:AuditRow) => row.userName || users.find(user => user.id===row.userId || user.authUid===row.userId)?.name || row.userId || 'Não identificado';
  const availableRows = source==='changes' ? changeRows : loginRows;
  const actions = source==='changes' ? ['CREATED','UPDATED','DELETED','CLOSED','REOPENED','IMPORTED','CALCULATED','TRANSFERRED'] : ['login_sucesso','login_falha'];
  const filtered = useMemo(() => availableRows
    .filter(row => !search || `${userName(row)} ${row.userId}`.toLowerCase().includes(search.toLowerCase()))
    .filter(row => action==='ALL' || row.action===action).filter(row => role==='ALL' || row.userRole===role)
    .filter(row => !module || (moduleLabels[row.module||''] || row.module || '').toLowerCase().includes(module.toLowerCase()))
    .filter(row => !from || row.timestamp>=`${from}T00:00:00.000`).filter(row => !to || row.timestamp<=`${to}T23:59:59.999`)
    .sort((a,b) => b.timestamp.localeCompare(a.timestamp)),[availableRows,search,action,role,module,from,to,users]);
  useEffect(() => setPage(1),[source,search,action,role,module,from,to,pageSize]);
  useEffect(() => setAction('ALL'),[source]);
  if (currentUser?.role!=='ADMIN') return null;
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)), currentPage=Math.min(page,totalPages), visibleRows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const exportCsv=()=>{const fields=['timestamp','action','userId','userName','userRole','module','recordId','ipAddress','userAgent'] as const;const csv=[fields.join(','),...filtered.map(row=>fields.map(field=>JSON.stringify(field==='userName'?userName(row):row[field]??'')).join(','))].join('\n');const url=URL.createObjectURL(new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`historico-auditavel-${source}-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);};

  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--app-accent-soft)] p-3 text-[var(--app-accent)]"><History size={22}/></span><div><p className="text-xs font-black uppercase tracking-widest text-[var(--app-accent)]">Gerência</p><h1 className="text-2xl font-black">Histórico auditável</h1><p className="text-sm text-zinc-500">Logins e operações financeiras registrados em trilhas imutáveis.</p></div></div></header>
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-bold text-zinc-500">Tipo de histórico<select className={control} value={source} onChange={event=>setSource(event.target.value as AuditSource)}><option value="changes">Alterações</option><option value="logins">Logins</option></select></label>
      <label className="text-xs font-bold text-zinc-500">Usuário<input className={control} placeholder="Nome ou identificador" value={search} onChange={event=>setSearch(event.target.value)}/></label>
      <label className="text-xs font-bold text-zinc-500">Ação<select className={control} value={action} onChange={event=>setAction(event.target.value)}><option value="ALL">Todas as ações</option>{actions.map(value=><option key={value} value={value}>{actionLabels[value]||value}</option>)}</select></label>
      <label className="text-xs font-bold text-zinc-500">Perfil<select className={control} value={role} onChange={event=>setRole(event.target.value)}><option value="ALL">Todos os perfis</option>{['ADMIN','FINANCIAL','MARKETING','RECEPTION','BARBER','MANICURE','UNKNOWN'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-bold text-zinc-500">Módulo<input className={control} placeholder="Ex.: Pagamentos" value={module} onChange={event=>setModule(event.target.value)} disabled={source==='logins'}/></label>
      <label className="text-xs font-bold text-zinc-500">De<input aria-label="Data inicial" className={control} type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label className="text-xs font-bold text-zinc-500">Até<input aria-label="Data final" className={control} type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
      <div className="flex items-end gap-2"><label className="flex-1 text-xs font-bold text-zinc-500">Registros<select className={control} value={pageSize} onChange={event=>setPageSize(Number(event.target.value))}>{[10,25,50,100].map(value=><option key={value} value={value}>{value} por página</option>)}</select></label><button className="rounded-xl bg-[var(--app-accent)] p-3 text-white" onClick={exportCsv} title="Exportar todos os resultados em CSV" aria-label="Exportar CSV"><Download size={18}/></button></div>
    </div></section>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-black">Eventos registrados</h2><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-800">{filtered.length}</span></div>
      {busy&&source==='logins'?<p className="p-8 text-center text-zinc-500">Carregando histórico…</p>:visibleRows.length===0?<div className="flex min-h-52 flex-col items-center justify-center gap-2 text-zinc-500"><Search size={28}/><p className="font-bold">Nenhum evento encontrado</p><p className="text-sm">Ajuste os filtros ou realize uma operação auditada.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead><tr className="border-b border-zinc-200 dark:border-zinc-800">{['Data e hora','Ação','Usuário','Perfil','Módulo','Registro','Origem'].map(title=><th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{visibleRows.map(row=><tr key={row.id} className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800" onClick={()=>setSelected(row)}><td className="p-3 text-xs" title={row.timestamp}>{new Date(row.timestamp).toLocaleString('pt-BR')}</td><td className="p-3 font-semibold">{actionLabels[row.action]||row.action}</td><td className="p-3">{userName(row)}</td><td className="p-3">{row.userRole||'UNKNOWN'}</td><td className="p-3">{moduleLabels[row.module||'']||row.module||'Login'}</td><td className="p-3 font-mono text-xs">{row.recordId||'-'}</td><td className="p-3 text-xs">{row.ipAddress||'-'}</td></tr>)}</tbody></table></div>}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length}/>
    </section>
    {selected&&<div className="fixed inset-0 z-[150] grid place-items-center bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}><div role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 dark:bg-zinc-900"><button aria-label="Fechar" className="float-right rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={()=>setSelected(null)}><X/></button><h2 id="audit-detail-title" className="text-xl font-black">Detalhes do evento</h2><p className="text-sm text-zinc-500">{moduleLabels[selected.module||'']||selected.module||'Login'} · {selected.recordId||selected.id}</p>{source==='changes'?<div className="mt-4 grid gap-3 md:grid-cols-2"><pre className="max-h-96 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-950">Antes{`\n`}{JSON.stringify(selected.beforeState??null,null,2)}</pre><pre className="max-h-96 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs dark:bg-zinc-950">Depois{`\n`}{JSON.stringify(selected.afterState??null,null,2)}</pre></div>:<dl className="mt-4 grid gap-3 rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-950 sm:grid-cols-2"><div><dt className="font-bold">Endereço IP</dt><dd>{selected.ipAddress||'-'}</dd></div><div><dt className="font-bold">User agent</dt><dd className="break-all">{selected.userAgent||'-'}</dd></div><div><dt className="font-bold">Timestamp UTC</dt><dd className="font-mono text-xs">{selected.timestamp}</dd></div><div><dt className="font-bold">Identificador</dt><dd className="break-all">{selected.userId}</dd></div></dl>}</div></div>}
  </div>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Clock3, Link2, ListFilter, MessageCircle, Pause, Play, QrCode, Save, Send, ShieldCheck, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import { db } from '../firebase';
import { authenticatedApi } from '../services/apiClient';
import { useStore } from '../store';
import { AppBadge, AppButton, AppCard, AppEmptyState, AppPageHeader, AppSectionHeader, appControlClass } from './ui/AppPrimitives';
import { defaultUnitFor, scopedCollectionQuery } from '../services/firestoreScope';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from './ui/Pagination';

type LogEntry={id:string;time:string;text:string;type:'info'|'success'|'warning'};
type BackendState={enabled:boolean;connectionStatus:'disconnected'|'connecting'|'qr'|'connected';currentQr:string;isSending:boolean;progress:number;total:number;currentAction:string;logs:LogEntry[];campaignStatus:'idle'|'running'|'completed'|'stopped';successCount:number;errorCount:number;errorDetails:{contact:string;error:string}[];runId:string};
type ContactList={id:string;name:string;contacts:string;unitId:string;createdAt:string};
type DispatchHistory={id:string;name:string;createdAt:string;unitId:string;total:number;successCount:number;errorCount:number;status:string;createdBy:string};

const initialBackend:BackendState={enabled:false,connectionStatus:'disconnected',currentQr:'',isSending:false,progress:0,total:0,currentAction:'Conecte o serviço para começar.',logs:[],campaignStatus:'idle',successCount:0,errorCount:0,errorDetails:[],runId:''};
const messageServiceUrl=String(import.meta.env.VITE_MESSAGE_SERVICE_URL||(import.meta.env.DEV?'http://localhost:3001':'')).replace(/\/$/,'');
const messageApi=(path:string)=>`${messageServiceUrl}/api/message-dispatch/${path}`;
const normalizeContacts=(value:string)=>{
  const raw=value.split(/[\n,;]+/).map(item=>item.trim()).filter(Boolean);
  const valid:string[]=[];const invalid:string[]=[];
  raw.forEach(item=>{let digits=item.replace(/\D/g,'');if(digits.startsWith('0'))digits=digits.slice(1);if(digits.length===10||digits.length===11)digits=`55${digits}`;(digits.length>=12&&digits.length<=13?valid:invalid).push(digits||item);});
  return {valid:[...new Set(valid)],invalid,duplicates:Math.max(0,valid.length-new Set(valid).size)};
};
const dateTime=(value:string)=>value?new Date(value).toLocaleString('pt-BR'):'—';

export default function MessageDispatchDashboard(){
  const {currentUser,systemUnits}=useStore();
  const [campaignName,setCampaignName]=useState('');
  const [contacts,setContacts]=useState('');
  const [message,setMessage]=useState('');
  const [minDelay,setMinDelay]=useState(15);
  const [maxDelay,setMaxDelay]=useState(35);
  const [simulateTyping,setSimulateTyping]=useState(true);
  const [confirmedOptIn,setConfirmedOptIn]=useState(false);
  const [unitId,setUnitId]=useState(()=>defaultUnitFor(currentUser));
  const [backend,setBackend]=useState(initialBackend);
  const [lists,setLists]=useState<ContactList[]>([]);
  const [history,setHistory]=useState<DispatchHistory[]>([]);
  const [feedback,setFeedback]=useState('');
  const [apiError,setApiError]=useState('');
  const parsed=useMemo(()=>normalizeContacts(contacts),[contacts]);
  const percentage=backend.total?Math.round(backend.progress/backend.total*100):0;

  const { currentData: currentHistory, currentPage, totalPages, goToPage, totalItems } = usePagination(history, 10);

  useEffect(()=>onSnapshot(scopedCollectionQuery('message_contact_lists',currentUser),snapshot=>setLists(snapshot.docs.map(item=>({id:item.id,...item.data()} as ContactList)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))),[currentUser]);
  useEffect(()=>onSnapshot(scopedCollectionQuery('message_dispatch_history',currentUser),snapshot=>setHistory(snapshot.docs.map(item=>({id:item.id,...item.data()} as DispatchHistory)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20))),[currentUser]);
  useEffect(()=>{
    let cancelled=false;
    const poll=async()=>{try{const data=await authenticatedApi.json<BackendState>(`${messageApi('status')}?unitId=${encodeURIComponent(unitId)}`);if(!cancelled){setBackend(data);setApiError('');}}catch(error){if(!cancelled){setBackend(initialBackend);setApiError(error instanceof Error?error.message:'Não foi possível consultar o serviço persistente de mensagens.');}}};
    void poll();const timer=setInterval(poll,1500);return()=>{cancelled=true;clearInterval(timer);};
  },[unitId]);

  const call=async(path:string,body?:object)=>{setFeedback('');return authenticatedApi.json<Record<string,unknown>>(messageApi(path),{method:'POST',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});};
  const connect=async()=>{try{await call('connect',{unitId});setFeedback('Conexão iniciada. Aguarde o QR Code.');}catch(error){setFeedback(error instanceof Error?error.message:'Falha ao conectar.');}};
  const start=async()=>{if(!campaignName.trim()){setFeedback('Informe um nome para identificar o disparo.');return;}if(!parsed.valid.length){setFeedback('Inclua ao menos um contato válido.');return;}if(!message.trim()){setFeedback('Digite a mensagem que será enviada.');return;}if(!confirmedOptIn){setFeedback('Confirme que os contatos autorizaram o recebimento.');return;}try{await call('start',{campaignName,unitId,contacts:parsed.valid,message,minDelay,maxDelay,simulateTyping,confirmedOptIn});setFeedback('Campanha iniciada no serviço persistente. Você pode continuar usando o sistema normalmente.');}catch(error){setFeedback(error instanceof Error?error.message:'Falha ao iniciar.');}};
  const stop=async()=>{const reason=prompt('Informe o motivo da interrupção:','Interrompida manualmente pelo operador.')?.trim();if(reason===undefined)return;try{await call('stop',{unitId,reason});}catch(error){setFeedback(error instanceof Error?error.message:'Falha ao interromper.');}};
  const saveList=async()=>{if(!parsed.valid.length){setFeedback('Não há contatos válidos para salvar.');return;}const name=prompt('Nome da lista de contatos:')?.trim();if(!name)return;const id=crypto.randomUUID();await setDoc(doc(db,'message_contact_lists',id),{name,contacts:parsed.valid.join('\n'),unitId,createdAt:new Date().toISOString(),createdBy:currentUser?.id||''});setFeedback('Lista salva no sistema.');};
  const etaSeconds=Math.max(0,parsed.valid.length-(backend.isSending?backend.progress:0))*((minDelay+maxDelay)/2+(simulateTyping?Math.min(6,Math.max(1.2,message.length*.045)):0));
  const eta=etaSeconds>=3600?`${Math.floor(etaSeconds/3600)}h ${Math.ceil(etaSeconds%3600/60)}min`:etaSeconds>=60?`${Math.ceil(etaSeconds/60)} min`:`${Math.ceil(etaSeconds)}s`;

  return <div className="space-y-5">
    <AppPageHeader eyebrow="Comunicação" title="Disparo de mensagens" description="Prepare listas autorizadas, conecte o WhatsApp e acompanhe cada envio em tempo real." icon={<MessageCircle className="h-5 w-5"/>}/>
    {apiError&&<div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0"/><div><strong>Serviço protegido ou indisponível</strong><p className="mt-1 text-xs">{apiError}</p></div></div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
      <div className="space-y-5">
        <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Campanha e destinatários" description="Um número por linha. O sistema adiciona o código 55, remove duplicados e sinaliza inválidos."/><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nome do disparo"><input className={appControlClass+' w-full'} value={campaignName} onChange={event=>setCampaignName(event.target.value)} placeholder="Ex.: Lembrete de retorno setembro" disabled={backend.isSending}/></Field><Field label="Unidade"><select className={appControlClass+' w-full'} value={unitId} onChange={event=>setUnitId(event.target.value)} disabled={backend.isSending}><option value="ALL">Todas as unidades</option>{systemUnits.filter(item=>item.isActive!==false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><div className="mt-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-bold">Contatos do WhatsApp</label><div className="flex gap-2"><AppButton onClick={()=>setContacts(parsed.valid.join('\n'))} disabled={backend.isSending}><ListFilter className="h-4 w-4"/>Limpar lista</AppButton><AppButton onClick={saveList} disabled={backend.isSending}><Save className="h-4 w-4"/>Salvar lista</AppButton></div></div><textarea className="min-h-44 w-full rounded-xl border border-gray-200 bg-white p-3 font-mono text-sm outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-950" value={contacts} onChange={event=>setContacts(event.target.value)} placeholder={'5511999999999\n11988887777'} disabled={backend.isSending}/><div className="mt-2 flex flex-wrap gap-2"><AppBadge tone="success">{parsed.valid.length} válidos</AppBadge>{parsed.duplicates>0&&<AppBadge tone="warning">{parsed.duplicates} duplicados</AppBadge>}{parsed.invalid.length>0&&<AppBadge tone="danger">{parsed.invalid.length} inválidos</AppBadge>}</div>{lists.length>0&&<div className="mt-3 flex flex-wrap gap-2">{lists.slice(0,8).map(list=><span key={list.id} className="inline-flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700"><button className="px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={()=>{setContacts(list.contacts);setUnitId(list.unitId||'ALL');}}>{list.name}</button><button aria-label={`Excluir ${list.name}`} className="border-l border-gray-200 p-2 text-gray-400 hover:text-red-500 dark:border-zinc-700" onClick={()=>deleteDoc(doc(db,'message_contact_lists',list.id))}><Trash2 className="h-3.5 w-3.5"/></button></span>)}</div>}</div></AppCard>
        <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Mensagem" description="Revise o conteúdo antes de iniciar. O limite do WhatsApp é de 4.096 caracteres."/><textarea className="mt-4 min-h-40 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-950" value={message} maxLength={4096} onChange={event=>setMessage(event.target.value)} placeholder="Olá! Tudo bem? ..." disabled={backend.isSending}/><p className="mt-1 text-right text-[10px] text-gray-400">{message.length}/4096</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Pausa mínima (s)"><input type="number" min={8} max={120} className={appControlClass+' w-full'} value={minDelay} onChange={event=>setMinDelay(Math.max(8,Number(event.target.value)))} disabled={backend.isSending}/></Field><Field label="Pausa máxima (s)"><input type="number" min={minDelay} max={180} className={appControlClass+' w-full'} value={maxDelay} onChange={event=>setMaxDelay(Math.max(minDelay,Number(event.target.value)))} disabled={backend.isSending}/></Field><label className="flex items-end"><span className="flex h-10 w-full items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold dark:border-zinc-700"><input type="checkbox" checked={simulateTyping} onChange={event=>setSimulateTyping(event.target.checked)} disabled={backend.isSending}/>Preparar digitação</span></label></div><label className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200"><input className="mt-0.5" type="checkbox" checked={confirmedOptIn} onChange={event=>setConfirmedOptIn(event.target.checked)} disabled={backend.isSending}/><span><strong>Contatos autorizados</strong><br/>Confirmo que os destinatários aceitaram receber mensagens e podem solicitar o descadastramento.</span></label></AppCard>
      </div>
      <div className="space-y-5">
        <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Conexão do WhatsApp" description="A sessão fica no servidor e o acesso é autorizado automaticamente pelo seu login."/><div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/60"><div className="flex items-center gap-3">{backend.connectionStatus==='connected'?<Wifi className="h-5 w-5 text-emerald-500"/>:<WifiOff className="h-5 w-5 text-amber-500"/>}<div><strong className="block text-sm">{backend.connectionStatus==='connected'?'Conectado':backend.connectionStatus==='qr'?'Aguardando leitura':backend.connectionStatus==='connecting'?'Conectando...':'Desconectado'}</strong><span className="text-xs text-gray-400">{backend.currentAction}</span></div></div>{backend.connectionStatus!=='connected'&&<AppButton variant="primary" onClick={connect}><Link2 className="h-4 w-4"/>Conectar</AppButton>}</div>{backend.currentQr&&<div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-gray-300 p-4 dark:border-zinc-700"><img src={backend.currentQr} alt="QR Code para conectar o WhatsApp" className="h-52 w-52 rounded-lg bg-white p-2"/><p className="mt-3 text-center text-xs text-gray-500 dark:text-zinc-400">No WhatsApp, abra Aparelhos conectados e escolha Conectar um aparelho.</p></div>}</AppCard>
        <AppCard className="overflow-hidden"><div className="bg-[var(--theme-color)] p-5 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider opacity-80">Central de envio</p><h3 className="mt-1 text-xl font-black">{backend.isSending?'Campanha em andamento':'Pronto para iniciar'}</h3></div><Send className="h-7 w-7"/></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-black/20"><div className="h-full bg-white transition-all" style={{width:`${percentage}%`}}/></div><div className="mt-2 flex justify-between text-xs"><span>{backend.progress} de {backend.total||parsed.valid.length}</span><span>{backend.isSending?`${percentage}%`:`Estimativa: ${eta}`}</span></div><div className="mt-5 flex gap-2">{backend.isSending?<AppButton className="flex-1 bg-white text-red-600 hover:bg-white/90" onClick={stop}><Pause className="h-4 w-4"/>Interromper</AppButton>:<AppButton className="flex-1 bg-white text-[var(--theme-color)] hover:bg-white/90" disabled={backend.connectionStatus!=='connected'||!parsed.valid.length||!message.trim()||!confirmedOptIn} onClick={start}><Play className="h-4 w-4"/>Iniciar disparo</AppButton>}</div></div><div className="grid grid-cols-3 gap-2 p-4"><Counter label="Processados" value={backend.progress} icon={Clock3}/><Counter label="Entregues" value={backend.successCount} icon={CheckCircle2}/><Counter label="Falhas" value={backend.errorCount} icon={AlertTriangle}/></div>{feedback&&<p role="status" className="mx-4 mb-4 rounded-lg bg-gray-50 p-3 text-xs font-bold dark:bg-zinc-800">{feedback}</p>}</AppCard>
        <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Registro em tempo real" description="Últimos eventos desta sessão."/><div className="mt-4 max-h-64 space-y-2 overflow-y-auto app-scrollbar">{backend.logs.length?backend.logs.map(log=><div key={log.id} className="flex gap-3 rounded-lg bg-gray-50 p-2 text-xs dark:bg-zinc-800/60"><span className="shrink-0 font-mono text-gray-400">{log.time}</span><span className={log.type==='success'?'text-emerald-600 dark:text-emerald-400':log.type==='warning'?'text-amber-600 dark:text-amber-400':''}>{log.text}</span></div>):<p className="py-8 text-center text-sm text-gray-400">Aguardando atividade.</p>}</div></AppCard>
      </div>
    </div>
    <AppCard className="p-4 sm:p-5">
      <AppSectionHeader title="Histórico de campanhas" description="Resumo dos processamentos salvos no sistema."/>
      <div className="mt-4 space-y-2">
        {history.length?currentHistory.map(item=><div key={item.id} className="grid gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800 sm:grid-cols-[minmax(0,1fr)_repeat(4,auto)] sm:items-center"><div><strong className="block text-sm">{item.name}</strong><span className="text-xs text-gray-400">{dateTime(item.createdAt)} · {systemUnits.find(unit=>unit.id===item.unitId)?.name||'Todas as unidades'}</span></div><Small label="Total" value={item.total}/><Small label="Entregues" value={item.successCount}/><Small label="Falhas" value={item.errorCount}/><AppBadge tone={item.errorCount?'warning':'success'}>{item.status}</AppBadge></div>):<AppEmptyState icon={<QrCode/>} title="Nenhum disparo registrado" description="As campanhas concluídas aparecerão aqui."/>}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} totalItems={totalItems} />
    </AppCard>
    <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300"><ShieldCheck className="h-5 w-5 shrink-0"/><p>Use somente contatos com consentimento, mantenha uma opção clara de saída e respeite as políticas do WhatsApp. O sistema limita cada execução a 200 destinatários.</p></div>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1 block text-xs font-bold text-gray-600 dark:text-zinc-300">{label}</span>{children}</label>}
function Counter({label,value,icon:Icon}:{label:string;value:number;icon:React.ComponentType<{className?:string}>}){return <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-zinc-800/60"><Icon className="mx-auto h-4 w-4 text-[var(--theme-color)]"/><strong className="mt-1 block text-xl">{value}</strong><span className="text-[10px] text-gray-400">{label}</span></div>}
function Small({label,value}:{label:string;value:number}){return <div><span className="block text-[9px] font-bold uppercase text-gray-400">{label}</span><strong className="text-sm">{value}</strong></div>}

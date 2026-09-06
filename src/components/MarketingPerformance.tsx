import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { AlertTriangle, BarChart3, CircleDollarSign, Edit3, Eye, Megaphone, MousePointerClick, Plus, Target, Trash2, TrendingUp, Users, X } from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../store';
import { AppBadge, AppButton, AppCard, AppEmptyState, AppSectionHeader, appControlClass } from './ui/AppPrimitives';

type TrafficRecord = {
  id:string; date:string; campaignId:string; unitId:string; platform:string; investment:number; otherCosts:number;
  impressions:number; reach:number; clicks:number; leads:number; conversations:number; appointments:number; attendances:number; newClients:number; revenue:number; notes:string;
};
type OrganicRecord = {
  id:string; date:string; contentId:string; unitId:string; platform:string; format:string; reach:number; views:number; likes:number;
  comments:number; shares:number; saves:number; profileClicks:number; whatsappClicks:number; linkClicks:number; followersGained:number; appointments:number; revenue:number;
};
type Campaign = { id:string; name:string; budget?:number; status?:string; startDate?:string; endDate?:string };
type Content = { id:string; title:string; campaignId?:string; platform?:string; format?:string; unitId?:string; status?:string };

const periodNow=()=>new Date().toISOString().slice(0,7);
const trafficBlank=():TrafficRecord=>({id:'',date:new Date().toISOString().slice(0,10),campaignId:'',unitId:'ALL',platform:'Instagram',investment:0,otherCosts:0,impressions:0,reach:0,clicks:0,leads:0,conversations:0,appointments:0,attendances:0,newClients:0,revenue:0,notes:''});
const organicBlank=():OrganicRecord=>({id:'',date:new Date().toISOString().slice(0,10),contentId:'',unitId:'ALL',platform:'Instagram',format:'Reels',reach:0,views:0,likes:0,comments:0,shares:0,saves:0,profileClicks:0,whatsappClicks:0,linkClicks:0,followersGained:0,appointments:0,revenue:0});
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const integer=(value:number)=>value.toLocaleString('pt-BR');
const safe=(value:unknown)=>Number(value)||0;
const ratio=(numerator:number,denominator:number)=>denominator>0?numerator/denominator:0;
const dayMs=86_400_000;
const dateAtNoon=(value:string)=>new Date(`${value}T12:00:00`).getTime();

export function MarketingPerformance({view}:{view:'TRAFFIC'|'RESULTS'}) {
  const {systemUnits}=useStore();
  const [traffic,setTraffic]=useState<TrafficRecord[]>([]);
  const [organic,setOrganic]=useState<OrganicRecord[]>([]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [contents,setContents]=useState<Content[]>([]);
  const [period,setPeriod]=useState(periodNow());
  const [unit,setUnit]=useState('ALL');
  const [campaign,setCampaign]=useState('ALL');
  const [trafficForm,setTrafficForm]=useState<TrafficRecord|null>(null);
  const [organicForm,setOrganicForm]=useState<OrganicRecord|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>onSnapshot(collection(db,'marketing_traffic'),snapshot=>setTraffic(snapshot.docs.map(item=>({id:item.id,...item.data()} as TrafficRecord)))),[]);
  useEffect(()=>onSnapshot(collection(db,'marketing_organic'),snapshot=>setOrganic(snapshot.docs.map(item=>({id:item.id,...item.data()} as OrganicRecord)))),[]);
  useEffect(()=>onSnapshot(collection(db,'marketing_campaigns'),snapshot=>setCampaigns(snapshot.docs.map(item=>({id:item.id,...item.data()} as Campaign)))),[]);
  useEffect(()=>onSnapshot(collection(db,'social_posts'),snapshot=>setContents(snapshot.docs.map(item=>({id:item.id,...item.data()} as Content)))),[]);

  const unitName=(id:string)=>id==='ALL'?'Todas as unidades':systemUnits.find(item=>item.id===id)?.name||'Unidade';
  const campaignName=(id:string)=>campaigns.find(item=>item.id===id)?.name||'Campanha não encontrada';
  const contentName=(id:string)=>contents.find(item=>item.id===id)?.title||'Conteúdo não encontrado';
  const filteredTraffic=traffic.filter(item=>item.date?.startsWith(period)&&(unit==='ALL'||item.unitId===unit||item.unitId==='ALL')&&(campaign==='ALL'||item.campaignId===campaign));
  const filteredOrganic=organic.filter(item=>item.date?.startsWith(period)&&(unit==='ALL'||item.unitId===unit||item.unitId==='ALL')&&(campaign==='ALL'||contents.find(content=>content.id===item.contentId)?.campaignId===campaign));
  const total=(list:any[],key:string)=>list.reduce((sum,item)=>sum+safe(item[key]),0);

  const investment=total(filteredTraffic,'investment');
  const otherCosts=total(filteredTraffic,'otherCosts');
  const impressions=total(filteredTraffic,'impressions');
  const reach=total(filteredTraffic,'reach');
  const clicks=total(filteredTraffic,'clicks');
  const leads=total(filteredTraffic,'leads');
  const appointments=total(filteredTraffic,'appointments');
  const newClients=total(filteredTraffic,'newClients');
  const revenue=total(filteredTraffic,'revenue');
  const cost=investment+otherCosts;
  const ctr=ratio(clicks,impressions)*100;
  const cpc=ratio(investment,clicks);
  const cpl=ratio(investment,leads);
  const cpa=ratio(investment,appointments);
  const cac=ratio(cost,newClients);
  const roas=ratio(revenue,investment);
  const roi=ratio(revenue-cost,cost)*100;

  const campaignRows=useMemo(()=>campaigns.map(item=>{
    const rows=filteredTraffic.filter(record=>record.campaignId===item.id);
    const lifetimeRows=traffic.filter(record=>record.campaignId===item.id&&(unit==='ALL'||record.unitId===unit||record.unitId==='ALL'));
    const spent=total(rows,'investment')+total(rows,'otherCosts');
    const lifetimeSpent=total(lifetimeRows,'investment')+total(lifetimeRows,'otherCosts');
    const rowRevenue=total(rows,'revenue');
    const start=item.startDate?dateAtNoon(item.startDate):0;
    const end=item.endDate?dateAtNoon(item.endDate):0;
    const today=dateAtNoon(new Date().toISOString().slice(0,10));
    const totalDays=start&&end?Math.max(1,Math.floor((end-start)/dayMs)+1):0;
    const elapsedDays=totalDays?Math.max(0,Math.min(totalDays,Math.floor((today-start)/dayMs)+1)):0;
    const expectedSpend=totalDays?safe(item.budget)*(elapsedDays/totalDays):0;
    const overBudget=safe(item.budget)>0&&lifetimeSpent>safe(item.budget);
    const accelerated=!overBudget&&item.status==='ATIVA'&&expectedSpend>0&&lifetimeSpent>expectedSpend*1.15;
    return {...item,spent,lifetimeSpent,expectedSpend,overBudget,accelerated,revenue:rowRevenue,leads:total(rows,'leads'),appointments:total(rows,'appointments'),clients:total(rows,'newClients'),roas:ratio(rowRevenue,total(rows,'investment'))};
  }).filter(item=>item.spent||item.revenue||item.status==='ATIVA').sort((a,b)=>b.spent-a.spent),[campaigns,filteredTraffic,traffic,unit]);

  const organicReach=total(filteredOrganic,'reach');
  const organicViews=total(filteredOrganic,'views');
  const interactions=['likes','comments','shares','saves'].reduce((sum,key)=>sum+total(filteredOrganic,key),0);
  const organicClicks=['profileClicks','whatsappClicks','linkClicks'].reduce((sum,key)=>sum+total(filteredOrganic,key),0);
  const organicAppointments=total(filteredOrganic,'appointments');
  const organicRevenue=total(filteredOrganic,'revenue');
  const engagement=ratio(interactions,organicReach)*100;
  const ranking=useMemo(()=>{
    const grouped=new Map<string,{id:string;reach:number;views:number;interactions:number;clicks:number;appointments:number;revenue:number}>();
    filteredOrganic.forEach(item=>{const row=grouped.get(item.contentId)||{id:item.contentId,reach:0,views:0,interactions:0,clicks:0,appointments:0,revenue:0};row.reach+=safe(item.reach);row.views+=safe(item.views);row.interactions+=safe(item.likes)+safe(item.comments)+safe(item.shares)+safe(item.saves);row.clicks+=safe(item.profileClicks)+safe(item.whatsappClicks)+safe(item.linkClicks);row.appointments+=safe(item.appointments);row.revenue+=safe(item.revenue);grouped.set(item.contentId,row);});
    return [...grouped.values()].sort((a,b)=>(b.appointments*1000+b.interactions)-(a.appointments*1000+a.interactions));
  },[filteredOrganic]);
  const channelRows=useMemo(()=>{
    const grouped=new Map<string,{label:string;reach:number;interactions:number;clicks:number;appointments:number;revenue:number}>();
    filteredOrganic.forEach(item=>{
      const label=`${item.platform||'Sem plataforma'} · ${item.format||'Sem formato'}`;
      const row=grouped.get(label)||{label,reach:0,interactions:0,clicks:0,appointments:0,revenue:0};
      row.reach+=safe(item.reach);
      row.interactions+=safe(item.likes)+safe(item.comments)+safe(item.shares)+safe(item.saves);
      row.clicks+=safe(item.profileClicks)+safe(item.whatsappClicks)+safe(item.linkClicks);
      row.appointments+=safe(item.appointments);
      row.revenue+=safe(item.revenue);
      grouped.set(label,row);
    });
    return [...grouped.values()].sort((a,b)=>(b.appointments*1000+b.interactions)-(a.appointments*1000+a.interactions));
  },[filteredOrganic]);
  const maxChannelReach=Math.max(1,...channelRows.map(item=>item.reach));

  const saveTraffic=async()=>{if(!trafficForm?.date||!trafficForm.campaignId){setError('Informe a data e a campanha.');return;}setSaving(true);setError('');try{const{id,...data}=trafficForm;if(id)await updateDoc(doc(db,'marketing_traffic',id),data);else await addDoc(collection(db,'marketing_traffic'),data);setTrafficForm(null);}catch(reason){console.error(reason);setError('Não foi possível salvar os resultados de tráfego.');}finally{setSaving(false);}};
  const saveOrganic=async()=>{if(!organicForm?.date||!organicForm.contentId){setError('Informe a data e o conteúdo publicado.');return;}setSaving(true);setError('');try{const{id,...data}=organicForm;if(id)await updateDoc(doc(db,'marketing_organic',id),data);else await addDoc(collection(db,'marketing_organic'),data);setOrganicForm(null);}catch(reason){console.error(reason);setError('Não foi possível salvar os resultados do conteúdo.');}finally{setSaving(false);}};
  const filters=<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><input aria-label="Período" type="month" value={period} onChange={event=>setPeriod(event.target.value)} className={appControlClass}/><select aria-label="Unidade" value={unit} onChange={event=>setUnit(event.target.value)} className={appControlClass}><option value="ALL">Todas as unidades</option>{systemUnits.filter(item=>item.isActive!==false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Campanha" value={campaign} onChange={event=>setCampaign(event.target.value)} className={appControlClass}><option value="ALL">Todas as campanhas</option>{campaigns.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>;

  return <div className="space-y-5">
    {view==='TRAFFIC'?<>
      <AppSectionHeader title="Controle de tráfego pago" description="Acompanhe investimento, aquisição, agendamentos e receita por campanha e unidade." actions={<AppButton variant="primary" onClick={()=>{setError('');setTrafficForm(trafficBlank());}}><Plus className="h-4 w-4"/>Lançar resultados</AppButton>}/>
      {filters}
      <MetricGrid items={[['Investimento',money(investment),`${integer(impressions)} impressões`,CircleDollarSign],['Leads',integer(leads),`CPL ${money(cpl)}`,Users],['Agendamentos',integer(appointments),`CPA ${money(cpa)}`,Target],['Receita atribuída',money(revenue),`ROAS ${roas.toFixed(2)}x`,TrendingUp]]}/>
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Eficiência do funil" description="Indicadores calculados automaticamente com os lançamentos filtrados."/><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{[['CTR',`${ctr.toFixed(2)}%`],['CPC',money(cpc)],['CPL',money(cpl)],['CPA',money(cpa)],['CAC',money(cac)],['ROAS',`${roas.toFixed(2)}x`],['ROI',`${roi.toFixed(1)}%`]].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3 text-center dark:bg-zinc-800/60"><span className="text-[10px] font-black uppercase text-gray-400">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}</div></AppCard>
      {campaignRows.some(item=>item.overBudget||item.accelerated)&&<div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0"/><div><strong className="text-sm">Atenção ao ritmo do orçamento</strong><p className="text-xs">Há campanhas acima do orçamento total ou mais de 15% à frente do gasto esperado para hoje.</p></div></div>}
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Desempenho por campanha" description="Compare verba consumida, ritmo de gasto, receita e conversões."/><div className="mt-4 space-y-3">{campaignRows.length?campaignRows.map(item=><div key={item.id} className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.name}</strong><p className="text-xs text-gray-500">{item.leads} leads · {item.appointments} agendamentos · {item.clients} clientes</p></div><div className="flex flex-wrap gap-2"><AppBadge tone={item.overBudget?'danger':item.accelerated?'warning':'neutral'}>{money(item.lifetimeSpent)} de {money(safe(item.budget))}</AppBadge>{item.expectedSpend>0&&<AppBadge tone={item.accelerated?'warning':'neutral'}>Esperado hoje: {money(item.expectedSpend)}</AppBadge>}<AppBadge tone={item.roas>=2?'success':item.spent?'warning':'neutral'}>ROAS {item.roas.toFixed(2)}x</AppBadge></div></div><div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${item.overBudget?'bg-red-500':item.accelerated?'bg-amber-500':'bg-[var(--theme-color)]'}`} style={{width:`${safe(item.budget)>0?Math.min(100,item.lifetimeSpent/safe(item.budget)*100):0}%`}}/></div><p className="mt-1 text-[10px] text-gray-400">No período filtrado: {money(item.spent)}</p></div>):<AppEmptyState icon={<Megaphone/>} title="Sem resultados no período" description="Lance os dados das campanhas para acompanhar o desempenho."/>}</div></AppCard>
      <Records title="Lançamentos de tráfego" empty="Nenhum lançamento de tráfego neste período." rows={filteredTraffic.map(item=>({id:item.id,title:campaignName(item.campaignId),subtitle:`${item.date.split('-').reverse().join('/')} · ${item.platform} · ${unitName(item.unitId)}`,values:[money(safe(item.investment)),`${safe(item.leads)} leads`,`${safe(item.appointments)} agendas`,money(safe(item.revenue))],edit:()=>setTrafficForm({...trafficBlank(),...item}),remove:()=>deleteDoc(doc(db,'marketing_traffic',item.id))}))}/>
    </>:<>
      <AppSectionHeader title="Resultados de conteúdo orgânico" description="Compare alcance, engajamento, cliques e agendamentos de cada publicação." actions={<AppButton variant="primary" onClick={()=>{setError('');setOrganicForm(organicBlank());}}><Plus className="h-4 w-4"/>Lançar métricas</AppButton>}/>
      {filters}
      <MetricGrid items={[['Alcance',integer(organicReach),`${integer(organicViews)} visualizações`,Eye],['Interações',integer(interactions),`${engagement.toFixed(2)}% de engajamento`,BarChart3],['Cliques',integer(organicClicks),'Perfil, WhatsApp e links',MousePointerClick],['Agendamentos',integer(organicAppointments),`${money(organicRevenue)} em receita`,Target]]}/>
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Desempenho por canal e formato" description="Descubra onde cada tipo de conteúdo gera mais alcance, interação e agendamentos."/><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{channelRows.length?channelRows.map(item=><div key={item.label} className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.label}</strong><AppBadge tone={item.appointments?'success':'neutral'}>{item.appointments} agendas</AppBadge></div><div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[var(--theme-color)]" style={{width:`${Math.max(4,item.reach/maxChannelReach*100)}%`}}/></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span><b>{integer(item.reach)}</b> alcance</span><span><b>{integer(item.interactions)}</b> interações</span><span><b>{integer(item.clicks)}</b> cliques</span><span><b>{money(item.revenue)}</b> receita</span></div></div>):<AppEmptyState icon={<BarChart3/>} title="Sem comparativo disponível" description="Registre métricas para comparar plataformas e formatos."/>}</div></AppCard>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]"><AppCard className="p-4 sm:p-5"><AppSectionHeader title="Ranking de conteúdos" description="Ordenado por agendamentos e interação."/><div className="mt-4 space-y-3">{ranking.length?ranking.map((item,index)=><div key={item.id} className="grid gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800 sm:grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] sm:items-center"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--theme-color)]/10 text-sm font-black text-[var(--theme-color)]">{index+1}</span><div className="min-w-0"><strong className="block truncate text-sm">{contentName(item.id)}</strong><span className="text-xs text-gray-400">{integer(item.reach)} de alcance · {integer(item.views)} visualizações</span></div><Stat label="Interações" value={integer(item.interactions)}/><Stat label="Agendamentos" value={integer(item.appointments)}/><Stat label="Receita" value={money(item.revenue)}/></div>):<AppEmptyState icon={<BarChart3/>} title="Sem métricas orgânicas" description="Lance as métricas das publicações para formar o ranking."/>}</div></AppCard><AppCard className="p-4 sm:p-5"><AppSectionHeader title="Conversão orgânica" description="Do conteúdo até o agendamento."/><div className="mt-5 space-y-5">{[['Alcance',organicReach,organicReach],['Interações',interactions,organicReach],['Cliques',organicClicks,interactions],['Agendamentos',organicAppointments,organicClicks]].map(([label,value,base])=><div key={label as string}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{integer(value as number)}</strong></div><div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[var(--theme-color)]" style={{width:`${Math.min(100,ratio(value as number,base as number)*100)}%`}}/></div></div>)}</div></AppCard></div>
      <Records title="Métricas registradas" empty="Nenhuma métrica orgânica neste período." rows={filteredOrganic.map(item=>({id:item.id,title:contentName(item.contentId),subtitle:`${item.date.split('-').reverse().join('/')} · ${item.platform} · ${unitName(item.unitId)}`,values:[`${integer(safe(item.reach))} alcance`,`${integer(safe(item.views))} views`,`${integer(safe(item.appointments))} agendas`,money(safe(item.revenue))],edit:()=>setOrganicForm({...organicBlank(),...item}),remove:()=>deleteDoc(doc(db,'marketing_organic',item.id))}))}/>
    </>}
    {trafficForm&&<TrafficModal form={trafficForm} setForm={setTrafficForm} campaigns={campaigns} units={systemUnits} error={error} saving={saving} save={saveTraffic} close={()=>setTrafficForm(null)}/>}
    {organicForm&&<OrganicModal form={organicForm} setForm={setOrganicForm} contents={contents} units={systemUnits} error={error} saving={saving} save={saveOrganic} close={()=>setOrganicForm(null)}/>}
  </div>;
}

function MetricGrid({items}:{items:[string,string,string,React.ComponentType<{className?:string}>][]}){return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label,value,detail,Icon])=><AppCard key={label} className="p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-zinc-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{detail}</p></div><span className="h-fit rounded-xl bg-[var(--theme-color)]/10 p-2.5 text-[var(--theme-color)]"><Icon className="h-5 w-5"/></span></div></AppCard>)}</div>}

type RecordRow={id:string;title:string;subtitle:string;values:string[];edit:()=>void;remove:()=>void};
function Records({title,empty,rows}:{title:string;empty:string;rows:RecordRow[]}){return <AppCard className="p-4 sm:p-5"><AppSectionHeader title={title}/><div className="mt-4 space-y-2">{rows.length?rows.map(row=><div key={row.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{row.title}</strong><span className="text-xs text-gray-400">{row.subtitle}</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{row.values.map((value,index)=><span key={index} className="rounded-lg bg-gray-50 px-2 py-1.5 text-center text-xs font-bold dark:bg-zinc-800">{value}</span>)}</div><div className="flex gap-1"><button onClick={row.edit} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[var(--theme-color)] dark:hover:bg-zinc-800" aria-label="Editar"><Edit3 className="h-4 w-4"/></button><button onClick={()=>{if(confirm('Excluir este lançamento?'))row.remove();}} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20" aria-label="Excluir"><Trash2 className="h-4 w-4"/></button></div></div>):<p className="py-8 text-center text-sm text-gray-400">{empty}</p>}</div></AppCard>}

const fieldClass='h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-900';
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'sm:col-span-2':''}><span className="mb-1 block text-xs font-bold text-gray-500 dark:text-zinc-400">{label}</span>{children}</label>}
function Num({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){return <Field label={label}><input type="number" min="0" step="0.01" value={value} onChange={event=>onChange(safe(event.target.value))} className={fieldClass}/></Field>}
function ModalShell({title,error,saving,save,close,children}:{title:string;error:string;saving:boolean;save:()=>void;close:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"><div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-800 sm:px-6"><h2 className="text-xl font-black">{title}</h2><button onClick={close} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X/></button></div><div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-6">{children}{error&&<p className="sm:col-span-2 text-sm font-bold text-red-500">{error}</p>}</div><div className="flex justify-end gap-2 border-t border-gray-200 p-4 dark:border-zinc-800 sm:px-6"><AppButton onClick={close}>Cancelar</AppButton><AppButton variant="primary" disabled={saving} onClick={save}>{saving?'Salvando...':'Salvar resultados'}</AppButton></div></div></div>}

function TrafficModal({form,setForm,campaigns,units,error,saving,save,close}:any){return <ModalShell title={form.id?'Editar resultados de tráfego':'Lançar resultados de tráfego'} error={error} saving={saving} save={save} close={close}><Field label="Data"><input type="date" className={fieldClass} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Campanha"><select className={fieldClass} value={form.campaignId} onChange={e=>setForm({...form,campaignId:e.target.value})}><option value="">Selecione</option>{campaigns.map((item:Campaign)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Unidade"><select className={fieldClass} value={form.unitId} onChange={e=>setForm({...form,unitId:e.target.value})}><option value="ALL">Todas as unidades</option>{units.map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Plataforma"><select className={fieldClass} value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}>{['Meta Ads','Google Ads','TikTok Ads','Instagram','Facebook','Outros'].map(item=><option key={item}>{item}</option>)}</select></Field>{[['investment','Investimento'],['otherCosts','Outros custos'],['impressions','Impressões'],['reach','Alcance'],['clicks','Cliques'],['leads','Leads'],['conversations','Conversas'],['appointments','Agendamentos'],['attendances','Comparecimentos'],['newClients','Clientes novos'],['revenue','Receita atribuída']].map(([key,label])=><Num key={key} label={label} value={form[key]} onChange={value=>setForm({...form,[key]:value})}/>) }<Field label="Observações" wide><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="min-h-20 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"/></Field></ModalShell>}
function OrganicModal({form,setForm,contents,units,error,saving,save,close}:any){const selected=contents.find((item:Content)=>item.id===form.contentId);return <ModalShell title={form.id?'Editar métricas do conteúdo':'Lançar métricas do conteúdo'} error={error} saving={saving} save={save} close={close}><Field label="Data"><input type="date" className={fieldClass} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Conteúdo publicado"><select className={fieldClass} value={form.contentId} onChange={e=>{const item=contents.find((content:Content)=>content.id===e.target.value);setForm({...form,contentId:e.target.value,platform:item?.platform||form.platform,format:item?.format||form.format,unitId:item?.unitId||form.unitId});}}><option value="">Selecione</option>{contents.filter((item:Content)=>['Publicado','Mensurado','Agendado'].includes(item.status||'')).map((item:Content)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><Field label="Unidade"><select className={fieldClass} value={form.unitId} onChange={e=>setForm({...form,unitId:e.target.value})}><option value="ALL">Todas as unidades</option>{units.map((item:any)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Plataforma / formato"><input className={fieldClass} value={`${selected?.platform||form.platform} · ${selected?.format||form.format}`} readOnly/></Field>{[['reach','Alcance'],['views','Visualizações'],['likes','Curtidas'],['comments','Comentários'],['shares','Compartilhamentos'],['saves','Salvamentos'],['profileClicks','Cliques no perfil'],['whatsappClicks','Cliques no WhatsApp'],['linkClicks','Cliques em links'],['followersGained','Novos seguidores'],['appointments','Agendamentos'],['revenue','Receita atribuída']].map(([key,label])=><Num key={key} label={label} value={form[key]} onChange={value=>setForm({...form,[key]:value})}/>)}</ModalShell>}
function Stat({label,value}:{label:string;value:string}){return <div className="text-left sm:text-right"><span className="block text-[9px] font-bold uppercase text-gray-400">{label}</span><strong className="text-xs">{value}</strong></div>}

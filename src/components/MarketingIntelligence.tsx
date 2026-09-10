import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign, Download, Flag, Lightbulb, Target, TrendingUp, Users } from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../store';
import { AppBadge, AppButton, AppCard, AppEmptyState, AppSectionHeader, appControlClass } from './ui/AppPrimitives';
import { scopedCollectionQuery } from '../services/firestoreScope';

type Campaign = {
  id:string; name:string; unitId?:string; status?:string; budget?:number; startDate?:string; endDate?:string;
  goals?:{leads?:number;appointments?:number;sales?:number;revenue?:number};
};
type Traffic = {campaignId:string;unitId?:string;date?:string;platform?:string;investment?:number;otherCosts?:number;leads?:number;appointments?:number;newClients?:number;revenue?:number};
type Organic = {contentId:string;unitId?:string;date?:string;platform?:string;reach?:number;likes?:number;comments?:number;shares?:number;saves?:number;appointments?:number;revenue?:number};
type Post = {id:string;title?:string;status?:string;unitId?:string;dueDate?:string;scheduledDate?:string;campaignId?:string;assignedUsers?:string[];stageAssignments?:Record<string,string>};

const currentPeriod=()=>new Date().toISOString().slice(0,7);
const safe=(value:unknown)=>Number(value)||0;
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=(value:number)=>value.toLocaleString('pt-BR');
const ratio=(value:number,base:number)=>base>0?value/base:0;
const csvCell=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;

export function MarketingIntelligence(){
  const {systemUnits,users,currentUser}=useStore();
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [traffic,setTraffic]=useState<Traffic[]>([]);
  const [organic,setOrganic]=useState<Organic[]>([]);
  const [posts,setPosts]=useState<Post[]>([]);
  const [period,setPeriod]=useState(currentPeriod());
  const [unit,setUnit]=useState('ALL');

  useEffect(()=>onSnapshot(scopedCollectionQuery('marketing_campaigns',currentUser),snapshot=>setCampaigns(snapshot.docs.map(item=>({id:item.id,...item.data()} as Campaign)))),[currentUser]);
  useEffect(()=>onSnapshot(scopedCollectionQuery('marketing_traffic',currentUser),snapshot=>setTraffic(snapshot.docs.map(item=>item.data() as Traffic))),[currentUser]);
  useEffect(()=>onSnapshot(scopedCollectionQuery('marketing_organic',currentUser),snapshot=>setOrganic(snapshot.docs.map(item=>item.data() as Organic))),[currentUser]);
  useEffect(()=>onSnapshot(scopedCollectionQuery('social_posts',currentUser),snapshot=>setPosts(snapshot.docs.map(item=>({id:item.id,...item.data()} as Post)))),[currentUser]);

  const inUnit=(unitId?:string)=>unit==='ALL'||unitId===unit||unitId==='ALL'||!unitId;
  const periodTraffic=traffic.filter(item=>item.date?.startsWith(period)&&inUnit(item.unitId));
  const periodOrganic=organic.filter(item=>item.date?.startsWith(period)&&inUnit(item.unitId));
  const periodPosts=posts.filter(item=>(item.scheduledDate||item.dueDate)?.startsWith(period)&&inUnit(item.unitId));
  const activeCampaigns=campaigns.filter(item=>item.status==='ATIVA'&&inUnit(item.unitId));
  const sum=<T,>(list:T[],read:(item:T)=>unknown)=>list.reduce((total,item)=>total+safe(read(item)),0);
  const paidCost=sum(periodTraffic,item=>safe(item.investment)+safe(item.otherCosts));
  const paidRevenue=sum(periodTraffic,item=>item.revenue);
  const organicRevenue=sum(periodOrganic,item=>item.revenue);
  const paidAppointments=sum(periodTraffic,item=>item.appointments);
  const organicAppointments=sum(periodOrganic,item=>item.appointments);
  const newClients=sum(periodTraffic,item=>item.newClients);
  const published=periodPosts.filter(item=>['Publicado','Mensurado'].includes(item.status||'')).length;
  const completedOnTime=periodPosts.filter(item=>['Publicado','Mensurado'].includes(item.status||'')&&(!item.dueDate||!item.scheduledDate||item.scheduledDate<=item.dueDate)).length;
  const roas=ratio(paidRevenue,paidCost);
  const cac=ratio(paidCost,newClients);
  const today=new Date().toISOString().slice(0,10);
  const overdue=posts.filter(item=>inUnit(item.unitId)&&(item.dueDate||item.scheduledDate)&&String(item.dueDate||item.scheduledDate)<today&&!['Publicado','Mensurado','Cancelado'].includes(item.status||''));

  const campaignRows=useMemo(()=>campaigns.filter(item=>inUnit(item.unitId)&&((item.startDate||'').slice(0,7)<=period&&(item.endDate||'').slice(0,7)>=period)).map(item=>{
    const rows=periodTraffic.filter(record=>record.campaignId===item.id);
    const cost=sum(rows,record=>safe(record.investment)+safe(record.otherCosts));
    return {...item,cost,leads:sum(rows,record=>record.leads),appointments:sum(rows,record=>record.appointments),clients:sum(rows,record=>record.newClients),revenue:sum(rows,record=>record.revenue)};
  }).sort((a,b)=>b.revenue-a.revenue),[campaigns,periodTraffic,period,unit]);

  const channelRows=useMemo(()=>{
    const grouped=new Map<string,{name:string;cost:number;reach:number;appointments:number;revenue:number}>();
    periodTraffic.forEach(item=>{const name=item.platform||'Tráfego sem canal';const row=grouped.get(name)||{name,cost:0,reach:0,appointments:0,revenue:0};row.cost+=safe(item.investment)+safe(item.otherCosts);row.appointments+=safe(item.appointments);row.revenue+=safe(item.revenue);grouped.set(name,row);});
    periodOrganic.forEach(item=>{const name=item.platform||'Orgânico sem canal';const row=grouped.get(name)||{name,cost:0,reach:0,appointments:0,revenue:0};row.reach+=safe(item.reach);row.appointments+=safe(item.appointments);row.revenue+=safe(item.revenue);grouped.set(name,row);});
    return [...grouped.values()].sort((a,b)=>b.revenue-a.revenue);
  },[periodTraffic,periodOrganic]);

  const workload=useMemo(()=>{
    const map=new Map<string,{id:string;tasks:number;overdue:number}>();
    posts.filter(item=>inUnit(item.unitId)&&!['Publicado','Mensurado','Cancelado'].includes(item.status||'')).forEach(item=>{
      const ids=new Set([...(item.assignedUsers||[]),...Object.values(item.stageAssignments||{})].filter(Boolean));
      ids.forEach(id=>{const row=map.get(id)||{id,tasks:0,overdue:0};row.tasks++;if((item.dueDate||item.scheduledDate)&&String(item.dueDate||item.scheduledDate)<today)row.overdue++;map.set(id,row);});
    });
    return [...map.values()].sort((a,b)=>b.tasks-a.tasks);
  },[posts,unit]);

  const alerts:string[]=[];
  if(overdue.length)alerts.push(`${overdue.length} produção(ões) estão atrasadas.`);
  activeCampaigns.forEach(item=>{const rows=periodTraffic.filter(record=>record.campaignId===item.id);if(!rows.length)alerts.push(`A campanha “${item.name}” está ativa, mas não possui métricas no período.`);});
  campaignRows.forEach(item=>{if(item.cost>0&&item.revenue/item.cost<1)alerts.push(`A campanha “${item.name}” está com retorno abaixo do investimento.`);});
  const measuredIds=new Set(periodOrganic.map(item=>item.contentId));
  const missingMetrics=periodPosts.filter(item=>['Publicado','Mensurado'].includes(item.status||'')&&!measuredIds.has(item.id));
  if(missingMetrics.length)alerts.push(`${missingMetrics.length} conteúdo(s) publicado(s) ainda não possuem métricas registradas.`);

  const insights=[
    roas>=2?`O tráfego retornou ${roas.toFixed(2)} vezes o valor investido.`:paidCost?`O ROAS está em ${roas.toFixed(2)}x; revise segmentação, criativos e oferta.`:'Registre investimentos e receita para acompanhar o retorno do tráfego.',
    organicAppointments?`O conteúdo orgânico gerou ${number(organicAppointments)} agendamento(s) e ${money(organicRevenue)} em receita atribuída.`:'Ainda não há conversões orgânicas registradas neste período.',
    periodPosts.length?`${Math.round(ratio(completedOnTime,published)*100)}% das publicações concluídas foram entregues dentro do prazo.`:'Não há publicações previstas para o período selecionado.',
  ];

  const exportReport=()=>{
    const lines=[['Relatório de marketing',period],['Unidade',unit==='ALL'?'Todas as unidades':systemUnits.find(item=>item.id===unit)?.name||unit],[],['Indicador','Valor'],['Investimento',paidCost],['Receita paga',paidRevenue],['Receita orgânica',organicRevenue],['ROAS',roas.toFixed(2)],['CAC',cac],['Agendamentos',paidAppointments+organicAppointments],[],['Campanha','Investimento','Leads','Agendamentos','Clientes','Receita'],...campaignRows.map(item=>[item.name,item.cost,item.leads,item.appointments,item.clients,item.revenue])];
    const csv=lines.map(line=>line.map(csvCell).join(';')).join('\r\n');
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));link.download=`marketing-${period}.csv`;link.click();URL.revokeObjectURL(link.href);
  };

  return <div className="space-y-5">
    <AppSectionHeader title="Inteligência gerencial" description="Visão consolidada de campanhas, produção, tráfego, conteúdo e equipe." actions={<AppButton onClick={exportReport}><Download className="h-4 w-4"/>Exportar relatório</AppButton>}/>
    <div className="flex flex-col gap-2 sm:flex-row"><input type="month" aria-label="Período do relatório" value={period} onChange={event=>setPeriod(event.target.value)} className={appControlClass}/><select aria-label="Unidade do relatório" value={unit} onChange={event=>setUnit(event.target.value)} className={appControlClass}><option value="ALL">Todas as unidades</option>{systemUnits.filter(item=>item.isActive!==false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Investimento" value={money(paidCost)} detail={`${activeCampaigns.length} campanhas ativas`} icon={CircleDollarSign}/>
      <Metric label="Receita atribuída" value={money(paidRevenue+organicRevenue)} detail={`ROAS pago ${roas.toFixed(2)}x`} icon={TrendingUp}/>
      <Metric label="Conversões" value={number(paidAppointments+organicAppointments)} detail={`${number(newClients)} clientes novos`} icon={Target}/>
      <Metric label="Produção entregue" value={number(published)} detail={`${periodPosts.length} pautas no período`} icon={CheckCircle2}/>
    </div>
    {alerts.length>0&&<AppCard className="border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-500"/><div><strong className="text-sm">Pontos que precisam de atenção</strong><ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">{alerts.map(item=><li key={item}>• {item}</li>)}</ul></div></div></AppCard>}
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Metas versus realizado" description="Acompanhamento das campanhas que atravessam o período selecionado."/><div className="mt-4 space-y-4">{campaignRows.length?campaignRows.map(item=><CampaignProgress key={item.id} item={item}/>):<AppEmptyState icon={<Flag/>} title="Nenhuma campanha no período" description="Cadastre uma campanha com metas para acompanhar sua execução."/>}</div></AppCard>
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Resumo executivo" description="Leitura automática dos dados conectados."/><div className="mt-4 space-y-3">{insights.map(item=><div key={item} className="flex gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-zinc-800/60"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/><span>{item}</span></div>)}</div></AppCard>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Desempenho por canal" description="Receita e conversões de mídia paga e conteúdo orgânico."/><div className="mt-4 space-y-3">{channelRows.length?channelRows.map(item=><div key={item.name} className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center"><strong className="col-span-2 text-sm sm:col-span-1">{item.name}</strong><SmallStat label="Investimento" value={money(item.cost)}/><SmallStat label="Agendamentos" value={number(item.appointments)}/><SmallStat label="Receita" value={money(item.revenue)}/></div>):<p className="py-8 text-center text-sm text-gray-400">Nenhum canal possui resultados no período.</p>}</div></AppCard>
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Carga da equipe" description="Tarefas abertas e atrasos por responsável."/><div className="mt-4 space-y-3">{workload.length?workload.map(item=><div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)]"><Users className="h-4 w-4"/></span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{users.find(user=>user.id===item.id)?.name||'Colaborador'}</strong><span className="text-xs text-gray-400">{item.tasks} tarefa(s) aberta(s)</span></div><AppBadge tone={item.overdue?'danger':'success'}>{item.overdue?`${item.overdue} atrasada(s)`:'Em dia'}</AppBadge></div>):<p className="py-8 text-center text-sm text-gray-400">Nenhuma tarefa atribuída está aberta.</p>}</div></AppCard>
    </div>
  </div>;
}

function Metric({label,value,detail,icon:Icon}:{label:string;value:string;detail:string;icon:React.ComponentType<{className?:string}>}){return <AppCard className="p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-zinc-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{detail}</p></div><span className="h-fit rounded-xl bg-[var(--theme-color)]/10 p-2.5 text-[var(--theme-color)]"><Icon className="h-5 w-5"/></span></div></AppCard>}
function SmallStat({label,value}:{label:string;value:string}){return <div><span className="block text-[9px] font-bold uppercase text-gray-400">{label}</span><strong className="text-xs">{value}</strong></div>}
function CampaignProgress({item}:{item:Campaign&{cost:number;leads:number;appointments:number;clients:number;revenue:number}}){const rows:[string,number,number][]=[['Leads',item.leads,safe(item.goals?.leads)],['Agendamentos',item.appointments,safe(item.goals?.appointments)],['Clientes',item.clients,safe(item.goals?.sales)],['Receita',item.revenue,safe(item.goals?.revenue)]];return <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-800"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.name}</strong><AppBadge tone={item.status==='ATIVA'?'success':'neutral'}>{item.status||'Sem status'}</AppBadge></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label,value,goal])=><div key={label}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{label==='Receita'?money(value):number(value)} / {label==='Receita'?money(goal):number(goal)}</strong></div><div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[var(--theme-color)]" style={{width:`${goal?Math.min(100,value/goal*100):0}%`}}/></div></div>)}</div></div>}

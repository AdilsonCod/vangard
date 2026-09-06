import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDollarSign, Edit3, Flag, Megaphone, Plus, Target, Trash2, Users, X } from 'lucide-react';
import { db } from '../firebase';
import { useStore } from '../store';
import { AppBadge, AppButton, AppCard, AppEmptyState, AppSectionHeader, appControlClass } from './ui/AppPrimitives';

export type MarketingCampaignStatus = 'PLANEJADA' | 'ATIVA' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA';

export interface MarketingCampaign {
  id: string;
  name: string;
  objective: string;
  audience: string;
  unitId: string;
  channels: string[];
  startDate: string;
  endDate: string;
  budget: number;
  status: MarketingCampaignStatus;
  responsibleIds: string[];
  goals: { leads: number; appointments: number; sales: number; revenue: number };
  notes: string;
  createdAt: string;
}

type SocialPostSummary = {
  id: string;
  title: string;
  status: string;
  scheduledDate?: string;
  dueDate?: string;
  campaignId?: string;
  assignedUsers?: string[];
};

const STATUS_LABELS: Record<MarketingCampaignStatus, string> = {
  PLANEJADA: 'Planejada', ATIVA: 'Ativa', PAUSADA: 'Pausada', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};
const CHANNELS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Google', 'WhatsApp', 'E-mail', 'Offline'];
const emptyCampaign = (): Omit<MarketingCampaign, 'id'> => ({
  name: '', objective: 'Aquisição de clientes', audience: '', unitId: 'ALL', channels: ['Instagram'], startDate: '', endDate: '', budget: 0,
  status: 'PLANEJADA', responsibleIds: [], goals: { leads: 0, appointments: 0, sales: 0, revenue: 0 }, notes: '', createdAt: new Date().toISOString(),
});

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = (value?: string) => value ? value.split('-').reverse().join('/') : 'Sem data';

export function MarketingOperations({ view, onNavigate }: { view: 'OVERVIEW' | 'CAMPAIGNS'; onNavigate: (view: 'CAMPAIGNS' | 'PRODUCTION') => void }) {
  const { systemUnits, users } = useStore();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => onSnapshot(collection(db, 'marketing_campaigns'), snapshot => {
    setCampaigns(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as MarketingCampaign)));
  }), []);
  useEffect(() => onSnapshot(collection(db, 'social_posts'), snapshot => {
    setPosts(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SocialPostSummary)));
  }), []);

  const activeCampaigns = campaigns.filter(item => item.status === 'ATIVA');
  const overduePosts = posts.filter(item => (item.dueDate || item.scheduledDate) && String(item.dueDate || item.scheduledDate) < today && !['Publicado', 'Mensurado', 'Cancelado'].includes(item.status));
  const approvalPosts = posts.filter(item => ['Aprovação', 'Revisão'].includes(item.status));
  const productionPosts = posts.filter(item => !['Publicado', 'Mensurado', 'Cancelado'].includes(item.status));
  const activeBudget = activeCampaigns.reduce((total, item) => total + (Number(item.budget) || 0), 0);
  const upcoming = posts.filter(item => item.scheduledDate && item.scheduledDate >= today && !['Publicado', 'Cancelado'].includes(item.status)).sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate))).slice(0, 6);
  const unlinked = posts.filter(item => !item.campaignId && !['Publicado', 'Cancelado'].includes(item.status));

  const unitName = (id: string) => id === 'ALL' ? 'Todas as unidades' : systemUnits.find(unit => unit.id === id)?.name || 'Unidade não encontrada';
  const userName = (id: string) => users.find(user => user.id === id)?.name || 'Responsável não encontrado';
  const openNew = () => { setError(''); setEditing({ id: '', ...emptyCampaign() }); };
  const save = async () => {
    if (!editing?.name.trim() || !editing.startDate || !editing.endDate) { setError('Informe nome, data inicial e data final da campanha.'); return; }
    if (editing.endDate < editing.startDate) { setError('A data final deve ser igual ou posterior à data inicial.'); return; }
    setSaving(true); setError('');
    try {
      const { id, ...data } = editing;
      const clean = { ...data, name: data.name.trim(), audience: data.audience.trim(), objective: data.objective.trim(), budget: Number(data.budget) || 0, goals: { leads: Number(data.goals.leads) || 0, appointments: Number(data.goals.appointments) || 0, sales: Number(data.goals.sales) || 0, revenue: Number(data.goals.revenue) || 0 } };
      if (id) await updateDoc(doc(db, 'marketing_campaigns', id), clean);
      else await addDoc(collection(db, 'marketing_campaigns'), clean);
      setEditing(null);
    } catch (reason) { console.error(reason); setError('Não foi possível salvar a campanha. Verifique a conexão e tente novamente.'); }
    finally { setSaving(false); }
  };

  if (view === 'OVERVIEW') return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Campanhas ativas', value: activeCampaigns.length, detail: `${campaigns.filter(item => item.status === 'PLANEJADA').length} planejadas`, icon: Megaphone, tone: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Conteúdos em produção', value: productionPosts.length, detail: `${approvalPosts.length} aguardando aprovação`, icon: Flag, tone: 'text-blue-600 dark:text-blue-400' },
        { label: 'Entregas atrasadas', value: overduePosts.length, detail: overduePosts.length ? 'Precisam de atenção' : 'Fluxo dentro do prazo', icon: AlertTriangle, tone: overduePosts.length ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Orçamento ativo', value: money(activeBudget), detail: 'Campanhas atualmente ativas', icon: CircleDollarSign, tone: 'text-amber-600 dark:text-amber-400' },
      ].map(card => <AppCard key={card.label} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">{card.label}</p><p className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{card.value}</p><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{card.detail}</p></div><span className={`rounded-xl bg-gray-100 p-2.5 dark:bg-zinc-800 ${card.tone}`}><card.icon className="h-5 w-5" /></span></div></AppCard>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Prioridades da equipe" description="Itens que exigem ação para manter o planejamento no prazo." />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button onClick={() => onNavigate('PRODUCTION')} className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-[var(--theme-color)] dark:border-zinc-800"><AlertTriangle className="h-5 w-5 text-red-500"/><strong className="mt-3 block text-xl">{overduePosts.length}</strong><span className="text-xs text-gray-500 dark:text-zinc-400">Conteúdos atrasados</span></button>
          <button onClick={() => onNavigate('PRODUCTION')} className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-[var(--theme-color)] dark:border-zinc-800"><CheckCircle2 className="h-5 w-5 text-amber-500"/><strong className="mt-3 block text-xl">{approvalPosts.length}</strong><span className="text-xs text-gray-500 dark:text-zinc-400">Aguardando aprovação</span></button>
          <button onClick={() => onNavigate('CAMPAIGNS')} className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-[var(--theme-color)] dark:border-zinc-800"><Target className="h-5 w-5 text-[var(--theme-color)]"/><strong className="mt-3 block text-xl">{unlinked.length}</strong><span className="text-xs text-gray-500 dark:text-zinc-400">Pautas sem campanha</span></button>
        </div>
      </AppCard>
      <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Próximas publicações" description="Agenda mais próxima da equipe." />
        <div className="mt-4 space-y-2">{upcoming.length ? upcoming.map(post => <div key={post.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-zinc-800/60"><CalendarDays className="h-4 w-4 shrink-0 text-[var(--theme-color)]"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{post.title}</p><p className="text-xs text-gray-500 dark:text-zinc-400">{shortDate(post.scheduledDate)} · {post.status}</p></div></div>) : <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Nenhuma publicação agendada.</p>}</div>
      </AppCard>
    </div>
    <AppCard className="p-4 sm:p-5"><AppSectionHeader title="Campanhas em andamento" description="Planejamento, unidade e metas financeiras em um só lugar." actions={<AppButton variant="primary" onClick={() => onNavigate('CAMPAIGNS')}>Ver campanhas</AppButton>} />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">{activeCampaigns.length ? activeCampaigns.slice(0, 3).map(item => <CampaignCard key={item.id} campaign={item} unitName={unitName} userName={userName} onEdit={() => onNavigate('CAMPAIGNS')} />) : <div className="lg:col-span-3"><AppEmptyState icon={<Megaphone/>} title="Nenhuma campanha ativa" description="Cadastre uma campanha e marque-a como ativa para acompanhar a operação." action={<AppButton onClick={() => onNavigate('CAMPAIGNS')}>Criar campanha</AppButton>} /></div>}</div>
    </AppCard>
  </div>;

  return <div className="space-y-5">
    <AppSectionHeader title="Planejamento de campanhas" description="Organize objetivos, período, público, orçamento, metas, unidades e responsáveis." actions={<AppButton variant="primary" onClick={openNew}><Plus className="h-4 w-4"/>Nova campanha</AppButton>} />
    {campaigns.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{campaigns.slice().sort((a,b) => b.startDate.localeCompare(a.startDate)).map(item => <CampaignCard key={item.id} campaign={item} unitName={unitName} userName={userName} onEdit={() => setEditing(item)} />)}</div> : <AppEmptyState icon={<Megaphone/>} title="Nenhuma campanha cadastrada" description="Crie o primeiro planejamento para conectar equipe, produção, orçamento e metas." action={<AppButton variant="primary" onClick={openNew}>Criar campanha</AppButton>} />}

    {editing && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-zinc-800 sm:px-6"><div><p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-color)]">Planejamento</p><h2 className="text-xl font-black">{editing.id ? 'Editar campanha' : 'Nova campanha'}</h2></div><button onClick={() => setEditing(null)} className="rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X/></button></div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-6">
          <Field label="Nome da campanha" wide><input className={appControlClass + ' w-full'} value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})} placeholder="Ex.: Agenda cheia em setembro"/></Field>
          <Field label="Objetivo"><select className={appControlClass + ' w-full'} value={editing.objective} onChange={e => setEditing({...editing,objective:e.target.value})}>{['Aquisição de clientes','Retenção e retorno','Venda de assinaturas','Venda de produtos','Reconhecimento da marca','Ocupação de horários'].map(item=><option key={item}>{item}</option>)}</select></Field>
          <Field label="Unidade"><select className={appControlClass + ' w-full'} value={editing.unitId} onChange={e => setEditing({...editing,unitId:e.target.value})}><option value="ALL">Todas as unidades</option>{systemUnits.filter(item => item.isActive !== false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Data inicial"><input type="date" className={appControlClass + ' w-full'} value={editing.startDate} onChange={e => setEditing({...editing,startDate:e.target.value})}/></Field>
          <Field label="Data final"><input type="date" className={appControlClass + ' w-full'} value={editing.endDate} onChange={e => setEditing({...editing,endDate:e.target.value})}/></Field>
          <Field label="Status"><select className={appControlClass + ' w-full'} value={editing.status} onChange={e => setEditing({...editing,status:e.target.value as MarketingCampaignStatus})}>{Object.entries(STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Orçamento"><input type="number" min="0" step="0.01" className={appControlClass + ' w-full'} value={editing.budget} onChange={e => setEditing({...editing,budget:Number(e.target.value)})}/></Field>
          <Field label="Público-alvo" wide><input className={appControlClass + ' w-full'} value={editing.audience} onChange={e => setEditing({...editing,audience:e.target.value})} placeholder="Ex.: Homens de 25–45 anos próximos à unidade"/></Field>
          <Field label="Canais" wide><div className="flex flex-wrap gap-2">{CHANNELS.map(channel=><button type="button" key={channel} onClick={() => setEditing({...editing,channels:editing.channels.includes(channel)?editing.channels.filter(item=>item!==channel):[...editing.channels,channel]})} className={`rounded-lg border px-3 py-2 text-xs font-bold ${editing.channels.includes(channel)?'border-[var(--theme-color)] bg-[var(--theme-color)]/10 text-[var(--theme-color)]':'border-gray-200 dark:border-zinc-700'}`}>{channel}</button>)}</div></Field>
          <Field label="Metas" wide><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([['leads','Leads'],['appointments','Agendamentos'],['sales','Vendas'],['revenue','Receita (R$)']] as const).map(([key,label])=><label key={key} className="text-xs text-gray-500 dark:text-zinc-400">{label}<input type="number" min="0" step={key==='revenue'?'0.01':'1'} className={appControlClass+' mt-1 w-full'} value={editing.goals[key]} onChange={e=>setEditing({...editing,goals:{...editing.goals,[key]:Number(e.target.value)}})}/></label>)}</div></Field>
          <Field label="Equipe responsável" wide><div className="flex flex-wrap gap-2">{users.filter(user => ['ADMIN','MARKETING'].includes(user.role)).map(user=><button type="button" key={user.id} onClick={()=>setEditing({...editing,responsibleIds:editing.responsibleIds.includes(user.id)?editing.responsibleIds.filter(id=>id!==user.id):[...editing.responsibleIds,user.id]})} className={`rounded-lg border px-3 py-2 text-xs font-bold ${editing.responsibleIds.includes(user.id)?'border-[var(--theme-color)] bg-[var(--theme-color)]/10 text-[var(--theme-color)]':'border-gray-200 dark:border-zinc-700'}`}>{user.name}</button>)}</div></Field>
          <Field label="Observações" wide><textarea className="min-h-24 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-950" value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
          {error && <p className="sm:col-span-2 text-sm font-bold text-red-500">{error}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 p-4 dark:border-zinc-800 sm:flex-row sm:justify-between sm:px-6">{editing.id ? <AppButton variant="danger" onClick={async()=>{if(confirm('Excluir esta campanha?')){await deleteDoc(doc(db,'marketing_campaigns',editing.id));setEditing(null);}}}><Trash2 className="h-4 w-4"/>Excluir</AppButton>:<span/>}<div className="flex gap-2"><AppButton onClick={()=>setEditing(null)}>Cancelar</AppButton><AppButton variant="primary" disabled={saving} onClick={save}>{saving?'Salvando...':'Salvar campanha'}</AppButton></div></div>
      </div>
    </div>}
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-zinc-300">{label}</span>{children}</label>; }

function CampaignCard({ campaign, unitName, userName, onEdit }: { campaign: MarketingCampaign; unitName:(id:string)=>string; userName:(id:string)=>string; onEdit:()=>void }) {
  const duration = Math.max(1, new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime());
  const progress = Math.max(0, Math.min(100, ((Date.now() - new Date(campaign.startDate).getTime()) / duration) * 100));
  const tone = campaign.status === 'ATIVA' ? 'success' : campaign.status === 'PAUSADA' ? 'warning' : campaign.status === 'CANCELADA' ? 'danger' : campaign.status === 'CONCLUIDA' ? 'info' : 'neutral';
  return <AppCard className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><AppBadge tone={tone}>{STATUS_LABELS[campaign.status]}</AppBadge><h3 className="mt-3 truncate text-base font-black">{campaign.name}</h3><p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{campaign.objective} · {unitName(campaign.unitId)}</p></div><button onClick={onEdit} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[var(--theme-color)] dark:hover:bg-zinc-800" aria-label="Editar campanha"><Edit3 className="h-4 w-4"/></button></div>
    <div className="mt-4 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[var(--theme-color)]" style={{width:`${campaign.status==='CONCLUIDA'?100:progress}%`}}/></div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-zinc-400"><span><CalendarDays className="mr-1 inline h-3.5 w-3.5"/>{shortDate(campaign.startDate)}–{shortDate(campaign.endDate)}</span><span><CircleDollarSign className="mr-1 inline h-3.5 w-3.5"/>{money(Number(campaign.budget)||0)}</span><span><Users className="mr-1 inline h-3.5 w-3.5"/>{campaign.responsibleIds.length?campaign.responsibleIds.map(userName).join(', '):'Sem responsável'}</span></div>
    <div className="mt-4 grid grid-cols-4 gap-2 border-t border-gray-100 pt-3 text-center dark:border-zinc-800">{[['Leads',campaign.goals?.leads||0],['Agenda',campaign.goals?.appointments||0],['Vendas',campaign.goals?.sales||0],['Receita',money(campaign.goals?.revenue||0)]].map(([label,value])=><div key={label}><strong className="block text-xs">{value}</strong><span className="text-[10px] text-gray-400">{label}</span></div>)}</div>
  </AppCard>;
}

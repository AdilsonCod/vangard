import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query } from 'firebase/firestore';
import { Plus, GripVertical, Trash2, Calendar, Youtube, Instagram, Twitter, MessageCircle, X, Sparkles, Loader2, LayoutGrid, Library, CheckSquare, Clock, Filter, UserRoundCheck, History, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { SystemUnit, User } from '../types';
import { authenticatedApi } from '../services/apiClient';

type PostStatus = 'Ideia' | 'Briefing' | 'Roteiro' | 'Aprovação' | 'Gravação' | 'Edição' | 'Revisão' | 'Agendado' | 'Publicado' | 'Mensurado' | 'Cancelado';
type PostPriority = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';

const STATUSES: PostStatus[] = ['Ideia', 'Briefing', 'Roteiro', 'Aprovação', 'Gravação', 'Edição', 'Revisão', 'Agendado', 'Publicado', 'Mensurado'];
const ALL_STATUSES: PostStatus[] = [...STATUSES, 'Cancelado'];
const PRIORITY_LABELS: Record<PostPriority, string> = { BAIXA: 'Baixa', NORMAL: 'Normal', ALTA: 'Alta', URGENTE: 'Urgente' };

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Twitter', 'Outros'];
const FORMATS = ['Reels', 'Story', 'Carrossel', 'Vídeo Longo', 'Post Estático'];

export interface SocialPost {
  id: string;
  title: string;
  description: string;
  status: PostStatus;
  platform: string;
  format: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedUsers: string[]; // user IDs
  externalLinks: string;
  campaignId?: string;
  unitId: string;
  dueDate: string;
  priority: PostPriority;
  caption: string;
  cta: string;
  stageAssignments: Partial<Record<PostStatus, string>>;
  checklist: { id: string; label: string; done: boolean }[];
  comments: { id: string; text: string; authorId: string; authorName: string; createdAt: string }[];
  history: { id: string; action: string; authorName: string; createdAt: string }[];
  approvedAt?: string;
  approvedBy?: string;
}

type CampaignOption = { id: string; name: string; status?: string };

const normalizePost = (post: Partial<SocialPost> & { id: string }): SocialPost => ({
  id: post.id,
  title: post.title || '',
  description: post.description || '',
  status: (post.status as string) === 'Roteirização' ? 'Roteiro' : (post.status || 'Ideia'),
  platform: post.platform || 'Instagram',
  format: post.format || 'Reels',
  scheduledDate: post.scheduledDate || '',
  scheduledTime: post.scheduledTime || '',
  assignedUsers: Array.isArray(post.assignedUsers) ? post.assignedUsers : [],
  externalLinks: post.externalLinks || '',
  campaignId: post.campaignId || '',
  unitId: post.unitId || 'ALL',
  dueDate: post.dueDate || post.scheduledDate || '',
  priority: post.priority || 'NORMAL',
  caption: post.caption || '',
  cta: post.cta || '',
  stageAssignments: post.stageAssignments || {},
  checklist: Array.isArray(post.checklist) ? post.checklist : [],
  comments: Array.isArray(post.comments) ? post.comments : [],
  history: Array.isArray(post.history) ? post.history : [],
  approvedAt: post.approvedAt || '',
  approvedBy: post.approvedBy || '',
});

export function SocialMediaBoard({ initialTab = 'KANBAN', hideTabs = false }: { initialTab?: 'KANBAN' | 'CALENDAR' | 'LIBRARY'; hideTabs?: boolean }) {
  const [activeTab, setActiveTab] = useState<'KANBAN' | 'CALENDAR' | 'LIBRARY'>(initialTab);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [scope, setScope] = useState<'ALL' | 'MINE'>('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const { users, systemUnits, currentUser } = useStore();

  useEffect(() => {
    const q = query(collection(db, 'social_posts'));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: SocialPost[] = [];
      snap.forEach(doc => {
        loaded.push(normalizePost({ id: doc.id, ...doc.data() } as SocialPost));
      });
      setPosts(loaded);
    });
    return () => unsub();
  }, []);

  useEffect(() => onSnapshot(collection(db, 'marketing_campaigns'), snap => {
    setCampaigns(snap.docs.map(item => ({ id: item.id, ...item.data() } as CampaignOption)));
  }), []);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const visiblePosts = posts.filter(post => {
    const matchesUnit = unitFilter === 'ALL' || post.unitId === 'ALL' || post.unitId === unitFilter;
    const stageOwner = Object.values(post.stageAssignments || {}).includes(currentUser?.id || '');
    const matchesOwner = scope === 'ALL' || post.assignedUsers.includes(currentUser?.id || '') || stageOwner;
    return matchesUnit && matchesOwner;
  });
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = visiblePosts.filter(post => post.dueDate && post.dueDate < today && !['Publicado', 'Mensurado', 'Cancelado'].includes(post.status)).length;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: PostStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      try {
        const postRef = doc(db, 'social_posts', id);
        const current = posts.find(post => post.id === id);
        await updateDoc(postRef, {
          status,
          history: [...(current?.history || []), { id: crypto.randomUUID(), action: `Moveu de ${current?.status || 'etapa anterior'} para ${status}`, authorName: currentUser?.name || 'Equipe', createdAt: new Date().toISOString() }],
        });
      } catch (error) {
        console.error("Failed to update post status", error);
      }
    }
  };

  const openForm = (post?: SocialPost) => {
    setEditingPost(post || {
      id: '',
      title: '',
      description: '',
      status: 'Ideia',
      platform: 'Instagram',
      format: 'Reels',
      scheduledDate: '',
      scheduledTime: '',
      assignedUsers: [],
      externalLinks: '',
      campaignId: '',
      unitId: currentUser?.unit || 'ALL',
      dueDate: '',
      priority: 'NORMAL',
      caption: '',
      cta: '',
      stageAssignments: {},
      checklist: [],
      comments: [],
      history: [],
    });
    setIsModalOpen(true);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'YouTube': return <Youtube className="w-3 h-3" />;
      case 'Instagram': return <Instagram className="w-3 h-3" />;
      case 'TikTok': return <MessageCircle className="w-3 h-3" />;
      case 'Twitter': return <Twitter className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              Gestão de Conteúdo e Audiência
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Gerencie pautas, biblioteca de inspirações, calendário e metas.
            </p>
          </div>
          <button 
            onClick={() => openForm()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-color)] px-4 py-2 font-bold text-white shadow-sm transition hover:bg-[var(--theme-color-strong)] sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Nova Pauta
          </button>
        </div>

        {activeTab !== 'LIBRARY' && <div className="mb-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-zinc-800">
            <button onClick={() => setScope('ALL')} className={`flex-1 rounded-md px-3 py-2 text-xs font-bold sm:flex-none ${scope === 'ALL' ? 'bg-white text-gray-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 dark:text-zinc-400'}`}>Toda a equipe</button>
            <button onClick={() => setScope('MINE')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold sm:flex-none ${scope === 'MINE' ? 'bg-white text-gray-950 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-gray-500 dark:text-zinc-400'}`}><UserRoundCheck className="h-3.5 w-3.5"/>Minhas tarefas</button>
          </div>
          <label className="relative min-w-0 flex-1 sm:max-w-64"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><select value={unitFilter} onChange={event => setUnitFilter(event.target.value)} className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none dark:border-zinc-700 dark:bg-zinc-900"><option value="ALL">Todas as unidades</option>{systemUnits.filter(unit => unit.isActive !== false).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          <span className={`rounded-lg px-3 py-2 text-xs font-bold ${overdueCount ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}><Clock className="mr-1.5 inline h-3.5 w-3.5"/>{overdueCount} atrasada{overdueCount === 1 ? '' : 's'}</span>
        </div>}
        
        {!hideTabs && <div className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('KANBAN')}
            className={`flex items-center gap-2 pb-2 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'KANBAN'
                ? "border-[var(--theme-color)] text-[var(--theme-color)]"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Board (Kanban)
          </button>
          <button
            onClick={() => setActiveTab('CALENDAR')}
            className={`flex items-center gap-2 pb-2 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'CALENDAR'
                ? "border-[var(--theme-color)] text-[var(--theme-color)]"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Calendar className="w-4 h-4" /> Calendário
          </button>
          <button
            onClick={() => setActiveTab('LIBRARY')}
            className={`flex items-center gap-2 pb-2 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'LIBRARY'
                ? "border-[var(--theme-color)] text-[var(--theme-color)]"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Library className="w-4 h-4" /> Referências & Links
          </button>

        </div>}
      </div>

      <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-zinc-800/30">
        {activeTab === 'KANBAN' && (
          <div className="flex min-h-[500px] flex-1 items-stretch gap-3 overflow-x-auto p-3 custom-scrollbar sm:min-h-[600px] sm:gap-4 sm:p-4">
            {ALL_STATUSES.map(status => {
              const columnPosts = visiblePosts.filter(p => p.status === status);
              
              return (
                <div 
                  key={status}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                className="flex h-full min-h-[150px] w-[calc(100vw-4.5rem)] max-w-72 shrink-0 snap-center flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/80"
                >
                  <div className="p-3 border-b border-gray-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-900/30 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-sm tracking-wide text-gray-700 dark:text-zinc-200 uppercase flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status === 'Publicado' ? 'bg-emerald-500' : status === 'Cancelado' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                      {status}
                    </h3>
                    <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 bg-gray-200 dark:bg-zinc-700/50 px-2 py-0.5 rounded-full">
                      {columnPosts.length}
                    </span>
                  </div>
                  
                  <div className="p-2 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                    {columnPosts.map(post => (
                      <div 
                        key={post.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, post.id)}
                        onClick={() => openForm(post)}
                        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 p-3 rounded-lg shadow-sm cursor-pointer hover:border-[var(--theme-color)] transition-colors group relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 px-1.5 py-0.5 rounded">
                              {getPlatformIcon(post.platform)}
                              {post.platform}
                            </span>
                            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 px-1.5 py-0.5 rounded">
                              {post.format}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-300 dark:text-zinc-600 cursor-grab active:cursor-grabbing hover:text-[var(--theme-color)] p-1">
                            <GripVertical className="w-4 h-4" />
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-sm mb-1 leading-tight">{post.title}</h4>
                        {post.campaignId && <p className="mb-2 truncate text-[10px] font-bold uppercase tracking-wide text-[var(--theme-color)]">{campaigns.find(item => item.id === post.campaignId)?.name || 'Campanha vinculada'}</p>}
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${post.priority === 'URGENTE' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : post.priority === 'ALTA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>{PRIORITY_LABELS[post.priority]}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">{post.unitId === 'ALL' ? 'Todas as unidades' : systemUnits.find(unit => unit.id === post.unitId)?.name || 'Unidade'}</span>
                        </div>
                        {post.dueDate && <p className={`mb-2 flex items-center gap-1 text-[10px] font-semibold ${post.dueDate < today && !['Publicado','Mensurado'].includes(post.status) ? 'text-red-500' : 'text-gray-500 dark:text-zinc-400'}`}><Clock className="h-3 w-3"/>Prazo {post.dueDate.split('-').reverse().join('/')}</p>}
                        {post.checklist.length > 0 && <div className="mb-2"><div className="mb-1 flex justify-between text-[9px] font-bold text-gray-400"><span>Checklist</span><span>{post.checklist.filter(item => item.done).length}/{post.checklist.length}</span></div><div className="h-1 rounded-full bg-gray-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-500" style={{width:`${post.checklist.filter(item => item.done).length / post.checklist.length * 100}%`}}/></div></div>}
                        
                        {post.scheduledDate && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 font-medium mb-3">
                            <Calendar className="w-3 h-3" />
                            {post.scheduledDate.split('-').reverse().join('/')} {post.scheduledTime && `às ${post.scheduledTime}`}
                          </div>
                        )}

                        {post.assignedUsers && post.assignedUsers.length > 0 && (
                          <div className="flex -space-x-1 mt-2">
                            {post.assignedUsers.map(uid => {
                              const u = users.find(x => x.id === uid);
                              return u ? (
                                <div key={uid} className="w-6 h-6 rounded-full bg-[var(--theme-color)] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-zinc-800 shadow-sm" title={u.name}>
                                  {u.name.substring(0, 2).toUpperCase()}
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'CALENDAR' && (
          <CalendarView posts={visiblePosts} getPlatformIcon={getPlatformIcon} onPostClick={openForm} />
        )}

        {activeTab === 'LIBRARY' && (
          <LibraryView />
        )}


      </div>

      {isModalOpen && editingPost && (
        <PostModal 
          post={editingPost} 
          onClose={() => setIsModalOpen(false)} 
          users={users}
          campaigns={campaigns}
          systemUnits={systemUnits}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function CalendarView({ posts, getPlatformIcon, onPostClick }: any) {
  // Simple list view grouped by date
  const scheduled = posts.filter((p: any) => p.scheduledDate).sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[var(--theme-color)]" /> Próximos Lançamentos (Cronograma)
      </h3>
      {scheduled.length === 0 ? (
        <div className="text-center p-12 text-gray-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800">
          Nenhum conteúdo agendado.
        </div>
      ) : (
        <div className="space-y-4">
          {scheduled.map((post: any) => (
            <div key={post.id} onClick={() => onPostClick(post)} className="flex cursor-pointer flex-col items-stretch gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[var(--theme-color)] dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-800 text-[var(--theme-color)] font-bold p-3 rounded-lg min-w-[70px]">
                <span className="text-2xl leading-none">{post.scheduledDate.split('-')[2]}</span>
                <span className="text-xs uppercase">{post.scheduledDate.split('-')[1]}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                    {getPlatformIcon(post.platform)} {post.platform}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${post.status === 'Publicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                    {post.status}
                  </span>
                </div>
                <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{post.title}</h4>
              </div>
              <div className="text-right text-sm font-bold text-gray-400 sm:text-left">
                {post.scheduledTime || '--:--'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryView() {
  const [links, setLinks] = useState<any[]>([]);
  const [newLink, setNewLink] = useState({ title: '', url: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'social_library'), snap => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const save = async () => {
    if (!newLink.title || !newLink.url) return;
    await addDoc(collection(db, 'social_library'), newLink);
    setNewLink({ title: '', url: '' });
  };

  const del = async (id: string) => {
    await deleteDoc(doc(db, 'social_library', id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Library className="w-5 h-5 text-[var(--theme-color)]" /> Biblioteca de Referências & Links
        </h3>
        
        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          <input className="flex-1 border p-2.5 rounded-lg text-sm font-medium bg-gray-50 dark:bg-zinc-800 outline-none" placeholder="Nome do link (Ex: Drive da Agência)" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} />
          <input className="flex-1 border p-2.5 rounded-lg text-sm font-medium bg-gray-50 dark:bg-zinc-800 outline-none" placeholder="URL" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} />
          <button onClick={save} className="rounded-lg bg-black px-4 py-2 font-bold text-white dark:bg-white dark:text-black">Salvar</button>
        </div>

        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">{l.title}</a>
              <button onClick={() => del(l.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {links.length === 0 && <p className="text-center text-sm text-gray-400 p-4">Nenhum link salvo ainda.</p>}
        </div>
      </div>
    </div>
  );
}

function PostModal({ post, onClose, users, campaigns, systemUnits, currentUser }: { post: SocialPost, onClose: () => void, users: User[], campaigns: CampaignOption[], systemUnits: SystemUnit[], currentUser: User | null }) {
  const [form, setForm] = useState<SocialPost>(normalizePost(post));
  const [loading, setLoading] = useState(false);
  const [newChecklist, setNewChecklist] = useState('');
  const [newComment, setNewComment] = useState('');

  const saveForm = async () => {
    if (!form.title) return alert("O título é obrigatório");
    setLoading(true);
    try {
      const changedStatus = post.id && post.status !== form.status;
      const event = { id: crypto.randomUUID(), action: changedStatus ? `Alterou a etapa de ${post.status} para ${form.status}` : post.id ? 'Atualizou a pauta' : 'Criou a pauta', authorName: currentUser?.name || 'Equipe', createdAt: new Date().toISOString() };
      const payload = { ...form, assignedUsers: form.assignedUsers || [], stageAssignments: form.stageAssignments || {}, checklist: form.checklist || [], comments: form.comments || [], history: [...(form.history || []), event] };
      if (form.id) {
        const ref = doc(db, 'social_posts', form.id);
        const { id, ...data } = payload;
        await updateDoc(ref, data);
      } else {
        const { id, ...data } = payload;
        await addDoc(collection(db, 'social_posts'), data);
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar pauta.");
    } finally {
      setLoading(false);
    }
  };

  const deleteMode = async () => {
    if (confirm("Deseja realmente excluir este card de conteúdo?")) {
      await deleteDoc(doc(db, 'social_posts', form.id));
      onClose();
    }
  };

  const toggleUser = (uid: string) => {
    if (form.assignedUsers.includes(uid)) {
      setForm({ ...form, assignedUsers: form.assignedUsers.filter(id => id !== uid) });
    } else {
      setForm({ ...form, assignedUsers: [...form.assignedUsers, uid] });
    }
  };

  const addChecklistItem = () => {
    const label = newChecklist.trim();
    if (!label) return;
    setForm({ ...form, checklist: [...form.checklist, { id: crypto.randomUUID(), label, done: false }] });
    setNewChecklist('');
  };

  const addComment = () => {
    const text = newComment.trim();
    if (!text) return;
    setForm({ ...form, comments: [...form.comments, { id: crypto.randomUUID(), text, authorId: currentUser?.id || '', authorName: currentUser?.name || 'Equipe', createdAt: new Date().toISOString() }] });
    setNewComment('');
  };

  const approve = () => setForm({
    ...form,
    status: 'Gravação',
    approvedAt: new Date().toISOString(),
    approvedBy: currentUser?.name || 'Gerência',
  });

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const handleGenerateIdea = async () => {
    if (!aiPrompt) return alert("Digite um tema para a IA gerar a ideia.");
    setAiGenerating(true);
    try {
      const data = await authenticatedApi.json<{ titulo?: string; roteiro?: string; plataforma?: string; formato?: string }>("/api/generate-post-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: aiPrompt })
      });
      if (data && data.titulo) {
        setForm({
          ...form,
          title: data.titulo,
          description: data.roteiro || "",
          platform: data.plataforma || "Instagram",
          format: data.formato || "Reels"
        });
      }
    } catch (e) {
      alert("Erro ao gerar com IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 sm:max-h-[92vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            {form.id ? 'Editar Pauta' : 'Nova Pauta de Conteúdo'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar sm:space-y-6 sm:p-6">
          {!form.id && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
              <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Gerador de Roteiros com IA
              </h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Mitos sobre calvície, Como cuidar da barba grande..."
                  className="flex-1 border border-purple-200 dark:border-purple-800/50 p-2.5 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm bg-white dark:bg-zinc-900 dark:text-white"
                />
                <button 
                  onClick={handleGenerateIdea}
                  disabled={aiGenerating}
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700"
                >
                  {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : 'Gerar Magia'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Título/Chamada da Pauta</label>
              <input 
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                className="w-full border border-gray-300 dark:border-zinc-700 font-bold p-3 rounded-xl focus:ring-2 focus:ring-[var(--theme-color)] outline-none bg-white dark:bg-zinc-900 dark:text-white"
                placeholder="Excesso de frizz na barba: Como resolver?"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Campanha vinculada</label>
              <select
                value={form.campaignId || ''}
                onChange={e => setForm({...form, campaignId: e.target.value})}
                className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
              >
                <option value="">Sem campanha</option>
                {campaigns.filter(item => item.status !== 'CANCELADA').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Status na Esteira</label>
                <select 
                  value={form.status}
                  onChange={e => setForm({...form, status: e.target.value as PostStatus})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                >
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Prioridade</label>
                <select value={form.priority} onChange={e => setForm({...form, priority:e.target.value as PostPriority})} className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white">{Object.entries(PRIORITY_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Unidade</label>
                <select value={form.unitId} onChange={e => setForm({...form, unitId:e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"><option value="ALL">Todas as unidades</option>{systemUnits.filter(unit => unit.isActive !== false).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Prazo da produção</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({...form,dueDate:e.target.value})} className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"/>
              </div>
            </div>

            {form.status === 'Aprovação' && <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-amber-900 dark:text-amber-200">Aguardando aprovação da gerência</p><p className="text-xs text-amber-700 dark:text-amber-300">Após a aprovação, a pauta seguirá para gravação.</p></div>{currentUser?.role === 'ADMIN' && <button type="button" onClick={approve} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4"/>Aprovar roteiro</button>}</div>}
            {form.approvedAt && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"><ShieldCheck className="mr-1 inline h-4 w-4"/>Aprovado por {form.approvedBy} em {new Date(form.approvedAt).toLocaleString('pt-BR')}</p>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Plataforma</label>
                <select 
                  value={form.platform}
                  onChange={e => setForm({...form, platform: e.target.value})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                >
                  {PLATFORMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Formato</label>
                <select 
                  value={form.format}
                  onChange={e => setForm({...form, format: e.target.value})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                >
                  {FORMATS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Data Agendada</label>
                <input 
                  type="date"
                  value={form.scheduledDate}
                  onChange={e => setForm({...form, scheduledDate: e.target.value})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Horário Agendado</label>
                <input 
                  type="time"
                  value={form.scheduledTime}
                  onChange={e => setForm({...form, scheduledTime: e.target.value})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Roteiro / Descrição da Ideia</label>
              <textarea 
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full border border-gray-300 dark:border-zinc-700 p-3 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] outline-none font-medium min-h-[100px] bg-white dark:bg-zinc-900 dark:text-white"
                placeholder="Exemplo de cena a cena, ou texto da legenda..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Legenda da publicação</label><textarea value={form.caption} onChange={e=>setForm({...form,caption:e.target.value})} className="min-h-[90px] w-full rounded-lg border border-gray-300 bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" placeholder="Texto final, hashtags e marcações..."/></div>
              <div><label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Chamada para ação (CTA)</label><textarea value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})} className="min-h-[90px] w-full rounded-lg border border-gray-300 bg-white p-3 font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" placeholder="Ex.: Agende pelo WhatsApp, visite a unidade..."/></div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Recursos / Links</label>
              <input 
                value={form.externalLinks}
                onChange={e => setForm({...form, externalLinks: e.target.value})}
                className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                placeholder="Link do Canva, Google Drive, Referência..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">Equipe Responsável</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${form.assignedUsers.includes(u.id) ? 'bg-[var(--theme-color)] border-[var(--theme-color)] text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
                  >
                    {u.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-700">
              <h3 className="mb-3 text-sm font-black text-gray-900 dark:text-white">Responsável por etapa</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{STATUSES.filter(status => !['Ideia','Publicado','Mensurado'].includes(status)).map(status => <label key={status} className="text-xs font-bold text-gray-500 dark:text-zinc-400">{status}<select value={form.stageAssignments[status] || ''} onChange={e=>setForm({...form,stageAssignments:{...form.stageAssignments,[status]:e.target.value}})} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><option value="">Não definido</option>{users.filter(user=>user.isActive!==false).map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label>)}</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-700"><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><CheckSquare className="h-4 w-4 text-[var(--theme-color)]"/>Checklist da produção</h3><div className="space-y-2">{form.checklist.map(item=><div key={item.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 dark:bg-zinc-800/60"><input type="checkbox" checked={item.done} onChange={()=>setForm({...form,checklist:form.checklist.map(current=>current.id===item.id?{...current,done:!current.done}:current)})}/><span className={`min-w-0 flex-1 text-sm ${item.done?'line-through text-gray-400':''}`}>{item.label}</span><button type="button" onClick={()=>setForm({...form,checklist:form.checklist.filter(current=>current.id!==item.id)})} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4"/></button></div>)}</div><div className="mt-3 flex gap-2"><input value={newChecklist} onChange={e=>setNewChecklist(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addChecklistItem();}}} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900" placeholder="Adicionar tarefa..."/><button type="button" onClick={addChecklistItem} className="rounded-lg bg-[var(--theme-color)] px-3 text-sm font-bold text-white">Adicionar</button></div></div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-zinc-700"><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><MessageCircle className="h-4 w-4 text-[var(--theme-color)]"/>Comentários</h3><div className="max-h-44 space-y-2 overflow-y-auto">{form.comments.map(comment=><div key={comment.id} className="rounded-lg bg-gray-50 p-2.5 dark:bg-zinc-800/60"><div className="flex justify-between gap-2"><strong className="text-xs">{comment.authorName}</strong><span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleString('pt-BR')}</span></div><p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">{comment.text}</p></div>)}{!form.comments.length&&<p className="py-4 text-center text-xs text-gray-400">Nenhum comentário.</p>}</div><div className="mt-3 flex gap-2"><input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addComment();}}} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900" placeholder="Escrever comentário..."/><button type="button" onClick={addComment} className="rounded-lg bg-[var(--theme-color)] px-3 text-sm font-bold text-white">Enviar</button></div></div>
            </div>

            {form.history.length > 0 && <details className="rounded-xl border border-gray-200 p-4 dark:border-zinc-700"><summary className="cursor-pointer text-sm font-black"><History className="mr-2 inline h-4 w-4 text-[var(--theme-color)]"/>Histórico da pauta ({form.history.length})</summary><div className="mt-3 space-y-2">{form.history.slice().reverse().map(event=><div key={event.id} className="flex flex-col justify-between gap-1 border-l-2 border-[var(--theme-color)]/30 pl-3 text-xs sm:flex-row"><span>{event.action} · <strong>{event.authorName}</strong></span><span className="text-gray-400">{new Date(event.createdAt).toLocaleString('pt-BR')}</span></div>)}</div></details>}

          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 flex justify-between bg-gray-50 dark:bg-zinc-900 shrink-0">
          {form.id ? (
            <button 
              onClick={deleteMode}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg font-bold flex items-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          ) : <div></div>}
          
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg font-bold transition"
            >
              Cancelar
            </button>
            <button 
              onClick={saveForm}
              disabled={loading}
              className="px-6 py-2 bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white rounded-lg font-bold shadow-sm transition"
            >
              {loading ? 'Salvando...' : 'Salvar Pauta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

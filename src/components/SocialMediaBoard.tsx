import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, getDoc, setDoc } from 'firebase/firestore';
import { Plus, GripVertical, Trash2, Edit3, Calendar, Users, AlignLeft, Youtube, Instagram, Twitter, MessageCircle, X, Sparkles, Loader2, LayoutGrid, Library, Target } from 'lucide-react';
import { useStore } from '../store';

type PostStatus = 'Ideia' | 'Roteirização' | 'Gravação' | 'Edição' | 'Agendado' | 'Publicado' | 'Cancelado';

const STATUSES: PostStatus[] = ['Ideia', 'Roteirização', 'Gravação', 'Edição', 'Agendado', 'Publicado', 'Cancelado'];

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
}

export function SocialMediaBoard() {
  const [activeTab, setActiveTab] = useState<'KANBAN' | 'CALENDAR' | 'LIBRARY'>('KANBAN');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const { users } = useStore();

  useEffect(() => {
    const q = query(collection(db, 'social_posts'));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: SocialPost[] = [];
      snap.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() } as SocialPost);
      });
      setPosts(loaded);
    });
    return () => unsub();
  }, []);

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
        await updateDoc(postRef, { status });
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
      externalLinks: ''
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
            className="flex items-center gap-2 bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white px-4 py-2 rounded-lg font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Pauta
          </button>
        </div>
        
        <div className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto">
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

        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-zinc-800/30">
        {activeTab === 'KANBAN' && (
          <div className="flex-1 overflow-x-auto p-4 custom-scrollbar flex gap-4 min-h-[600px] items-stretch">
            {STATUSES.map(status => {
              const columnPosts = posts.filter(p => p.status === status);
              
              return (
                <div 
                  key={status}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                  className="w-72 shrink-0 bg-gray-100 dark:bg-zinc-800/80 rounded-xl flex flex-col h-full min-h-[150px] max-h-[800px] border border-gray-200 dark:border-zinc-700/50 shadow-sm overflow-hidden"
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
          <CalendarView posts={posts} getPlatformIcon={getPlatformIcon} onPostClick={openForm} />
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
        />
      )}
    </div>
  );
}

function CalendarView({ posts, getPlatformIcon, onPostClick }: any) {
  // Simple list view grouped by date
  const scheduled = posts.filter((p: any) => p.scheduledDate).sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
            <div key={post.id} onClick={() => onPostClick(post)} className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm cursor-pointer hover:border-[var(--theme-color)] transition">
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
              <div className="text-gray-400 font-bold text-sm">
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Library className="w-5 h-5 text-[var(--theme-color)]" /> Biblioteca de Referências & Links
        </h3>
        
        <div className="flex gap-2 mb-6">
          <input className="flex-1 border p-2.5 rounded-lg text-sm font-medium bg-gray-50 dark:bg-zinc-800 outline-none" placeholder="Nome do link (Ex: Drive da Agência)" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} />
          <input className="flex-1 border p-2.5 rounded-lg text-sm font-medium bg-gray-50 dark:bg-zinc-800 outline-none" placeholder="URL" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} />
          <button onClick={save} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg font-bold">Salvar</button>
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

function PostModal({ post, onClose, users }: { post: SocialPost, onClose: () => void, users: any[] }) {
  const [form, setForm] = useState<SocialPost>(post);
  const [loading, setLoading] = useState(false);

  const saveForm = async () => {
    if (!form.title) return alert("O título é obrigatório");
    setLoading(true);
    try {
      if (form.id) {
        const ref = doc(db, 'social_posts', form.id);
        const { id, ...data } = form;
        await updateDoc(ref, data);
      } else {
        const { id, ...data } = form;
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

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const handleGenerateIdea = async () => {
    if (!aiPrompt) return alert("Digite um tema para a IA gerar a ideia.");
    setAiGenerating(true);
    try {
      const res = await fetch("/api/generate-post-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: aiPrompt })
      });
      const data = await res.json();
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
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            {form.id ? 'Editar Pauta' : 'Nova Pauta de Conteúdo'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {!form.id && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
              <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Gerador de Roteiros com IA
              </h3>
              <div className="flex gap-2">
                <input 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Mitos sobre calvície, Como cuidar da barba grande..."
                  className="flex-1 border border-purple-200 dark:border-purple-800/50 p-2.5 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm bg-white dark:bg-zinc-900 dark:text-white"
                />
                <button 
                  onClick={handleGenerateIdea}
                  disabled={aiGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-sm flex items-center gap-2 whitespace-nowrap"
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">Status na Esteira</label>
                <select 
                  value={form.status}
                  onChange={e => setForm({...form, status: e.target.value as PostStatus})}
                  className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-lg focus:ring-1 focus:ring-[var(--theme-color)] outline-none font-medium bg-white dark:bg-zinc-900 dark:text-white"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

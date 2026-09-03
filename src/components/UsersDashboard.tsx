import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Role } from "../types";
import { 
  Building, 
  CheckCircle2, 
  Edit2, 
  Palette, 
  Trash2, 
  UserPlus, 
  X, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";

export function UsersDashboard({ tabView }: { tabView?: "BARBERS" | "MANAGERS" | "UNITS" }) {
  const { 
    users, 
    systemUnits, 
    addSystemUnit, 
    updateSystemUnit, 
    deleteSystemUnit, 
    addUser, 
    updateUser, 
    deleteUser
  } = useStore();

  const subTab = tabView || "BARBERS";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('BARBER');
  const [unit, setUnit] = useState<string>('UNIT_1');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState<string>('');
  const [password, setPassword] = useState('');

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: 'red' | 'emerald';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    resetForm();
  }, [subTab]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setRole(subTab === 'MANAGERS' ? 'ADMIN' : 'BARBER');
    setUnit(systemUnits?.[0]?.id || 'UNIT_1');
    setPassword('');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('O nome é obrigatório.', 'error');
      return;
    }
    
    // Auto-assign role based on subTab if it's new
    let assignedRole = role;
    if (!editingId) {
       if (subTab === 'BARBERS' && !['BARBER', 'MANICURE'].includes(role)) {
          assignedRole = 'BARBER';
       } else if (subTab === 'MANAGERS' && !['ADMIN', 'FINANCIAL', 'MARKETING'].includes(role)) {
          assignedRole = 'ADMIN';
       }
    }

    if (editingId) {
      updateUser(editingId, { name, email, role: assignedRole, unit });
      if (password) {
        updateUser(editingId, { password });
      }
      showToast('Usuário atualizado com sucesso!');
    } else {
      if (!password) {
         showToast('A senha é obrigatória para novos usuários.', 'error');
         return;
      }
      addUser({ name, email, role: assignedRole, unit, password, isActive: true });
      showToast('Usuário cadastrado com sucesso!');
    }
    resetForm();
  };

  const handleEdit = (u: any) => {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email || '');
    setRole(u.role);
    setUnit(u.unit);
    setPassword('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteUserClick = (id: string, userName: string) => {
    setConfirmModal({
      title: 'Inativar Usuário',
      description: `Tem certeza que deseja inativar "${userName}"? O usuário não poderá mais acessar o sistema.`,
      confirmText: 'Inativar Usuário',
      confirmColor: 'red',
      onConfirm: () => {
        updateUser(id, { isActive: false });
        showToast('Usuário inativado com sucesso.', 'info');
        setConfirmModal(null);
      }
    });
  };

  const handleRestoreUserClick = (u: any) => {
    setConfirmModal({
      title: 'Reativar Usuário',
      description: `Deseja reativar o acesso de "${u.name}" ao sistema?`,
      confirmText: 'Reativar',
      confirmColor: 'emerald',
      onConfirm: () => {
        updateUser(u.id, { isActive: true });
        showToast('Usuário reativado com sucesso.', 'success');
        setConfirmModal(null);
      }
    });
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim()) {
      showToast('O nome da unidade é obrigatório.', 'error');
      return;
    }
    if (editingUnitId) {
      updateSystemUnit(editingUnitId, unitName);
      showToast('Unidade atualizada com sucesso!');
    } else {
      addSystemUnit(unitName);
      showToast('Unidade cadastrada com sucesso!');
    }
    setEditingUnitId(null);
    setUnitName('');
  };

  const handleDeleteUnit = (id: string, name: string) => {
    setConfirmModal({
      title: 'Excluir Unidade',
      description: `Tem certeza que deseja excluir a unidade "${name}"? Esta ação não pode ser desfeita e pode afetar usuários vinculados a ela.`,
      confirmText: 'Excluir Unidade',
      confirmColor: 'red',
      onConfirm: () => {
        deleteSystemUnit(id);
        showToast('Unidade excluída com sucesso.', 'info');
        setConfirmModal(null);
      }
    });
  };

  const getUnitLabel = (unitId: string) => {
    const unit = systemUnits?.find(u => u.id === unitId);
    return unit ? unit.name : unitId;
  };

  const filteredUsers = users.filter(u => {
    if (subTab === 'BARBERS') return u.role === 'BARBER' || u.role === 'MANICURE';
    if (subTab === 'MANAGERS') return u.role === 'ADMIN' || u.role === 'FINANCIAL' || u.role === 'MARKETING';
    return false;
  });

  return (
    <div className="space-y-6 relative">
      {/* Dynamic Animated Toast */}
      {toast && (
        <div className="fixed top-24 right-6 z-50 flex items-center gap-3 bg-white dark:bg-zinc-800 border border-gray-150 dark:border-zinc-700/80 p-4 rounded-xl shadow-xl max-w-sm transition-all duration-300 transform translate-x-0 animate-bounce">
          <CheckCircle2 className={`w-5 h-5 ${toast.type === 'error' ? 'text-red-500' : toast.type === 'info' ? 'text-[var(--theme-color)]' : 'text-emerald-500'}`} />
          <span className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-850 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full ${confirmModal.confirmColor === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-red-100 dark:bg-red-950/40'} flex items-center justify-center shrink-0`}>
                <AlertTriangle className={`w-5 h-5 ${confirmModal.confirmColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                  {confirmModal.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
                  {confirmModal.description}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 dark:text-zinc-350 bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all shadow-sm ${confirmModal.confirmColor === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirmModal.confirmText || 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      

      {subTab === 'UNITS' && (
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-gray-150 dark:border-zinc-800/80 transition-colors animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b dark:border-zinc-800/80 pb-4 mb-6">
             <div className="flex items-center gap-2">
               <Building className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
               <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                 {editingUnitId ? <span key="edit">Editar Unidade</span> : <span key="add">Cadastrar Unidade</span>}
               </h2>
             </div>
             {editingUnitId && (
               <button
                 type="button"
                 onClick={() => { setEditingUnitId(null); setUnitName(''); }}
                 className="text-[var(--theme-color)] hover:text-[#e05f3a] flex items-center gap-1 text-sm font-semibold transition"
               >
                 <X className="w-4 h-4" /> Cancelar
               </button>
             )}
          </div>
          
          <form onSubmit={handleSaveUnit} className="flex flex-col md:flex-row gap-4 mb-8">
             <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nome da Unidade (ex: Unidade Centro)"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                />
             </div>
             <button type="submit" className="bg-gray-900 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap">
                {editingUnitId ? (
                  <span key="edit" className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Atualizar Unidade</span>
                ) : (
                  <span key="add" className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Adicionar Unidade</span>
                )}
             </button>
          </form>

          <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 dark:bg-zinc-850 border-b dark:border-zinc-800 text-gray-600 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ID</th>
                      <th className="px-4 py-3 font-semibold">Nome da Unidade</th>
                      <th className="px-4 py-3 font-semibold text-right">Ação</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-150 dark:divide-zinc-800 text-gray-700 dark:text-zinc-350 bg-white dark:bg-zinc-900">
                    {(systemUnits || []).map(u => (
                      <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                         <td className="px-4 py-3 font-mono text-xs">{u.id}</td>
                         <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{u.name}</td>
                         <td className="px-4 py-3 text-right">
                            <button
                               onClick={() => { setEditingUnitId(u.id); setUnitName(u.name); }}
                               className="text-gray-400 hover:text-[var(--theme-color)] transition-colors p-1.5 mr-2 cursor-pointer inline-block"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                               onClick={() => handleDeleteUnit(u.id, u.name)}
                               className="text-gray-400 hover:text-red-600 transition-colors p-1.5 cursor-pointer inline-block"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </td>
                      </tr>
                    ))}
                    {(!systemUnits || systemUnits.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-500">Nenhuma unidade cadastrada.</td>
                      </tr>
                    )}
                 </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {(subTab === 'BARBERS' || subTab === 'MANAGERS') && (
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-gray-150 dark:border-zinc-800/80 transition-colors animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b dark:border-zinc-800/80 pb-4 mb-6">
             <div className="flex items-center gap-2">
               <UserPlus className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
               <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                 {editingId ? <span key="edit">Editar Cadastro</span> : <span key="add">Novo Cadastro</span>}
               </h2>
             </div>
             {editingId && (
               <button
                 type="button"
                 onClick={resetForm}
                 className="text-[var(--theme-color)] hover:text-[#e05f3a] flex items-center gap-1 text-sm font-semibold transition"
               >
                 <X className="w-4 h-4" /> Cancelar
               </button>
             )}
          </div>
          
          <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Nome</label>
                <input
                  type="text"
                  placeholder="Nome do Usuário"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Email</label>
                <input
                  type="email"
                  placeholder="E-mail (opcional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Perfil / Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white font-semibold"
                >
                  {subTab === 'BARBERS' ? (
                    <>
                      <option value="BARBER">Barbeiro</option>
                      <option value="MANICURE">Manicure</option>
                    </>
                  ) : (
                    <>
                      <option value="ADMIN">Gerente</option>
                      <option value="FINANCIAL">Financeiro</option>
                      <option value="MARKETING">Marketing</option>
                    </>
                  )}
                </select>
             </div>
             
             {!['ADMIN', 'FINANCIAL', 'MARKETING'].includes(role) && (
               <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Unidade</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white font-semibold"
                  >
                    {(systemUnits || []).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
               </div>
             )}

             <div>
                {editingId ? (
                  <>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Senha</label>
                  <input
                    type="password"
                    placeholder="Nova senha (opcional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  />
                  </>
                ) : (
                  <>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">Senha</label>
                  <input
                    type="password"
                    placeholder="Senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-250 dark:border-zinc-800 p-2 text-sm rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                  />
                  </>
                )}
             </div>
             
             <div className="flex items-end lg:col-span-1 md:col-span-2">
                <button type="submit" className="w-full bg-gray-900 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                   {editingId ? (
                     <span key="edit" className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Salvar</span>
                   ) : (
                     <span key="add" className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Cadastrar</span>
                   )}
                </button>
             </div>
          </form>

          <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden mt-6">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 dark:bg-zinc-850 border-b dark:border-zinc-800 text-gray-600 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Perfil</th>
                      <th className="px-4 py-3 font-semibold">Unidade</th>
                      <th className="px-4 py-3 font-semibold text-right">Ação</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-150 dark:divide-zinc-800 text-gray-700 dark:text-zinc-350 bg-white dark:bg-zinc-900">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                         <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{u.name}</td>
                         <td className="px-4 py-3 font-medium">{u.email || '-'}</td>
                         <td className="px-4 py-3">
                           <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : u.role === 'MANICURE' ? 'bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'}`}>
                             {u.role === 'ADMIN' ? 'Gerente' : u.role === 'FINANCIAL' ? 'Financeiro' : u.role === 'MARKETING' ? 'Marketing' : u.role === 'MANICURE' ? 'Manicure' : 'Barbeiro'}
                           </span>
                         </td>
                         <td className="px-4 py-3 font-medium">{u.role === 'ADMIN' ? '-' : getUnitLabel(u.unit)}</td>
                         <td className="px-4 py-3 text-right">
                            <button
                               onClick={() => handleEdit(u)}
                               className="text-gray-400 hover:text-[var(--theme-color)] transition-colors p-1.5 mr-2 cursor-pointer inline-block"
                              title="Editar Usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {u.isActive === false ? (<button
                               type="button"
                              onClick={() => handleRestoreUserClick(u)}
                               className="text-gray-400 hover:text-emerald-600 transition-colors p-1.5 cursor-pointer inline-block"
                              title="Reativar Usuário"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>) : (<button
                               type="button"
                              onClick={() => handleDeleteUserClick(u.id, u.name)}
                               className="text-gray-400 hover:text-red-600 transition-colors p-1.5 cursor-pointer inline-block"
                              title="Remover Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>)}
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            </div>
            
            {/* Mobile Card List */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {filteredUsers.map(u => (
                <div key={u.id} className="p-4 flex flex-col space-y-3 hover:bg-gray-50/50 dark:hover:bg-zinc-850/20 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white font-sans text-sm flex items-center gap-2">{u.name} {u.isActive === false && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Inativo</span>}</h4>
                      <p className="text-xs text-gray-550 dark:text-zinc-400 mt-0.5">{u.email || '-'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                         onClick={() => handleEdit(u)}
                         className="p-2 text-gray-400 hover:text-[var(--theme-color)] hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                        title="Editar Usuário"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.isActive === false ? (<button
                         type="button"
                        onClick={() => handleRestoreUserClick(u)}
                         className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer"
                        title="Reativar Usuário"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>) : (<button
                         type="button"
                        onClick={() => handleDeleteUserClick(u.id, u.name)}
                         className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all cursor-pointer"
                        title="Remover Usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : u.role === 'MANICURE' ? 'bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'}`}>
                      {u.role === 'ADMIN' ? 'Gerente' : u.role === 'FINANCIAL' ? 'Financeiro' : u.role === 'MARKETING' ? 'Marketing' : u.role === 'MANICURE' ? 'Manicure' : 'Barbeiro'}
                    </span>
                    {!['ADMIN', 'FINANCIAL', 'MARKETING'].includes(u.role) && (
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-850 text-gray-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                        {getUnitLabel(u.unit)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-zinc-550 text-sm font-medium">
                  Nenhum usuário cadastrado nesta categoria.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

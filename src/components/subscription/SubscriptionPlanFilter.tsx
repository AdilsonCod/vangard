import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { db } from '../../firebase';
import { useStore } from '../../store';
import type { SubscriptionPlan } from '../../types';
import { assertAuthorizedUnit } from '../../services/firestoreScope';

type Props = { unitId: string; selectedIds: Set<string>; onChange: (ids: Set<string>) => void; onPlansChange?: (plans: SubscriptionPlan[]) => void };

export function SubscriptionPlanFilter({ unitId, selectedIds, onChange, onPlansChange }: Props) {
  const { currentUser, systemUnits } = useStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'FINANCIAL';

  useEffect(() => {
    if (!unitId || unitId === 'ALL') { setPlans([]); onPlansChange?.([]); return; }
    try { assertAuthorizedUnit(currentUser, unitId); } catch { setPlans([]); onPlansChange?.([]); return; }
    return onSnapshot(query(collection(db, 'subscriptionPlans'), where('unitId', '==', unitId)), snapshot => {
      const next = snapshot.docs.map(item => ({
        ...(item.data() as SubscriptionPlan),
        // O ID canônico é o do documento. Registros antigos podem não ter o campo `id` salvo.
        id: item.id,
      })).filter(plan => plan.isActive !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setPlans(next);
      onPlansChange?.(next);
    }, () => setError('Não foi possível carregar os planos desta unidade.'));
  // Selection changes are handled by the parent; excluding callbacks avoids recreating the Firestore listener.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, unitId]);

  const label = useMemo(() => !unitId || unitId === 'ALL' ? 'Selecione uma unidade' : selectedIds.size === 0 ? 'Nenhum plano selecionado' : selectedIds.size === plans.length ? 'Todos os planos' : `${selectedIds.size} plano(s)`, [plans.length, selectedIds.size, unitId]);

  const savePlan = async () => {
    const clean = name.trim();
    if (!clean || !unitId || unitId === 'ALL') { setError('Informe a unidade e o nome do plano.'); return; }
    if (plans.some(plan => plan.name.localeCompare(clean, 'pt-BR', { sensitivity: 'base' }) === 0)) { setError('Este plano já está cadastrado para a unidade.'); return; }
    setSaving(true); setError('');
    try {
      assertAuthorizedUnit(currentUser, unitId);
      const id = `subscription_plan_${unitId}_${Date.now()}`;
      const plan: SubscriptionPlan = { id, unitId, name: clean, isActive: true, createdAt: new Date().toISOString(), createdBy: currentUser?.id };
      await setDoc(doc(db, 'subscriptionPlans', id), plan);
      onChange(new Set([...selectedIds, id])); setName(''); setShowCreate(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o plano.'); }
    finally { setSaving(false); }
  };

  return <div className="relative min-w-0">
    <button type="button" disabled={!unitId || unitId === 'ALL'} onClick={() => setOpen(value => !value)} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-xs font-bold text-gray-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
      <span className="flex min-w-0 items-center gap-2"><Sparkles className="h-4 w-4 shrink-0 text-indigo-500"/><span className="truncate">{label}</span></span><ChevronDown className="h-4 w-4 shrink-0"/>
    </button>
    {open && <div className="absolute z-50 mt-2 w-full min-w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex gap-2"><button type="button" onClick={() => onChange(new Set(plans.map(plan => plan.id)))} className="text-[10px] font-black text-indigo-600">Selecionar todos</button><button type="button" onClick={() => onChange(new Set())} className="text-[10px] font-black text-gray-500">Limpar</button></div>
      <div className="max-h-52 space-y-1 overflow-y-auto">{plans.map(plan => <button key={plan.id} type="button" onClick={() => { const next = new Set(selectedIds); next.has(plan.id) ? next.delete(plan.id) : next.add(plan.id); onChange(next); }} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"><span>{plan.name}</span>{selectedIds.has(plan.id) && <Check className="h-4 w-4 text-emerald-500"/>}</button>)}{plans.length === 0 && <p className="py-4 text-center text-xs text-gray-500">Nenhum plano cadastrado.</p>}</div>
      {canManage && <div className="mt-3 border-t border-gray-100 pt-3 dark:border-zinc-800">{showCreate ? <div className="space-y-2"><div className="flex gap-2"><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Nome do novo plano" className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-2 py-2 text-xs dark:border-zinc-700"/><button type="button" onClick={() => setShowCreate(false)}><X className="h-4 w-4"/></button></div><button type="button" disabled={saving} onClick={savePlan} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar plano nesta unidade'}</button></div> : <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-xs font-black text-indigo-600"><Plus className="h-4 w-4"/>Cadastrar novo plano</button>}</div>}
      {error && <p className="mt-2 text-[10px] font-bold text-red-600">{error}</p>}
    </div>}
    {unitId && unitId !== 'ALL' && <p className="mt-1 truncate text-[9px] text-gray-400">Unidade: {systemUnits.find(unit => unit.id === unitId)?.name || unitId}</p>}
  </div>;
}

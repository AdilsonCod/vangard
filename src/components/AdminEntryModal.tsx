import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Edit3, Gift, Scissors, X } from 'lucide-react';
import type { CatalogItem, Category, DailyEntry, Subcategory } from '../types';
import { useStore } from '../store';
import { isCatalogItemVisibleToRole } from '../services/catalogVisibility';

type Values = Record<string,{amount:number;commission:number}>;
type ModalMode = 'production'|'courtesy';
type InputModal = { title:string; items:CatalogItem[]; mode:ModalMode } | null;

export function AdminEntryModal({entry,catalog,categories,subcategories,onClose,onSave}:{entry:DailyEntry;catalog:CatalogItem[];categories:Category[];subcategories:Subcategory[];onClose:()=>void;onSave:(entry:DailyEntry)=>void}) {
  const {users}=useStore();
  const entryUser=users.find(user=>user.id===entry.userId);
  const userRole=entryUser?.role||'BARBER';
  const filteredCatalog=useMemo(()=>catalog.filter(item=>isCatalogItemVisibleToRole(item,userRole,entryUser?.unit)),[catalog,userRole,entryUser?.unit]);
  const [date,setDate]=useState(entry.date),[isDayOff,setIsDayOff]=useState(entry.isDayOff),[clientsServed,setClientsServed]=useState(entry.clientsServed||0),[uniqueClientsServed,setUniqueClientsServed]=useState(entry.uniqueClientsServed||0);
  const [form,setForm]=useState<Values>(entry.items||{}),[courtesies,setCourtesies]=useState<Values>(entry.cortesias||{}),[inputModal,setInputModal]=useState<InputModal>(null);

  useEffect(()=>{
    const nextForm={...entry.items},nextCourtesies={...entry.cortesias};
    filteredCatalog.forEach(item=>{if(!nextForm[item.id])nextForm[item.id]={amount:0,commission:0};if(!nextCourtesies[item.id])nextCourtesies[item.id]={amount:0,commission:0}});
    setForm(nextForm);setCourtesies(nextCourtesies);
  },[entry,filteredCatalog]);

  const save=()=>onSave({...entry,date,isDayOff,clientsServed,uniqueClientsServed,items:form,cortesias:courtesies});
  const openCategory=(category:Category,mode:ModalMode)=>{
    const items=filteredCatalog.filter(item=>item.type===category.id && (mode==='production'||(category.id!=='PRODUCT'&&category.type!=='PRODUCT')));
    if(items.length)setInputModal({title:category.name,items,mode});
  };
  const categoryCards=(mode:ModalMode)=>categories.map(category=>{
    const items=filteredCatalog.filter(item=>item.type===category.id && (mode==='production'||(category.id!=='PRODUCT'&&category.type!=='PRODUCT')));
    if(!items.length)return null;
    const values=mode==='production'?form:courtesies;
    const filled=items.filter(item=>(values[item.id]?.amount||0)>0||(values[item.id]?.commission||0)>0).length;
    return <article key={`${mode}-${category.id}`} className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"><div><h3 className="flex items-center justify-between font-bold text-gray-900 dark:text-zinc-100">{category.name}{filled>0&&<CheckCircle2 className="h-4 w-4 text-emerald-500"/>}</h3><p className="mt-1 text-xs text-gray-500">{filled} de {items.length} preenchidos</p></div><button type="button" onClick={()=>openCategory(category,mode)} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[var(--theme-color)] shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><Edit3 className="h-4 w-4"/>{filled?'Editar valores':'Preencher'}</button></article>;
  });

  return <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-0 sm:items-center sm:p-4"><div className="flex max-h-[96dvh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900 sm:max-h-[90vh] sm:rounded-2xl">
    <header className="flex items-center justify-between rounded-t-2xl border-b bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-800"><h2 className="text-xl font-bold">Editar lançamento</h2><button aria-label="Fechar" onClick={onClose} className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-zinc-700"><X className="h-5 w-5"/></button></header>
    <div className="flex-1 space-y-6 overflow-y-auto p-4">
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-gray-700 dark:text-gray-300">Data<input type="date" value={date} onChange={event=>setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"/></label><label className="mt-6 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={isDayOff} onChange={event=>setIsDayOff(event.target.checked)} className="h-5 w-5"/><span className="font-bold text-red-600 dark:text-red-400">Marcar como folga</span></label></div>
      {!isDayOff&&<><section className="grid gap-4 rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-900/30 dark:bg-purple-950/20 md:grid-cols-2"><label className="text-sm font-bold text-purple-900 dark:text-purple-300">Total de clientes distintos<input type="number" min="0" value={uniqueClientsServed||''} onChange={event=>setUniqueClientsServed(parseInt(event.target.value)||0)} className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"/></label><label className="text-sm font-bold text-purple-900 dark:text-purple-300">Total de serviços executados<input type="number" min="0" value={clientsServed||''} onChange={event=>setClientsServed(parseInt(event.target.value)||0)} className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"/></label></section>
        <section><div className="mb-3 flex items-center gap-2"><Scissors className="h-5 w-5 text-[var(--theme-color)]"/><h3 className="font-black">Produção por categoria</h3></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{categoryCards('production')}</div></section>
        <section className="rounded-xl border border-amber-200/50 bg-amber-50/40 p-4 dark:border-amber-700/30 dark:bg-amber-900/10"><div className="mb-3 flex items-center gap-2"><Gift className="h-5 w-5 text-amber-600"/><div><h3 className="font-black text-amber-800 dark:text-amber-300">Cortesias realizadas</h3><p className="text-xs text-amber-700/80">Abra uma categoria para registrar quantidades e comissões.</p></div></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{categoryCards('courtesy')}</div></section></>}
    </div>
    <footer className="flex flex-col-reverse gap-2 rounded-b-2xl border-t bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-800 sm:flex-row sm:justify-end"><button onClick={onClose} className="rounded-lg border bg-white px-6 py-2 font-bold text-gray-600 dark:border-zinc-700 dark:bg-zinc-800">Cancelar</button><button onClick={save} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--theme-color)] px-6 py-2 font-bold text-white"><Check className="h-5 w-5"/>Salvar alterações</button></footer>
  </div>
  {inputModal&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setInputModal(null)}}><div role="dialog" aria-modal="true" aria-labelledby="admin-production-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"><header className="flex items-center justify-between border-b p-5 dark:border-zinc-800"><h3 id="admin-production-title" className="text-lg font-black">{inputModal.mode==='courtesy'?'Cortesias':'Produção'}: {inputModal.title}</h3><button aria-label="Fechar categoria" onClick={()=>setInputModal(null)} className="rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-5 w-5"/></button></header><div className="space-y-3 overflow-y-auto p-5">{inputModal.items.map(item=>{const values=inputModal.mode==='production'?form:courtesies;const setValues=inputModal.mode==='production'?setForm:setCourtesies;const value=values[item.id]||{amount:0,commission:0};const subcategory=subcategories.find(entry=>entry.id===item.subcategoryId);return <div key={item.id} className="grid gap-3 rounded-xl border border-gray-200 p-3 dark:border-zinc-800 sm:grid-cols-[1fr_100px_150px] sm:items-end"><p className="font-bold">{item.name}{subcategory&&<span className="block text-xs font-normal text-gray-500">{subcategory.name}</span>}</p><label className="text-xs font-bold text-gray-500">Quantidade<input type="number" min="0" value={value.amount||''} onChange={event=>setValues({...values,[item.id]:{...value,amount:parseInt(event.target.value)||0}})} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent p-2 dark:border-zinc-700"/></label><label className="text-xs font-bold text-gray-500">Comissão R$<input type="number" min="0" step="0.01" value={value.commission||''} onChange={event=>setValues({...values,[item.id]:{...value,commission:parseFloat(event.target.value)||0}})} className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent p-2 dark:border-zinc-700"/></label></div>})}</div><footer className="flex justify-end border-t p-4 dark:border-zinc-800"><button onClick={()=>setInputModal(null)} className="rounded-xl bg-[var(--theme-color)] px-5 py-2.5 text-sm font-black text-white">Concluir</button></footer></div></div>}
  </div>;
}

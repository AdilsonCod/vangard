import React, { useState, useEffect } from 'react';
import { DailyEntry, CatalogItem, Category, Subcategory } from '../types';
import { X, Check } from 'lucide-react';
import { useStore } from '../store';

export function AdminEntryModal({
  entry,
  catalog,
  categories,
  subcategories,
  onClose,
  onSave
}: {
  entry: DailyEntry;
  catalog: CatalogItem[];
  categories: Category[];
  subcategories: Subcategory[];
  onClose: () => void;
  onSave: (e: DailyEntry) => void;
}) {
  const { users } = useStore();
  const entryUser = users.find(u => u.id === entry.userId);
  const userRole = entryUser?.role || 'BARBER';

  const filteredCatalog = React.useMemo(() => {
    return catalog.filter(item => {
      if (item.visibleToRoles && item.visibleToRoles.length > 0) {
        return item.visibleToRoles.includes(userRole);
      }
      return true;
    });
  }, [catalog, userRole]);

  const [date, setDate] = useState(entry.date);
  const [isDayOff, setIsDayOff] = useState(entry.isDayOff);
  const [clientsServed, setClientsServed] = useState(entry.clientsServed || 0);
  const [uniqueClientsServed, setUniqueClientsServed] = useState(entry.uniqueClientsServed || 0);
  
  const [form, setForm] = useState<Record<string, {amount: number, commission: number}>>(entry.items || {});
  const [cortesiasForm, setCortesiasForm] = useState<Record<string, {amount: number, commission: number}>>(entry.cortesias || {});

  useEffect(() => {
    const initForm: typeof form = { ...entry.items };
    const initCortesias: typeof cortesiasForm = { ...entry.cortesias };
    filteredCatalog.forEach(c => {
      if (!initForm[c.id]) {
        initForm[c.id] = { amount: 0, commission: 0 };
      }
      if (!initCortesias[c.id]) {
        initCortesias[c.id] = { amount: 0, commission: 0 };
      }
    });
    setForm(initForm);
    setCortesiasForm(initCortesias);
  }, [entry, filteredCatalog]);

  const handleSave = () => {
    onSave({
      ...entry,
      date,
      isDayOff,
      clientsServed,
      uniqueClientsServed,
      items: form,
      cortesias: cortesiasForm
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 max-w-4xl w-full m-4 rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800 rounded-t-xl">
          <h2 className="text-xl font-bold">Editar Lançamento</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
             <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--theme-color)]" />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isDayOff} onChange={e => setIsDayOff(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-[var(--theme-color)]" />
                <span className="font-bold text-red-650 dark:text-red-400">Marcar como Folga</span>
              </label>
            </div>
          </div>

          {!isDayOff && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                 <div>
                   <label className="block text-sm font-bold text-purple-900 dark:text-purple-300 mb-1">Total de Clientes Distintos</label>
                   <input type="number" min="0" value={uniqueClientsServed || ''} onChange={e => setUniqueClientsServed(parseInt(e.target.value)||0)} className="w-full bg-white dark:bg-zinc-900 border border-purple-200 dark:border-zinc-800 p-2 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--theme-color)]" />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-purple-900 dark:text-purple-300 mb-1">Total de Serviços Executados</label>
                   <input type="number" min="0" value={clientsServed || ''} onChange={e => setClientsServed(parseInt(e.target.value)||0)} className="w-full bg-white dark:bg-zinc-900 border border-purple-200 dark:border-zinc-800 p-2 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--theme-color)]" />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => {
                  const itemsOfCat = filteredCatalog.filter(c => c.type === cat.id);
                  if (itemsOfCat.length === 0) return null;
                  return (
                    <div key={cat.id} className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 rounded-xl p-4">
                      <h3 className="font-bold text-gray-900 border-b pb-2 mb-2">{cat.name}</h3>
                      {itemsOfCat.map(c => {
                        const subcat = subcategories.find(s => s.id === c.subcategoryId);
                        const label = subcat ? `${c.name} (${subcat.name})` : c.name;
                        const data = form[c.id] || { amount: 0, commission: 0 };
                        return (
                          <div key={c.id} className="flex flex-col gap-1.5 py-1 pt-2">
                             <div className="font-bold text-gray-700 dark:text-gray-300 text-sm truncate" title={label}>{label}</div>
                             <div className="flex gap-2 items-end">
                                <div className="w-20 shrink-0 flex flex-col gap-1">
                                   <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Qtd.</span>
                                   <input type="number" value={data.amount===0?'':data.amount} onChange={e => setForm({...form, [c.id]: {...data, amount: parseInt(e.target.value)||0}})} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1 rounded font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]" />
                                </div>
                                <div className="flex-1 shrink-0 flex flex-col gap-1">
                                   <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Comissão R$</span>
                                   <input type="number" step="0.01" value={data.commission===0?'':data.commission} onChange={e => setForm({...form, [c.id]: {...data, commission: parseFloat(e.target.value)||0}})} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1 rounded font-bold text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]" />
                                </div>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Cortesias Segment */}
              <div className="mt-8 p-5 bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30 rounded-xl">
                <h3 className="text-base font-bold text-amber-800 mb-1 flex items-center gap-2">🎁 Cortesias Realizadas</h3>
                <p className="text-xs text-amber-700/80 mb-4 font-sans">
                  Lançamentos de cortesias (o cliente não paga no faturamento, mas o barbeiro é comissionado e este abatimento é deduzido do faturamento total).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-sans">
                  {categories.filter(cat => cat.id !== 'PRODUCT').map(cat => {
                    const itemsOfCat = filteredCatalog.filter(c => c.type === cat.id);
                    if (itemsOfCat.length === 0) return null;
                    return (
                      <div key={`cortesia-${cat.id}`} className="bg-white dark:bg-zinc-900 border border-amber-100 rounded-xl p-4 shadow-sm">
                        <h4 className="font-bold text-amber-950 border-b border-amber-100 pb-2 mb-2">{cat.name} (Cortesia)</h4>
                        {itemsOfCat.map(c => {
                          const subcat = subcategories.find(s => s.id === c.subcategoryId);
                          const label = subcat ? `${c.name} (${subcat.name})` : c.name;
                          const data = cortesiasForm[c.id] || { amount: 0, commission: 0 };
                          return (
                            <div key={`cortesia-${c.id}`} className="flex flex-col gap-1.5 py-1 pt-2">
                               <div className="font-bold text-gray-700 dark:text-gray-300 text-sm truncate" title={label}>{label}</div>
                               <div className="flex gap-2 items-end">
                                  <div className="w-20 shrink-0 flex flex-col gap-1">
                                     <span className="text-[10px] uppercase font-bold text-amber-600">Qtd.</span>
                                     <input type="number" value={data.amount===0?'':data.amount} onChange={e => setCortesiasForm({...cortesiasForm, [c.id]: {...data, amount: parseInt(e.target.value)||0}})} className="w-full bg-white dark:bg-zinc-900 border border-amber-200 p-1 rounded font-bold text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]" />
                                  </div>
                                  <div className="flex-1 shrink-0 flex flex-col gap-1">
                                     <span className="text-[10px] uppercase font-bold text-amber-600 font-sans">Comissão R$</span>
                                     <input type="number" step="0.01" value={data.commission===0?'':data.commission} onChange={e => setCortesiasForm({...cortesiasForm, [c.id]: {...data, commission: parseFloat(e.target.value)||0}})} className="w-full bg-white dark:bg-zinc-900 border border-amber-200 p-1 rounded font-bold text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--theme-color)]" />
                                  </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 rounded-b-xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-gray-600 bg-white dark:bg-zinc-800 border dark:border-zinc-700 shadow-sm mr-2 hover:bg-gray-50 dark:hover:bg-zinc-700">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg font-bold text-white bg-[var(--theme-color)] shadow-sm hover:bg-[var(--theme-color-strong)] flex items-center gap-2">
             <Check className="w-5 h-5"/> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

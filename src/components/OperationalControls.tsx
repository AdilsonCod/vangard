import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Edit3, Gift, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import type { FinancialTransaction } from '../types';
import { AppBadge, AppEmptyState, appControlClass, cn } from './ui/AppPrimitives';

type Kind = 'COURTESY' | 'INTERNAL_SALE';
type Props = { kind: Kind; selectedUnit: string; strictUnitScope?: boolean };
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const categoryByKind = { COURTESY: 'CONTROLE_CORTESIA', INTERNAL_SALE: 'VENDA_INTERNA' } as const;
const parseMoney = (value: string) => Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
const shiftMonth = (period: string, amount: number) => { const [y, m] = period.split('-').map(Number); const d = new Date(y, m - 1 + amount, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function OperationalControls({ kind, selectedUnit, strictUnitScope = false }: Props) {
  const { transactions, users, catalog, systemUnits, addTransaction, updateTransaction, deleteTransaction } = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const isCourtesy = kind === 'COURTESY';
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ unitId: selectedUnit === 'ALL' ? '' : selectedUnit, date: today, clientName: '', barberId: '', itemName: '', amount: '', status: 'PENDENTE' as FinancialTransaction['status'] });
  const unitName = (id: string) => systemUnits.find(unit => unit.id === id)?.name || id;
  const units = strictUnitScope ? systemUnits.filter(unit => unit.id === selectedUnit) : systemUnits;
  const barbers = users.filter(user => ['BARBER', 'MANICURE'].includes(user.role) && (!form.unitId || user.unit === form.unitId || user.unit === unitName(form.unitId)));
  const suggestions = catalog.filter(item => !isCourtesy || !String(item.type).toLowerCase().includes('product'));
  const records = useMemo(() => transactions.filter(item => item.category === categoryByKind[kind] && item.date.startsWith(period) && (selectedUnit === 'ALL' || item.unitId === selectedUnit)).sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)), [kind, period, selectedUnit, transactions]);
  const total = records.reduce((sum, item) => sum + item.amount, 0);
  const pending = records.filter(item => item.status === 'PENDENTE').reduce((sum, item) => sum + item.amount, 0);

  const newRecord = () => {
    setEditing(null);
    setForm({ unitId: selectedUnit === 'ALL' ? units[0]?.id || '' : selectedUnit, date: period === today.slice(0, 7) ? today : `${period}-01`, clientName: '', barberId: '', itemName: '', amount: '', status: 'PENDENTE' });
    setOpen(true);
  };
  const editRecord = (item: FinancialTransaction) => {
    setEditing(item);
    setForm({ unitId: item.unitId, date: item.date, clientName: item.clientName || '', barberId: item.barberId || '', itemName: item.itemName || item.description, amount: item.amount.toFixed(2).replace('.', ','), status: item.status });
    setOpen(true);
  };
  const save = async () => {
    const amount = parseMoney(form.amount);
    if (!form.unitId || !form.date || !form.barberId || !form.itemName.trim() || (isCourtesy && !form.clientName.trim()) || amount <= 0) return window.alert('Preencha todos os campos obrigatórios e informe um valor maior que zero.');
    const barberName = users.find(user => user.id === form.barberId)?.name || 'Colaborador';
    const item: FinancialTransaction = {
      ...(editing || {}), id: editing?.id || `${categoryByKind[kind].toLowerCase()}_${Date.now()}`, type: isCourtesy ? 'EXPENSE' : 'INCOME', category: categoryByKind[kind], description: form.itemName.trim(), amount: Number(amount.toFixed(2)), date: form.date, dueDate: form.date, unitId: form.unitId,
      status: isCourtesy ? 'PAGO' : form.status, recurrence: 'NONE', installments: 1, classification: isCourtesy ? 'Cortesia' : 'Venda interna', subclassification: form.itemName.trim(), sourceChannel: isCourtesy ? 'COURTESY' : 'OTHER', paymentMethod: isCourtesy ? 'COURTESY' : 'OTHER', movementNature: isCourtesy ? 'COMMERCIAL_DISCOUNT' : 'REVENUE', reconciliationStatus: 'NOT_APPLICABLE', clientName: isCourtesy ? form.clientName.trim() : barberName, barberId: form.barberId, itemName: form.itemName.trim(),
    };
    try { setSaving(true); editing ? await updateTransaction(item) : await addTransaction(item); setOpen(false); } catch { window.alert('Não foi possível salvar. Verifique sua conexão e tente novamente.'); } finally { setSaving(false); }
  };
  const remove = async (item: FinancialTransaction) => { if (window.confirm('Deseja excluir este registro?')) try { await deleteTransaction(item.id); } catch { window.alert('Não foi possível excluir o registro.'); } };

  return <div className="space-y-4 pb-6">
    <header className="app-themed-panel flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#062222] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)]">{isCourtesy ? <Gift /> : <ShoppingBag />}</span><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--theme-color)]">Controle mensal</p><h1 className="text-xl font-black">{isCourtesy ? 'Controle de Cortesias' : 'Controle de Vendas Internas'}</h1><p className="text-xs text-gray-500 dark:text-zinc-400">{isCourtesy ? 'Cortesias concedidas aos clientes.' : 'Produtos e serviços retirados pelos colaboradores.'}</p></div></div>
      <button onClick={newRecord} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--theme-color)] px-4 text-sm font-black text-white"><Plus className="h-4 w-4" /> Novo registro</button>
    </header>
    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/[.08] dark:bg-[#062222]"><button onClick={() => setPeriod(shiftMonth(period, -1))} className="rounded-xl p-2"><ChevronLeft /></button><div className="text-center"><p className="text-[10px] font-bold uppercase text-gray-400">Período</p><p className="font-black capitalize">{monthLabel.format(new Date(`${period}-15T12:00:00`))}</p></div><button onClick={() => setPeriod(shiftMonth(period, 1))} className="rounded-xl p-2"><ChevronRight /></button></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Summary label="Registros" value={String(records.length)} /><Summary label="Valor total" value={money.format(total)} tone="text-[var(--theme-color)]" />{!isCourtesy && <Summary label="Pendente" value={money.format(pending)} tone="text-amber-500" wide />}</div>
    <section className="app-themed-panel overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[.08] dark:bg-[#062222]">
      {!records.length ? <AppEmptyState icon={isCourtesy ? <Gift /> : <ShoppingBag />} title="Nenhum registro neste mês" description="O histórico dos meses anteriores permanece salvo." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b bg-gray-50 text-[10px] uppercase text-gray-500 dark:border-white/[.08] dark:bg-white/[.025]"><tr><th className="p-4">Data</th><th className="p-4">{isCourtesy ? 'Cliente' : 'Colaborador'}</th><th className="p-4">Produto / serviço</th><th className="p-4">Barbeiro</th><th className="p-4">Valor</th>{!isCourtesy && <th className="p-4">Status</th>}<th className="p-4 text-right">Ações</th></tr></thead><tbody className="divide-y dark:divide-white/[.06]">{records.map(item => <tr key={item.id}><td className="p-4">{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="p-4 font-bold">{item.clientName}</td><td className="p-4">{item.itemName || item.description}</td><td className="p-4">{users.find(user => user.id === item.barberId)?.name || '-'}</td><td className="p-4 font-black">{money.format(item.amount)}</td>{!isCourtesy && <td className="p-4"><AppBadge tone={item.status === 'RECEBIDO' ? 'success' : 'warning'}>{item.status === 'RECEBIDO' ? 'Descontado' : 'Pendente'}</AppBadge></td>}<td className="p-4"><div className="flex justify-end"><button onClick={() => editRecord(item)} className="p-2"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove(item)} className="p-2 text-red-500"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {open && <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:max-w-xl sm:rounded-2xl"><div className="flex items-center justify-between border-b p-4 dark:border-zinc-800"><h2 className="text-lg font-black">{editing ? 'Editar registro' : 'Novo registro'}</h2><button onClick={() => setOpen(false)} className="p-2"><X /></button></div><div className="grid gap-4 p-4 sm:grid-cols-2"><Field label="Unidade"><select disabled={strictUnitScope} value={form.unitId} onChange={e => setForm(v => ({ ...v, unitId: e.target.value, barberId: '' }))} className={cn(appControlClass, 'w-full')}><option value="">Selecione</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field><Field label="Data"><input type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} className={cn(appControlClass, 'w-full')} /></Field>{isCourtesy && <Field label="Nome do cliente" wide><input value={form.clientName} onChange={e => setForm(v => ({ ...v, clientName: e.target.value }))} className={cn(appControlClass, 'w-full')} /></Field>}<Field label="Barbeiro"><select value={form.barberId} onChange={e => setForm(v => ({ ...v, barberId: e.target.value }))} className={cn(appControlClass, 'w-full')}><option value="">Selecione</option>{barbers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label="Produto / serviço"><input list={`items-${kind}`} value={form.itemName} onChange={e => setForm(v => ({ ...v, itemName: e.target.value }))} className={cn(appControlClass, 'w-full')} /><datalist id={`items-${kind}`}>{suggestions.map(item => <option key={item.id} value={item.name} />)}</datalist></Field><Field label="Valor"><input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))} className={cn(appControlClass, 'w-full font-mono')} /></Field>{!isCourtesy && <Field label="Status"><select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value as FinancialTransaction['status'] }))} className={cn(appControlClass, 'w-full')}><option value="PENDENTE">Pendente</option><option value="RECEBIDO">Já descontado</option></select></Field>}</div><div className="flex justify-end gap-2 border-t p-4 dark:border-zinc-800"><button onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm font-bold">Cancelar</button><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--theme-color)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar'}</button></div></div></div>}
  </div>;
}

function Summary({ label, value, tone = '', wide = false }: { label: string; value: string; tone?: string; wide?: boolean }) { return <div className={cn('app-themed-panel rounded-2xl border p-4 dark:border-white/[.08]', wide && 'col-span-2 sm:col-span-1')}><p className="text-[10px] font-bold uppercase text-gray-400">{label}</p><p className={cn('mt-1 text-xl font-black', tone)}>{value}</p></div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1 block text-xs font-bold text-gray-500">{label} *</span>{children}</label>; }

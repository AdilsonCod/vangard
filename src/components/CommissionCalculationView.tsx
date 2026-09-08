import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calculator, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { doc, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useStore } from "../store";
import type { CommissionBracket, CommissionConfig, MonthlyBarberStats, PaymentRecord } from "../types";
import { calculateCommission, canAccessCommissionUnit, validateCommissionBrackets } from "../utils/commissionCalculator";
import { AppCard, AppPageHeader, appControlClass } from "./ui/AppPrimitives";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const emptyBracket = (unitId: string): CommissionBracket => ({ id: crypto.randomUUID(), unitId, minimumRevenue: 0, maximumRevenue: 0, percentage: 0 });

export default function CommissionCalculationView() {
  const { currentUser, systemUnits, users, monthlyBarberStats, payments } = useStore();
  const allowedUnits = useMemo(() => systemUnits.filter((unit) => currentUser && canAccessCommissionUnit(currentUser.role, currentUser.unit, unit.id)), [currentUser, systemUnits]);
  const [unitId, setUnitId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [brackets, setBrackets] = useState<CommissionBracket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { if (!unitId && allowedUnits[0]) setUnitId(allowedUnits[0].id); }, [allowedUnits, unitId]);
  useEffect(() => {
    if (!unitId) { setLoading(false); return; }
    setLoading(true); setMessage(null);
    return onSnapshot(doc(db, "commissionConfigs", unitId), (snapshot) => {
      const config = snapshot.exists() ? snapshot.data() as CommissionConfig : null;
      setBrackets((config?.brackets || []).map((item) => ({ ...item, unitId })));
      setLoading(false);
    }, (error) => {
      console.error(error); setLoading(false);
      setMessage({ type: "error", text: error.code === "permission-denied" ? "Você não tem permissão para carregar as faixas desta unidade." : "Não foi possível carregar as faixas. Verifique sua conexão." });
    });
  }, [unitId]);

  const calculations = useMemo(() => monthlyBarberStats
    .filter((stat) => stat.unitId === unitId && stat.month === period)
    .map((stat) => ({ stat, user: users.find((user) => user.id === stat.barberId), revenue: stat.faturamentoTotal || 0, result: calculateCommission(stat.faturamentoTotal || 0, brackets) }))
    .sort((a, b) => b.revenue - a.revenue), [brackets, monthlyBarberStats, period, unitId, users]);

  const updateBracket = (id: string, field: "minimumRevenue" | "maximumRevenue" | "percentage", raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    setBrackets((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const validateOperation = () => {
    if (!currentUser || !unitId || !canAccessCommissionUnit(currentUser.role, currentUser.unit, unitId)) {
      setMessage({ type: "error", text: "Você não tem permissão para alterar esta unidade." }); return false;
    }
    const validation = validateCommissionBrackets(brackets);
    if (!validation.valid) { setMessage({ type: "error", text: "message" in validation ? validation.message : "As faixas informadas são inválidas." }); return false; }
    return true;
  };

  const saveBrackets = async () => {
    if (!validateOperation() || !currentUser) return;
    setSaving(true); setMessage(null);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const normalized = [...brackets].sort((a, b) => a.minimumRevenue - b.minimumRevenue).map((item) => ({ ...item, unitId }));
      const config: CommissionConfig = { id: unitId, unitId, brackets: normalized, schemaVersion: 1, updatedAt: now, updatedBy: currentUser.id };
      batch.set(doc(db, "commissionConfigs", unitId), config);
      await batch.commit();
      setMessage({ type: "success", text: "Faixas de comissão salvas com sucesso." });
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: error?.code === "permission-denied" ? "Operação bloqueada: você não tem permissão para esta unidade." : "Não foi possível salvar as faixas. Verifique a conexão e tente novamente." });
    } finally { setSaving(false); }
  };

  const transferToPayments = async () => {
    if (!validateOperation()) return;
    if (!calculations.length) { setMessage({ type: "error", text: "Não existem cálculos para transferir neste período e unidade." }); return; }
    const applicable = calculations.filter(({ result }) => result.bracket);
    if (!applicable.length) { setMessage({ type: "error", text: "Nenhum barbeiro possui faturamento dentro das faixas cadastradas." }); return; }
    setTransferring(true); setMessage(null);
    try {
      const batch = writeBatch(db);
      let transferred = 0;
      let protectedPayments = 0;
      applicable.forEach(({ stat, result }) => {
        const paymentId = `pay_import_${period}_${stat.barberId}`;
        const existing = payments.find((payment) => payment.id === paymentId) || payments.find((payment) => payment.userId === stat.barberId && payment.date.startsWith(period) && payment.status !== "PAGO");
        const paid = payments.find((payment) => payment.userId === stat.barberId && payment.date.startsWith(period) && payment.status === "PAGO");
        if (existing?.status === "PAGO" || paid) { protectedPayments += 1; return; }
        const lastDay = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
        const payment: PaymentRecord = {
          id: existing?.id || paymentId, userId: stat.barberId, date: `${period}-${lastDay}`,
          commissionAvulso: result.commission,
          commissionProductGeneral: existing?.commissionProductGeneral || 0,
          commissionProductAvant: existing?.commissionProductAvant || 0,
          commissionSubscriptions: existing?.commissionSubscriptions || 0,
          discount: existing?.discount || 0, discountDescription: existing?.discountDescription || "",
          discounts: existing?.discounts || [], status: existing?.status || "PENDENTE", isPaid: existing?.isPaid || false,
          amountToBePaid: Math.max(0, result.commission + (existing?.commissionProductGeneral || 0) + (existing?.commissionProductAvant || 0) + (existing?.commissionSubscriptions || 0) - (existing?.discount || 0)),
          potData: existing?.potData || [], ...(existing?.potPercentage !== undefined ? { potPercentage: existing.potPercentage } : {}),
        };
        batch.set(doc(db, "payments", payment.id), payment);
        transferred += 1;
      });
      if (!transferred) { setMessage({ type: "error", text: "Nenhuma comissão foi transferida porque os pagamentos deste período já estão quitados." }); return; }
      await batch.commit();
      setMessage({ type: "success", text: `${transferred} comissão(ões) transferida(s) para Pagamentos${protectedPayments ? `; ${protectedPayments} pagamento(s) quitado(s) foram preservados` : ""}.` });
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: error?.code === "permission-denied" ? "Operação bloqueada: você não tem permissão para esta unidade." : "Não foi possível transferir. Nenhuma alteração parcial foi aplicada; verifique a conexão e tente novamente." });
    } finally { setTransferring(false); }
  };

  return <div className="space-y-6">
    <AppPageHeader eyebrow="Financeiro" title="Cálculo de Comissão" description="Configure faixas por unidade e calcule automaticamente a comissão sobre o faturamento total dos profissionais." icon={<Calculator className="h-5 w-5" />} />
    <AppCard className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Unidade<select className={`${appControlClass} mt-2 w-full`} value={unitId} onChange={(event) => setUnitId(event.target.value)}>{allowedUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <label className="text-sm font-bold">Período do cálculo<input className={`${appControlClass} mt-2 w-full`} type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
      </div>
    </AppCard>
    {message && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === "error" ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"}`}>{message.text}</div>}
    <AppCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-200 p-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Faixas de faturamento</h2><p className="text-sm text-gray-500">Os limites são inclusivos. Não são permitidas sobreposições.</p></div><button disabled={!unitId || loading} onClick={() => setBrackets((items) => [...items, emptyBracket(unitId)])} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Plus className="h-4 w-4" />Adicionar faixa</button></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-gray-500"><Loader2 className="animate-spin" />Carregando faixas...</div> : <div className="space-y-3 p-5">{brackets.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">Nenhuma faixa cadastrada para esta unidade.</p>}{brackets.map((item, index) => <div key={item.id} className="grid items-end gap-3 rounded-xl border border-gray-200 p-4 dark:border-zinc-800 sm:grid-cols-[1fr_1fr_1fr_auto]"><label className="text-xs font-bold uppercase text-gray-500">Valor mínimo<input type="number" min="0" step="0.01" value={item.minimumRevenue || ""} onChange={(event) => updateBracket(item.id, "minimumRevenue", event.target.value)} className={`${appControlClass} mt-2 w-full`} /></label><label className="text-xs font-bold uppercase text-gray-500">Valor máximo<input type="number" min="0" step="0.01" value={item.maximumRevenue || ""} onChange={(event) => updateBracket(item.id, "maximumRevenue", event.target.value)} className={`${appControlClass} mt-2 w-full`} /></label><label className="text-xs font-bold uppercase text-gray-500">Comissão (%)<input type="number" min="0.01" max="100" step="0.01" value={item.percentage || ""} onChange={(event) => updateBracket(item.id, "percentage", event.target.value)} className={`${appControlClass} mt-2 w-full`} /></label><button aria-label={`Excluir faixa ${index + 1}`} onClick={() => setBrackets((items) => items.filter((entry) => entry.id !== item.id))} className="flex min-h-10 items-center justify-center rounded-xl border border-red-500/30 px-3 text-red-500"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
      <div className="flex justify-end border-t border-gray-200 p-5 dark:border-zinc-800"><button disabled={saving || loading || !unitId} onClick={saveBrackets} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--theme-color)] px-5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Salvando..." : "Salvar faixas"}</button></div>
    </AppCard>
    <div className="flex justify-end">
      <button
        disabled={transferring || saving || loading || !calculations.length}
        onClick={transferToPayments}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {transferring ? "Transferindo..." : "Transferir cálculo para Pagamentos"}
      </button>
    </div>
    <AppCard className="overflow-hidden"><div className="border-b border-gray-200 p-5 dark:border-zinc-800"><h2 className="text-lg font-black">Prévia das comissões</h2><p className="text-sm text-gray-500">Base: faturamento total registrado na análise do barbeiro.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-zinc-950"><tr><th className="p-4">Profissional</th><th className="p-4 text-right">Faturamento total</th><th className="p-4 text-right">Faixa</th><th className="p-4 text-right">Percentual</th><th className="p-4 text-right">Comissão Avulso</th></tr></thead><tbody>{calculations.map(({ stat, user, revenue, result }) => <tr key={stat.id} className="border-t border-gray-100 dark:border-zinc-800"><td className="p-4 font-bold">{user?.name || stat.barberId}</td><td className="p-4 text-right">{currency.format(revenue)}</td><td className="p-4 text-right text-gray-500">{result.bracket ? `${currency.format(result.bracket.minimumRevenue)} a ${currency.format(result.bracket.maximumRevenue)}` : "Sem faixa"}</td><td className="p-4 text-right">{result.percentage.toFixed(2)}%</td><td className="p-4 text-right font-black text-emerald-500">{currency.format(result.commission)}</td></tr>)}{!calculations.length && <tr><td colSpan={5} className="p-10 text-center text-gray-500">Nenhum faturamento de barbeiro encontrado neste período e unidade.</td></tr>}</tbody></table></div></AppCard>
  </div>;
}

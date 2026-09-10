import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { PaymentRecord, PotServiceData } from '../types';
import { FileText, Plus, Save, Trash2, Check, X, DollarSign, User as UserIcon, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { AppEmptyState, AppPageHeader } from './ui/AppPrimitives';
import { createBarberPaymentNotification } from '../notificationService';
import { calculatePaymentTotals } from '../services/financialEngine';

export function PaymentsTab() {
  const { users, payments, addPayment, updatePayment, deletePayment, addTransaction, deleteTransaction, catalog, systemUnits, addNotification } = useStore();
  
  const barbers = useMemo(() => {
    return users.filter(u => u.role === 'BARBER' || u.role === 'MANICURE');
  }, [users]);

  const [selectedBarberId, setSelectedBarberId] = useState<string>(barbers[0]?.id || '');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [collapsedUnits, setCollapsedUnits] = useState<Record<string, boolean>>({});

  const toggleUnitCollapse = (groupKey: string) => {
    setCollapsedUnits(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  useEffect(() => {
    if ((!selectedBarberId || !barbers.some(b => b.id === selectedBarberId)) && barbers.length > 0) {
      setSelectedBarberId(barbers[0].id);
    }
  }, [barbers, selectedBarberId]);

  const groupedBarbers = useMemo(() => {
    const groups: { unit: { id: string; name: string } | null; members: typeof barbers }[] = [];
    
    // Create map for rapid lookup of units
    const unitsMap = new Map<string, { id: string; name: string }>();
    (systemUnits || []).forEach(unit => {
      unitsMap.set(unit.id, unit);
    });

    const groupedMap = new Map<string, typeof barbers>();
    const noUnitMembers: typeof barbers = [];

    barbers.forEach(b => {
      const uId = b.unit;
      if (uId && unitsMap.has(uId)) {
        if (!groupedMap.has(uId)) {
          groupedMap.set(uId, []);
        }
        groupedMap.get(uId)!.push(b);
      } else {
        noUnitMembers.push(b);
      }
    });

    // Sort units alphabetically and compile groups
    const sortedUnits = [...(systemUnits || [])].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedUnits.forEach(unit => {
      const members = groupedMap.get(unit.id) || [];
      if (members.length > 0) {
        groups.push({
          unit,
          members: members.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
    });

    if (noUnitMembers.length > 0) {
      groups.push({
        unit: null,
        members: noUnitMembers.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    return groups;
  }, [barbers, systemUnits]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Form State
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10)); // Today
  
  const [comAvulso, setComAvulso] = useState<number>(0);
  const [comProdGeral, setComProdGeral] = useState<number>(0);
  const [comProdAvant, setComProdAvant] = useState<number>(0);
  const [comAssinaturas, setComAssinaturas] = useState<number>(0);
  const [discountsList, setDiscountsList] = useState<{description: string, value: number}[]>([{ description: '', value: 0 }]);
  const [valorPago, setValorPago] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'PENDENTE' | 'AGENDADO' | 'PAGO'>('PENDENTE');
  const [potPercentage, setPotPercentage] = useState<number>(0);

  // Pot Services State
  const [potServices, setPotServices] = useState<PotServiceData[]>([
     { id: 'corte', name: 'Corte', quantity: 0, tokens: 0 },
     { id: 'barba', name: 'Barba', quantity: 0, tokens: 0 },
     { id: 'corte_barba', name: 'Corte e barba', quantity: 0, tokens: 0 },
     { id: 'corte_vip', name: 'Corte VIP', quantity: 0, tokens: 0 },
     { id: 'barba_vip', name: 'Barba VIP', quantity: 0, tokens: 0 },
     { id: 'pezinho_penteado', name: 'Pezinho e Penteado', quantity: 0, tokens: 0 }
  ]);
  const [newServiceName, setNewServiceName] = useState('');

  const selectedBarber = barbers.find(b => b.id === selectedBarberId);
  const barberPayments = payments.filter(p => p.userId === selectedBarberId).sort((a,b) => b.date.localeCompare(a.date));

  const startNewPayment = () => {
     setEditingPaymentId(null);
     setIsEditing(true);
     setDate(new Date().toISOString().slice(0, 10));
     setComAvulso(0); setComProdGeral(0); setComProdAvant(0); setComAssinaturas(0);
     setDiscountsList([{ description: '', value: 0 }]); setValorPago(0); setPaymentStatus('PENDENTE');
     setPotPercentage(0);
     setPotServices([
       { id: 'corte', name: 'Corte', quantity: 0, tokens: 0 },
       { id: 'barba', name: 'Barba', quantity: 0, tokens: 0 },
       { id: 'corte_barba', name: 'Corte e barba', quantity: 0, tokens: 0 },
       { id: 'corte_vip', name: 'Corte VIP', quantity: 0, tokens: 0 },
       { id: 'barba_vip', name: 'Barba VIP', quantity: 0, tokens: 0 },
       { id: 'pezinho_penteado', name: 'Pezinho e Penteado', quantity: 0, tokens: 0 }
     ]);
  };

  const startEditPayment = (payment: PaymentRecord) => {
     setEditingPaymentId(payment.id);
     setIsEditing(true);
     setDate(payment.date);
     setComAvulso(payment.commissionAvulso);
     setComProdGeral(payment.commissionProductGeneral);
     setComProdAvant(payment.commissionProductAvant);
     setComAssinaturas(payment.commissionSubscriptions);
     setDiscountsList(payment.discounts && payment.discounts.length > 0 ? payment.discounts : [{ description: payment.discountDescription || '', value: payment.discount || 0 }]);
     setValorPago(payment.amountToBePaid);
     setPaymentStatus(payment.status || (payment.isPaid ? 'PAGO' : 'PENDENTE'));
     setPotPercentage(payment.potPercentage || 0);
     setPotServices(payment.potData && payment.potData.length > 0 ? payment.potData : [
       { id: 'corte', name: 'Corte', quantity: 0, tokens: 0 },
       { id: 'barba', name: 'Barba', quantity: 0, tokens: 0 },
       { id: 'corte_barba', name: 'Corte e barba', quantity: 0, tokens: 0 },
       { id: 'corte_vip', name: 'Corte VIP', quantity: 0, tokens: 0 },
       { id: 'barba_vip', name: 'Barba VIP', quantity: 0, tokens: 0 },
       { id: 'pezinho_penteado', name: 'Pezinho e Penteado', quantity: 0, tokens: 0 }
     ]);
  };

  const paymentCalculation = calculatePaymentTotals({ commissionAvulso: comAvulso, commissionProductGeneral: comProdGeral, commissionProductAvant: comProdAvant, commissionSubscriptions: comAssinaturas, discount: 0, discounts: discountsList });
  const totalDiscount = paymentCalculation.discounts;

  const getCommissionTransactionId = (paymentId: string) => `commission_payment_${paymentId}`;

  const formatPaymentDate = (paymentDate: string) => {
    const [year, month, day] = paymentDate.split('-');
    return year && month && day ? `${day}/${month}/${year}` : paymentDate;
  };

  const syncPaymentWithCash = async (record: PaymentRecord, previousWasPaid = false) => {
    const transactionId = getCommissionTransactionId(record.id);

    if (record.status !== 'PAGO') {
      if (previousWasPaid) await deleteTransaction(transactionId);
      return;
    }

    const barber = users.find(user => user.id === record.userId);
    const barberName = barber?.name || 'Profissional não identificado';
    await addTransaction({
      id: transactionId,
      type: 'EXPENSE',
      category: 'Comissões',
      description: `Comissão - ${barberName} - ${formatPaymentDate(record.date)}`,
      amount: record.amountToBePaid,
      date: record.date,
      dueDate: record.date,
      unitId: barber?.unit || 'ALL',
      status: 'PAGO',
      supplier: barberName,
      classification: 'COMISSOES',
      sourceChannel: 'OTHER',
      paymentMethod: 'OTHER',
      movementNature: 'EXPENSE',
      reconciliationStatus: 'NOT_APPLICABLE',
      sourceReference: record.id,
    });
  };
  
  const handleSavePayment = async () => {
      const record: PaymentRecord = {
         id: editingPaymentId || crypto.randomUUID(),
         userId: selectedBarberId,
         date,
         commissionAvulso: comAvulso,
         commissionProductGeneral: comProdGeral,
         commissionProductAvant: comProdAvant,
         commissionSubscriptions: comAssinaturas,
         discount: totalDiscount,
         discountDescription: discountsList.map(d => d.description).filter(Boolean).join(', '),
         discounts: discountsList,
         amountToBePaid: valorPago === 0 ? totalLiquidoCalculado : valorPago,
         status: paymentStatus,
         isPaid: paymentStatus === 'PAGO',
         potData: potServices,
         potPercentage: potPercentage
      };
      const previousPayment = editingPaymentId
        ? payments.find(payment => payment.id === editingPaymentId)
        : undefined;
      const previousWasPaid = previousPayment?.status === 'PAGO' || Boolean(previousPayment?.isPaid && !previousPayment.status);

      try {
        if (editingPaymentId) {
           await updatePayment(record);
        } else {
           await addPayment(record);
           // Enviar notificação ao barbeiro sobre o novo pagamento
           await addNotification(
             createBarberPaymentNotification(
               selectedBarberId,
               record.amountToBePaid,
               record.date,
               record.status
             )
           );
        }
        await syncPaymentWithCash(record, previousWasPaid);
      } catch (error) {
        console.error('Erro ao salvar pagamento e sincronizar com o Caixa:', error);
        alert('Não foi possível salvar o pagamento ou sincronizá-lo com o Caixa. Tente novamente.');
        return;
      }
      setIsEditing(false);
      setEditingPaymentId(null);
  };

  const handleStatusChange = async (
    payment: PaymentRecord,
    newStatus: 'PENDENTE' | 'AGENDADO' | 'PAGO'
  ) => {
    const previousWasPaid = payment.status === 'PAGO' || Boolean(payment.isPaid && !payment.status);
    const updatedPayment = { ...payment, status: newStatus, isPaid: newStatus === 'PAGO' };

    try {
      await updatePayment(updatedPayment);
      await syncPaymentWithCash(updatedPayment, previousWasPaid);
    } catch (error) {
      console.error('Erro ao atualizar status e sincronizar com o Caixa:', error);
      alert('Não foi possível atualizar o status ou sincronizá-lo com o Caixa.');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePayment(paymentId);
      await deleteTransaction(getCommissionTransactionId(paymentId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Erro ao excluir pagamento e lançamento do Caixa:', error);
      alert('Não foi possível excluir o pagamento. Tente novamente.');
    }
  };

  const handleAddPotService = () => {
      if(!newServiceName) return;
      setPotServices([...potServices, {
          id: 'custom_' + Date.now().toString(),
          name: newServiceName,
          quantity: 0,
          tokens: 0
      }]);
      setNewServiceName('');
  };

  const updatePotService = (id: string, field: 'quantity' | 'tokens', value: number) => {
      setPotServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removePotService = (id: string) => {
      setPotServices(prev => prev.filter(s => s.id !== id));
  };
  
  const totalPagamentoBruto = paymentCalculation.grossCommission;
  const totalLiquidoCalculado = paymentCalculation.netPayment;

  return (
    <div className="space-y-6">
      <AppPageHeader
        eyebrow="Financeiro"
        title="Pagamentos da equipe"
        description="Organize comissões, descontos, assinaturas e histórico de pagamentos por profissional."
        icon={<DollarSign className="h-5 w-5" />}
        actions={(
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">{barbers.length} profissionais</span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{payments.filter(payment => payment.status !== 'PAGO').length} pendentes</span>
          </div>
        )}
      />
      <div className="flex flex-col gap-6 md:flex-row">
       {/* BARBER SELECTOR */}
       <aside className="w-full md:w-80 flex-shrink-0 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
             <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
               <UserIcon className="w-4 h-4 text-blue-600" />
               Selecionar Barbeiro
             </h3>
             
             <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
               {groupedBarbers.map(group => {
                 const unitKey = group.unit ? group.unit.id : 'no-unit';
                 const isCollapsed = collapsedUnits[unitKey];
                 return (
                 <div key={unitKey} className="space-y-1.5 border border-gray-100 rounded-lg overflow-hidden pb-1">
                   <button onClick={() => toggleUnitCollapse(unitKey)} className="w-full flex items-center justify-between text-3xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-2 transition-colors cursor-pointer">
                     {group.unit ? group.unit.name : 'Outras Unidades / Sem Unidade'}
                     {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />}
                   </button>
                   {!isCollapsed && (
                   <ul className="space-y-1 px-1.5 pt-0.5 pb-1">
                     {group.members.map(b => (
                       <li key={b.id}>
                         <button
                           onClick={() => { setSelectedBarberId(b.id); setIsEditing(false); }}
                           className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-all text-sm font-semibold cursor-pointer border select-none ${
                             selectedBarberId === b.id 
                               ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm' 
                               : 'text-gray-600 bg-transparent hover:bg-gray-50 dark:hover:bg-zinc-800 border-transparent hover:border-gray-200'
                           }`}
                         >
                           <span className="truncate">{b.name}</span>
                           <span className="text-3xs font-bold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                             {b.role === 'MANICURE' ? 'Manicure' : 'Barbeiro'}
                           </span>
                         </button>
                       </li>
                     ))}
                   </ul>
                   )}
                 </div>
                 );
               })}
               
               {groupedBarbers.length === 0 && (
                 <p className="text-sm text-gray-400 text-center py-4">Nenhum barbeiro cadastrado.</p>
               )}
             </div>
          </div>
       </aside>

       <div className="flex-1 space-y-6">
          {selectedBarber ? (
            <>
              {isEditing ? (
                 <div className="bg-white dark:bg-zinc-900 p-6 dark:border-zinc-800 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between border-b pb-4 mb-6">
                       <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><DollarSign className="w-6 h-6 text-blue-600"/> {editingPaymentId ? 'Edição de Pagamento' : 'Lançamento de Pagamento'}</h2>
                       <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700 font-medium px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">Cancelar</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                       <div className="space-y-4">
                           <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg inline-block">Comissões</h3>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Data</label>
                                 <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                              </div>
                              <div />
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Comissão Avulso (R$)</label>
                                 <input type="number" step="0.01" value={comAvulso === 0 ? '' : comAvulso} onChange={e => setComAvulso(parseFloat(e.target.value)||0)} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Com. Prod. Geral (R$)</label>
                                 <input type="number" step="0.01" value={comProdGeral === 0 ? '' : comProdGeral} onChange={e => setComProdGeral(parseFloat(e.target.value)||0)} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Com. Prod. Avant (R$)</label>
                                 <input type="number" step="0.01" value={comProdAvant === 0 ? '' : comProdAvant} onChange={e => setComProdAvant(parseFloat(e.target.value)||0)} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-gray-600 mb-1">Com. Assinaturas (R$)</label>
                                 <input type="number" step="0.01" value={comAssinaturas === 0 ? '' : comAssinaturas} onChange={e => setComAssinaturas(parseFloat(e.target.value)||0)} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                              </div>
                           </div>
                           
                           <div className="border-t pt-4">
                              <h3 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg inline-block mb-3">Abatimentos</h3>
                              {discountsList.map((d, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3 items-end">
                                   <div className="md:col-span-2">
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Desconto (R$)</label>
                                      <input type="number" step="0.01" value={d.value === 0 ? '' : d.value} onChange={e => {
                                         const newList = [...discountsList];
                                         newList[index] = { ...newList[index], value: parseFloat(e.target.value) || 0 };
                                         setDiscountsList(newList);
                                      }} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                                   </div>
                                   <div className="md:col-span-2">
                                      <label className="block text-xs font-semibold text-gray-600 mb-1">Discriminação</label>
                                      <input type="text" placeholder="Motivo do desconto..." value={d.description} onChange={e => {
                                         const newList = [...discountsList];
                                         newList[index] = { ...newList[index], description: e.target.value };
                                         setDiscountsList(newList);
                                      }} className="w-full border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                                   </div>
                                   <div className="md:col-span-1 pb-1">
                                      <button type="button" onClick={() => {
                                         if(discountsList.length > 1) {
                                           setDiscountsList(discountsList.filter((_, i) => i !== index));
                                         } else {
                                           setDiscountsList([{description: '', value: 0}]);
                                         }
                                      }} className="p-2 text-gray-400 hover:text-red-500" title="Remover desconto">
                                         <Trash2 className="w-5 h-5"/>
                                      </button>
                                   </div>
                                </div>
                              ))}
                              <button type="button" onClick={() => setDiscountsList([...discountsList, {description: '', value: 0}])} className="text-sm text-blue-600 font-semibold flex items-center gap-1 mt-2 hover:text-blue-800">
                                <Plus className="w-4 h-4"/> Adicionar mais um abatimento
                              </button>
                           </div>

                           <div className="bg-gray-50 dark:bg-zinc-800/60 p-4 border dark:border-zinc-800 rounded-xl space-y-3 mt-4">
                              <div className="flex justify-between items-center text-sm">
                                 <span className="text-gray-600">Total Bruto</span>
                                 <span className="font-bold">R$ {totalPagamentoBruto.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                 <span className="text-gray-600">Descontos</span>
                                 <span className="font-bold text-red-600">- R$ {totalDiscount.toFixed(2)}</span>
                              </div>
                              <div className="border-t pt-2 flex justify-between items-center bg-blue-100 -mx-4 p-4 -mb-4 rounded-b-xl">
                                  <div>
                                    <label className="block text-xs font-bold text-blue-900 uppercase">Valor a ser Pago (R$)</label>
                                    <p className="text-xs text-blue-700 font-medium">Você pode reajustar manualmente</p>
                                  </div>
                                  <input type="number" step="0.01" value={valorPago === 0 ? totalLiquidoCalculado : valorPago} onChange={e => setValorPago(parseFloat(e.target.value)||0)} className="w-32 border border-blue-300 dark:border-blue-900/40 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-bold text-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-right" />
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-3 pt-2">
                             <label className="font-bold text-gray-800 text-sm">Status do Pagamento:</label>
                             <select
                               value={paymentStatus}
                               onChange={e => setPaymentStatus(e.target.value as 'PENDENTE' | 'AGENDADO' | 'PAGO')}
                               className="border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                             >
                                <option value="PENDENTE">Pendente</option>
                                <option value="AGENDADO">Agendado</option>
                                <option value="PAGO">Pago</option>
                             </select>
                           </div>
                       </div>

                       <div className="space-y-4">
                           <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 uppercase bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg inline-block">Dados do Pote</h3>
                           <p className="text-xs text-gray-500 mb-2">Informe as porcentagens, quantidades e fichas referentes a este pagamento.</p>
                           
                           <div className="bg-purple-50/40 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-100/60 dark:border-zinc-800/40">
                               <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 uppercase mb-1">Porcentagem do Pote (%)</label>
                               <input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  placeholder="Ex: 50" 
                                  value={potPercentage === 0 ? '' : potPercentage} 
                                  onChange={e => setPotPercentage(parseFloat(e.target.value)||0)} 
                                  className="w-40 border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white font-medium text-sm" 
                               />
                           </div>
                           <div className="space-y-3">
                              {potServices.map(s => (
                                 <div key={s.id} className="flex flex-col md:flex-row items-center gap-2 bg-gray-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-gray-100 dark:border-zinc-800">
                                     <div className="flex-1 font-semibold text-gray-700 text-sm pl-2 truncate" title={s.name}>{s.name}</div>
                                     <div className="flex items-center gap-2">
                                         <div className="w-24">
                                            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-0.5">Quant.</label>
                                            <input type="number" min="0" value={s.quantity === 0 ? '' : s.quantity} onChange={e => updatePotService(s.id, 'quantity', parseInt(e.target.value)||0)} className="w-full border border-gray-250 dark:border-zinc-800 p-1.5 rounded text-sm outline-none focus:border-purple-400 font-medium bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                                         </div>
                                         <div className="w-24">
                                            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-0.5">Fichas</label>
                                            <input type="number" min="0" value={s.tokens === 0 ? '' : s.tokens} onChange={e => updatePotService(s.id, 'tokens', parseInt(e.target.value)||0)} className="w-full border border-gray-250 dark:border-zinc-800 p-1.5 rounded text-sm outline-none focus:border-purple-400 font-medium bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                                         </div>
                                         <button onClick={() => removePotService(s.id)} className="mt-4 p-1.5 text-gray-400 hover:text-red-500" title="Remover serviço"><Trash2 className="w-4 h-4"/></button>
                                     </div>
                                 </div>
                              ))}

                              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dashed border-gray-300">
                                  <input type="text" placeholder="Nome do novo serviço..." value={newServiceName} onChange={e => setNewServiceName(e.target.value)} className="flex-1 border border-gray-300 dark:border-zinc-800 p-2 rounded-lg outline-none focus:border-purple-400 text-sm bg-white dark:bg-zinc-950 text-gray-900 dark:text-white" />
                                  <button type="button" onClick={handleAddPotService} className="bg-gray-800 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50" disabled={!newServiceName.trim()}>+ Adicionar</button>
                              </div>
                           </div>
                       </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t">
                        <button onClick={handleSavePayment} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-md transition-all flex items-center gap-2">
                            <Save className="w-5 h-5"/> Salvar Pagamento
                        </button>
                    </div>
                 </div>
              ) : (
                 <div className="bg-white dark:bg-zinc-900 p-6 dark:border-zinc-800 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                       <div>
                         <h2 className="text-xl font-bold text-gray-900 border-b pb-2 inline-block">Histórico de Pagamentos</h2>
                         <p className="text-sm text-gray-500 mt-1">Barbeiro: <span className="font-bold text-gray-800">{selectedBarber?.name}</span></p>
                       </div>
                       <button onClick={startNewPayment} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2">
                           <Plus className="w-5 h-5"/> Novo Pagamento
                       </button>
                    </div>

                    {deleteConfirmId && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                           <div>
                              <p className="text-sm text-red-800 font-bold">Deseja realmente excluir este pagamento?</p>
                              <p className="text-xs text-red-600 mt-1">Essa operação é permanente e removerá o registro financeiro anterior.</p>
                           </div>
                           <div className="flex gap-2 shrink-0">
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3.5 py-1.5 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-zinc-300 transition cursor-pointer">Cancelar</button>
                              <button onClick={() => handleDeletePayment(deleteConfirmId)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer">Excluir</button>
                           </div>
                        </div>
                     )}

                     {barberPayments.length === 0 ? (
                       <div className="text-center py-10 bg-gray-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
                          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 font-medium">Nenhum pagamento registrado para {selectedBarber?.name}.</p>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {barberPayments.map(p => (
                             <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                <div className="bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 border-b dark:border-zinc-800 flex justify-between items-center">
                                   <div className="font-bold text-gray-800 text-lg">{p.date}</div>
                                   <div className="flex items-center gap-4">
                                      <select 
                                         value={p.status || (p.isPaid ? 'PAGO' : 'PENDENTE')}
                                         onChange={async e => {
                                            const newStatus = e.target.value as 'PENDENTE' | 'AGENDADO' | 'PAGO';
                                            await handleStatusChange(p, newStatus);
                                         }}
                                         className={`text-xs font-bold uppercase rounded-full px-3 py-1 outline-none cursor-pointer border ${
                                            (p.status === 'PAGO' || (p.isPaid && !p.status)) ? 'bg-green-100 text-green-800 border-green-200' : 
                                            p.status === 'AGENDADO' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                                            'bg-yellow-100 text-yellow-800 border-yellow-200'
                                         }`}
                                      >
                                         <option value="PENDENTE">Pendente</option>
                                         <option value="AGENDADO">Agendado</option>
                                         <option value="PAGO">Pago</option>
                                      </select>
                                      <button onClick={() => startEditPayment(p)} className="text-gray-400 hover:text-blue-500 p-1" title="Editar pagamento"><Edit2 className="w-4 h-4"/></button>
                                      <button onClick={() => setDeleteConfirmId(p.id)} className="text-gray-400 hover:text-red-500 p-1" title="Excluir pagamento"><Trash2 className="w-4 h-4"/></button>
                                   </div>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                   <div className="space-y-1">
                                      <p className="text-[10px] uppercase font-bold text-gray-500 mb-2">Comissões</p>
                                      <p className="text-sm flex justify-between"><span className="text-gray-600">Avulso</span> <b>R$ {p.commissionAvulso.toFixed(2)}</b></p>
                                      <p className="text-sm flex justify-between"><span className="text-gray-600">Prod. Geral</span> <b>R$ {p.commissionProductGeneral.toFixed(2)}</b></p>
                                      <p className="text-sm flex justify-between"><span className="text-gray-600">Prod. Avant</span> <b>R$ {p.commissionProductAvant.toFixed(2)}</b></p>
                                      <p className="text-sm flex justify-between"><span className="text-gray-600">Assinaturas</span> <b>R$ {p.commissionSubscriptions.toFixed(2)}</b></p>
                                      
                                      {p.discounts && p.discounts.length > 0 ? (
                                        <div className="pt-2 border-t mt-1">
                                          {p.discounts.map((d, i) => d.value > 0 && (
                                            <p key={i} className="text-sm flex justify-between text-red-600 pl-2 mb-1">
                                              <span>Desc. ({d.description || 'S/N'})</span>
                                              <b>- R$ {d.value.toFixed(2)}</b>
                                            </p>
                                          ))}
                                        </div>
                                      ) : (
                                        p.discount > 0 && <p className="text-sm flex justify-between pt-1 border-t"><span className="text-red-600">Desc. ({p.discountDescription})</span> <b className="text-red-600">- R$ {p.discount.toFixed(2)}</b></p>
                                      )}
                                      
                                      <p className="text-sm flex justify-between pt-1 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/80 p-1"><span className="text-gray-800 font-bold">Total a Pagar</span> <b className="text-blue-700">R$ {p.amountToBePaid.toFixed(2)}</b></p>
                                   </div>
                                   <div className="md:col-span-2 space-y-1">
                                      <div className="flex justify-between items-center mb-2">
                                         <p className="text-[10px] uppercase font-bold text-gray-500">Dados do Pote</p>
                                         {p.potPercentage !== undefined && p.potPercentage > 0 && (
                                            <span className="text-xs font-bold text-purple-700 bg-purple-100/60 dark:bg-purple-950/20 px-2 py-0.5 rounded-md">
                                               {p.potPercentage}% do Pote
                                            </span>
                                         )}
                                      </div>
                                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                          {p.potData.map((pd, index) => (
                                             (pd.quantity > 0 || pd.tokens > 0) ? (
                                                <div key={index} className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-2 border border-purple-100 dark:border-purple-800/50 flex flex-col justify-center text-center">
                                                   <span className="text-xs font-bold text-purple-900 dark:text-purple-100 truncate" title={pd.name}>{pd.name}</span>
                                                   <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">{pd.quantity} un / {pd.tokens} fichas</span>
                                                </div>
                                             ) : null
                                          ))}
                                          {p.potData.filter(pd => pd.quantity > 0 || pd.tokens > 0).length === 0 && <p className="text-xs text-gray-400">Nenhum dado do pote registrado.</p>}
                                      </div>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              )}
            </>
          ) : (
            <AppEmptyState
              icon={<UserIcon className="h-6 w-6" />}
              title="Selecione um profissional"
              description="Escolha um profissional na lista para visualizar ou registrar pagamentos."
              className="h-full min-h-[300px] bg-white dark:bg-zinc-900"
            />
          )}
       </div>
      </div>
    </div>
  );
}

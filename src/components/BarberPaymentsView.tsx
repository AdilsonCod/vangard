import React from 'react';
import { useStore } from '../store';
import { DollarSign, Check, Clock, Calendar } from 'lucide-react';

export function BarberPaymentsView() {
  const { currentUser, payments } = useStore();
  
  if (!currentUser) return null;

  const myPayments = payments
     .filter(p => p.userId === currentUser.id)
     .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Meus Pagamentos</h2>
       </div>

       {myPayments.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
             Nenhum pagamento registrado no seu histórico.
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {myPayments.map(p => (
                <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                   <div className="bg-gray-50 dark:bg-zinc-800 p-4 border-b dark:border-zinc-800 flex justify-between items-center">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500"/> {p.date}
                      </div>
                      <div>
                         {p.status === 'PAGO' || (p.isPaid && !p.status) ? (
                           <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1"><Check className="w-3 h-3"/> Pago</span>
                         ) : p.status === 'AGENDADO' ? (
                           <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> Agendado</span>
                         ) : (
                           <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> Pendente</span>
                         )}
                      </div>
                   </div>
                   
                   <div className="p-4 flex-1 space-y-4">
                      <div>
                         <p className="text-[10px] uppercase font-bold text-gray-500 mb-2">Comissões Recebidas</p>
                         <p className="text-sm flex justify-between"><span className="text-gray-600">Avulso</span> <b>R$ {p.commissionAvulso.toFixed(2)}</b></p>
                         <p className="text-sm flex justify-between"><span className="text-gray-600">Prod. Geral</span> <b>R$ {p.commissionProductGeneral.toFixed(2)}</b></p>
                         <p className="text-sm flex justify-between"><span className="text-gray-600">Prod. Avant</span> <b>R$ {p.commissionProductAvant.toFixed(2)}</b></p>
                         <p className="text-sm flex justify-between"><span className="text-gray-600">Assinaturas</span> <b>R$ {p.commissionSubscriptions.toFixed(2)}</b></p>
                      </div>

                      {p.discounts && p.discounts.length > 0 ? (
                        <div className="pt-3 border-t">
                          <p className="text-[10px] uppercase font-bold text-gray-500 mb-2">Abatimentos</p>
                          {p.discounts.map((d, i) => d.value > 0 && (
                            <p key={i} className="text-sm flex justify-between text-red-600 mb-1">
                              <span>Desc. ({d.description || 'S/N'})</span>
                              <b>- R$ {d.value.toFixed(2)}</b>
                            </p>
                          ))}
                        </div>
                      ) : p.discount > 0 ? (
                        <p className="text-sm flex justify-between pt-3 border-t"><span className="text-red-600">Desc. ({p.discountDescription})</span> <b className="text-red-600">- R$ {p.discount.toFixed(2)}</b></p>
                      ) : null}
                      
                      {p.potData && p.potData.length > 0 && (
                         <div className="pt-3 border-t">
                            <div className="flex justify-between items-center mb-2">
                               <p className="text-[10px] uppercase font-bold text-gray-500">Dados do Pote</p>
                               {p.potPercentage !== undefined && p.potPercentage > 0 && (
                                  <span className="text-xs font-bold text-[var(--theme-color)] bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded-md">
                                     {p.potPercentage}% do Pote
                                  </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {p.potData.map(pot => (pot.quantity > 0 || pot.tokens > 0) && (
                                 <div key={pot.id} className="text-xs">
                                    <span className="text-gray-500">{pot.name}:</span> <span className="font-bold text-gray-800">{pot.quantity} un.</span>
                                    {pot.tokens > 0 && <span className="text-gray-400 ml-1">({pot.tokens} fichas)</span>}
                                 </div>
                              ))}
                            </div>
                         </div>
                      )}
                   </div>
                   
                   <div className="bg-blue-50 dark:bg-zinc-800 border-t dark:border-zinc-700 p-4 flex justify-between items-center rounded-b-2xl">
                      <span className="text-blue-900 font-bold uppercase text-xs">Total a Receber</span> 
                      <b className="text-blue-700 text-lg">R$ {p.amountToBePaid.toFixed(2)}</b>
                   </div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
}

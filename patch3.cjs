const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

const handleSettleBatch = `
  const handleSettleBatch = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch || settledItems.has(batch.id)) return;
    
    addTransaction({
      id: crypto.randomUUID(),
      unitId: currentUser?.unitId || 'ALL',
      type: 'INCOME',
      category: 'Atendimentos Cartão (Lote)',
      description: \`[Conciliado Lote] \${batch.modalidade} - \${batch.dataVenda}\`,
      amount: batch.totalRedeLiquido,
      date: batch.dataVenda,
      status: 'RECEBIDO',
      classification: 'RECEBIMENTO_OPERACIONAL',
    } as any);

    const newSettled = new Set(settledItems);
    newSettled.add(batch.id);
    setSettledItems(newSettled);
    showToast(\`Lote de \${batch.modalidade} salvo com sucesso no Caixa Oficial!\`);
  };
`;

code = code.replace(
  'const handleSettleSelected = () => {',
  handleSettleBatch + '\n  const handleSettleSelected = () => {'
);

const regra2UI = `
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Regra de Conciliação 2
                </span>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Vendas Físicas do PDV Balcão vs. Extrato Adquirente Rede
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  Cruzamento por data de movimento, modalidade (Crédito / Débito) e conferência de lote.
                </p>
              </div>
              <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                <button
                  onClick={() => setViewModeRegra2('LOTE')}
                  className={\`px-4 py-1.5 text-xs font-bold rounded-lg transition \${viewModeRegra2 === 'LOTE' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400'}\`}
                >
                  Visão por Lotes
                </button>
                <button
                  onClick={() => setViewModeRegra2('DETALHADA')}
                  className={\`px-4 py-1.5 text-xs font-bold rounded-lg transition \${viewModeRegra2 === 'DETALHADA' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400'}\`}
                >
                  Visão 1 para 1
                </button>
              </div>
            </div>

            {viewModeRegra2 === 'LOTE' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                      <th className="py-3 px-4">Data Movimento</th>
                      <th className="py-3 px-4">Modalidade</th>
                      <th className="py-3 px-4">Total Bruto PDV</th>
                      <th className="py-3 px-4">Total Bruto Rede</th>
                      <th className="py-3 px-4">Diferença</th>
                      <th className="py-3 px-4">Total Líquido Rede (MDR)</th>
                      <th className="py-3 px-4">Taxa Média</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {batch.dataVenda}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700 dark:text-zinc-300">
                          {batch.modalidade}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {batch.totalPdv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {batch.totalRedeBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className={\`py-3 px-4 font-bold \${batch.diferencaBruta <= 1.00 ? 'text-emerald-600' : 'text-red-600'}\`}>
                          {batch.diferencaBruta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {batch.totalRedeLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          <span className="block text-[10px] text-amber-600 font-normal">
                            Desconto: {(batch.totalRedeBruto - batch.totalRedeLiquido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700 dark:text-zinc-300">
                          {batch.taxaMdrMedia.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-center">{renderStatusBadge(batch.status)}</td>
                        <td className="py-3 px-4 text-center">
                          {settledItems.has(batch.id) ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-bold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5" /> Salvo
                            </span>
                          ) : batch.status === 'CONCILIADO' ? (
                            <button
                              onClick={() => handleSettleBatch(batch.id)}
                              className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 font-bold rounded-lg transition"
                              title="Salvar Lote no Caixa"
                            >
                              Salvar Lote
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">Resolver Detalhada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {batches.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-gray-400">
                          Nenhum lote processado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
`;

// replace Regra 2 header
const oldHeader = `
            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Regra de Conciliação 2
              </span>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Vendas Físicas do PDV Balcão vs. Extrato Adquirente Rede
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Cruzamento por data de movimento, modalidade (Crédito / Débito) e conferência de lote.
              </p>
            </div>
`;

code = code.replace(oldHeader.trim(), regra2UI.trim());
// Add closing parenthesis for viewModeRegra2 === 'LOTE' ? (...) : (...)
code = code.replace(
  '                      <td colSpan={10} className="text-center py-8 text-gray-400">\n                        Nenhum registro da Regra 2 processado.\n                      </td>\n                    </tr>\n                  )}\n                </tbody>\n              </table>\n            </div>\n          </div>',
  '                      <td colSpan={10} className="text-center py-8 text-gray-400">\n                        Nenhum registro da Regra 2 processado.\n                      </td>\n                    </tr>\n                  )}\n                </tbody>\n              </table>\n            </div>\n            )} /* fecha viewModeRegra2 */\n          </div>'
);

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

const newTabBtn = `
          <button
            onClick={() => setActiveTab('REGRA_3')}
            className={\`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 \${
              activeTab === 'REGRA_3'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }\`}
          >
            <Sparkles className="w-4 h-4" />
            Regra 3: Assinaturas Balcão
          </button>
`;

code = code.replace(
  "          <button\n            onClick={() => setActiveTab('DIVERGENCIAS')}",
  newTabBtn + "\n          <button\n            onClick={() => setActiveTab('DIVERGENCIAS')}"
);

const newTabContent = `
        {/* ABA 3.5: REGRA 3 (ASSINATURAS BALCÃO) */}
        {activeTab === 'REGRA_3' && (
          <div className="p-6">
            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Regra de Conciliação 3 & 4
              </span>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Assinaturas Recebidas no Balcão (Cartão / PIX) vs. Gateway
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Roteamento de Entradas Manuais para a Adquirente ou Banco e Validação de Baixas Externas.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                    <th className="py-3 px-4">Cliente / ID</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor Bruto</th>
                    <th className="py-3 px-4">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {items
                    .filter((i) => i.regra.includes('REGRA_3') || i.regra.includes('REGRA_4'))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {item.clienteOuDesc}
                          <span className="block text-[11px] text-gray-400 font-normal mt-0.5">
                            Ref: {item.identificador}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-zinc-300 font-medium">
                          {item.modalidadeOuPlano}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-zinc-300">{item.dataVenda}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          {item.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          {item.valorMdrRetido > 0 && (
                            <span className="block text-[10px] text-amber-600 font-normal mt-0.5">
                              MDR Rede: -{item.valorMdrRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">{renderStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  {items.filter((i) => i.regra.includes('REGRA_3') || i.regra.includes('REGRA_4')).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400">
                        Nenhuma Assinatura de Balcão processada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
`;

code = code.replace(
  "{/* ABA 4: AUDITORIA DE DIVERGÊNCIAS & TAXAS */}",
  newTabContent + "\n        {/* ABA 4: AUDITORIA DE DIVERGÊNCIAS & TAXAS */}"
);

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const renderDPote = `
      {importType === 'DPOTE_PDF' && dpoteReport && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
           <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">Resumo do PDF D'Pote</h3>
              <span className="font-bold text-[var(--theme-color)]">
                Faturamento Total Assinaturas: {dpoteReport.totalAssinaturas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
           </div>
           <div className="divide-y divide-gray-100 dark:divide-zinc-800">
             {dpoteReport.barbers.map((b, i) => (
                <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div>
                     <p className="font-bold text-gray-900 dark:text-zinc-100">{b.name}</p>
                     <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Pote: <span className="font-semibold text-purple-600 dark:text-purple-400">{b.potPercentage}%</span> | 
                        Comissão: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{b.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                     </p>
                   </div>
                   <div className="w-full md:w-64">
                     <label className="block text-xs font-semibold text-gray-500 mb-1">Vincular a Usuário</label>
                     <select
                        value={manualUserMapping[b.name] || ''}
                        onChange={(e) => handleUserMapChange(b.name, e.target.value)}
                        className={\`w-full bg-white dark:bg-zinc-950 border \${!manualUserMapping[b.name] ? 'border-red-300 text-red-600 font-semibold' : 'border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100'} rounded-lg p-2 text-sm outline-none\`}
                      >
                        <option value="">Selecione...</option>
                        {users.filter(u => u.role === 'BARBER' || u.role === 'MANICURE').map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                     </select>
                   </div>
                </div>
             ))}
           </div>
        </div>
      )}
`;

// Also fix the unexpected } if any
const search = "      )}\n    </div>\n  );\n}";
content = content.replace(search, renderDPote + "\n" + search);
fs.writeFileSync('src/components/DataImporterView.tsx', content);


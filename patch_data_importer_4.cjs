const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const uiStr = `{importType === "CASHBARBER_PRODUTOS" && cashbarberReport && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm mt-6">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">
                Resumo da Comissão de Produtos (Cashbarber)
              </h3>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm border-b border-yellow-200 dark:border-yellow-900">
              Nota: A categoria "Bebidas" foi automaticamente desconsiderada desta contagem.
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {cashbarberReport.barbers.map((b, i) => (
                <div
                  key={i}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-gray-900 dark:text-zinc-100">
                      {b.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Produtos Vendidos: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalProducts}</span> |{" "}
                      Valor das Vendas: <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.totalSales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      Comissão:{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {b.totalCommission.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </p>
                  </div>
                  <div className="w-full md:w-64">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Vincular a Usuário
                    </label>
                    <select
                      value={manualUserMapping[b.name] || ""}
                      onChange={(e) =>
                        handleUserMapChange(b.name, e.target.value)
                      }
                      className={\`w-full bg-white dark:bg-zinc-950 border \${!manualUserMapping[b.name] ? "border-red-300 text-red-600 font-semibold" : "border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100"} rounded-lg p-2 text-sm outline-none\`}
                    >
                      <option value="">Selecione...</option>
                      {users
                        .filter(
                          (u) => u.role === "BARBER" || u.role === "MANICURE",
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-lg hover:bg-[#ff6b42] transition-colors shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Confirmar e Salvar
              </button>
            </div>
          </div>
        )}`;

if (!code.includes('importType === "CASHBARBER_PRODUTOS" && cashbarberReport')) {
  code = code.replace(
    `      </div>\n    );\n}`,
    `\n${uiStr}\n      </div>\n    );\n}`
  );
  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Patched UI");
}

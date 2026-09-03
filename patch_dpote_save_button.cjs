const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const targetToReplace = `                  <div className="w-full md:w-64">
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
          </div>
        )}`;

const newCode = `                  <div className="w-full md:w-64">
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

if (code.includes(targetToReplace)) {
  code = code.replace(targetToReplace, newCode);
  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Success");
} else {
  console.log("Not found");
}

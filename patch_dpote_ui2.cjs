const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const targetToReplace = `<p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Serviços: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalServices}</span> |{" "}
                      Fichas: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalTokens}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Serviços: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalServices}</span> |{" "}
                      Fichas: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalTokens}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      Pote:{" "}
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {b.potPercentage}%
                      </span>{" "}
                      | Comissão:{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.commission.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>
                  </div>`;

const newCode = `<p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Serviços: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalServices}</span> |{" "}
                      Fichas: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalTokens}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
                      Pote:{" "}
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {b.potPercentage}%
                      </span>{" "}
                      | Comissão:{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.commission.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>
                    
                    {b.services && b.services.length > 0 && (
                      <div className="mt-3 bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-800 p-2 overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                            <tr>
                              <th className="pb-1 font-semibold">Serviço</th>
                              <th className="pb-1 text-right font-semibold">Qtd</th>
                              <th className="pb-1 text-right font-semibold">Fichas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {b.services.map((svc, sIdx) => (
                              <tr key={sIdx}>
                                <td className="py-1 text-gray-800 dark:text-zinc-200">{svc.name}</td>
                                <td className="py-1 text-right text-gray-600 dark:text-zinc-400">{svc.quantity}</td>
                                <td className="py-1 text-right text-gray-600 dark:text-zinc-400">{svc.tokens}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>`;

if (code.includes(targetToReplace)) {
  code = code.replace(targetToReplace, newCode);
  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Success");
} else {
  console.log("Target not found!");
}

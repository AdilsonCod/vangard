const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const oldStr = `<p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
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
                    </p>`;

const newStr = `<p className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
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
                      </span>{" "}
                      | Fat. Assinaturas:{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {((b.potPercentage / 100) * dpoteReport.totalAssinaturas).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </p>`;

if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Success");
} else {
  console.log("Not found");
}

const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `            const fatAssinatura =
              (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura:
                (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
            });`,
  `            const fatAssinatura =
              (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;

            const qtyServices = barber.totalServices || barber.services.reduce((acc, s) => acc + s.quantity, 0);

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura:
                (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
              comissao: (currentStat.comissao || 0) + barber.commission,
              servicosRealizados: (currentStat.servicosRealizados || 0) + qtyServices,
            });`
);

code = code.replace(
  `<p className="text-sm text-gray-500 dark:text-zinc-400">
                      Pote:{" "}`,
  `<p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                      Serviços: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalServices}</span> |{" "}
                      Fichas: <span className="font-semibold text-gray-700 dark:text-gray-300">{b.totalTokens}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                      Pote:{" "}`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

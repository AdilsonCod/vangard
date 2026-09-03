const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `        if (importType === "DPOTE_PDF" && dpoteReport) {
          const unitIds = new Set<string>();

          for (const barber of dpoteReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId) continue;

            const user = users.find((u) => u.id === userId);
            if (user && user.unit) {
              unitIds.add(user.unit);
            }

            const userUnit = user?.unit || "ALL";
            const statId = \`\${monthStr}_\${userId}\`;
            const currentStat = monthlyBarberStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              barberId: userId,
              unitId: userUnit,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              comissao: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
              taxaRetorno: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
            };

            const fatAssinatura =
              (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura:
                (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
            });

            const lastDay = new Date(
              parseInt(selectedYear),
              parseInt(selectedMonth),
              0,
            );
            const dateStr = \`\${selectedYear}-\${selectedMonth}-\${String(lastDay.getDate()).padStart(2, "0")}\`;

            await addPayment({
              id:
                "pay_" +
                Date.now() +
                Math.random().toString(36).substring(2, 9),
              userId: userId,
              date: dateStr,
              commissionAvulso: 0,
              commissionProductGeneral: 0,
              commissionProductAvant: 0,
              commissionSubscriptions: barber.commission,
              discount: 0,
              discountDescription: "",
              amountToBePaid: barber.commission,
              status: "AGENDADO",
              isPaid: false,
              potData: barber.services,
              potPercentage: barber.potPercentage,
            });
          }
        }`,
  `        if (importType === "DPOTE_PDF" && dpoteReport) {
          // 1. Update Unit Stats with total subscriptions revenue
          const unitToUpdate = targetUnitId || "ALL";
          const unitStatId = \`\${monthStr}_\${unitToUpdate}\`;
          const currentUnitStat = monthlyUnitStats.find((s) => s.id === unitStatId) || {
            id: unitStatId,
            unitId: unitToUpdate,
            month: monthStr,
            faturamentoTotal: 0,
            faturamentoAssinatura: 0,
            assinantes: 0,
            clientesNovos: 0,
            clientesSemPreferencia: 0,
          };
          
          await updateMonthlyUnitStats({
            ...currentUnitStat,
            faturamentoAssinatura: (currentUnitStat.faturamentoAssinatura || 0) + dpoteReport.totalAssinaturas
          });

          for (const barber of dpoteReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId) continue;

            const user = users.find((u) => u.id === userId);
            const userUnit = user?.unit || unitToUpdate;
            const statId = \`\${monthStr}_\${userId}\`;
            const currentStat = monthlyBarberStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              barberId: userId,
              unitId: userUnit,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              comissao: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
              taxaRetorno: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
            };

            const fatAssinatura =
              (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;
              
            const qtyServices = barber.services.reduce((acc, s) => acc + s.quantity, 0);

            await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura: (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
              comissao: (currentStat.comissao || 0) + barber.commission,
              servicosRealizados: (currentStat.servicosRealizados || 0) + qtyServices
            });

            const lastDay = new Date(
              parseInt(selectedYear),
              parseInt(selectedMonth),
              0,
            );
            const dateStr = \`\${selectedYear}-\${selectedMonth}-\${String(lastDay.getDate()).padStart(2, "0")}\`;

            await addPayment({
              id:
                "pay_" +
                Date.now() +
                Math.random().toString(36).substring(2, 9),
              userId: userId,
              date: dateStr,
              commissionAvulso: 0,
              commissionProductGeneral: 0,
              commissionProductAvant: 0,
              commissionSubscriptions: barber.commission,
              discount: 0,
              discountDescription: "",
              amountToBePaid: barber.commission,
              status: "AGENDADO",
              isPaid: false,
              potData: barber.services,
              potPercentage: barber.potPercentage,
            });
          }
        }`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

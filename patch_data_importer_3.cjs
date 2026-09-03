const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const saveStr = `} else if (importType === "CASHBARBER_PRODUTOS" && cashbarberReport) {
          const unitIds = new Set<string>();

          for (const barber of cashbarberReport.barbers) {
            const userId = manualUserMapping[barber.name];
            if (!userId) continue;

            const user = users.find((u) => u.id === userId);
            if (user && user.unit) {
              unitIds.add(user.unit);
            }

            const userUnit = user?.unit || targetUnitId || "ALL";
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

            await updateMonthlyBarberStats({
              ...currentStat,
              vendaProdutosValor: (currentStat.vendaProdutosValor || 0) + barber.totalSales,
              vendasProdutosQtd: (currentStat.vendasProdutosQtd || 0) + barber.totalProducts,
              comissao: (currentStat.comissao || 0) + barber.totalCommission,
            });
            
            // Note: Since this is product commission, we probably want to add it to a payment as well.
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
              commissionProductGeneral: barber.totalCommission,
              commissionProductAvant: 0,
              commissionSubscriptions: 0,
              discount: 0,
              discountDescription: "",
              amountToBePaid: barber.totalCommission,
              status: "PENDENTE",
              isPaid: false,
            });
          }

          for (const uId of unitIds) {
            const statId = \`\${monthStr}_\${uId}\`;
            const currentUnitStat = monthlyUnitStats.find(
              (s) => s.id === statId,
            ) || {
              id: statId,
              unitId: uId,
              month: monthStr,
              faturamentoTotal: 0,
              faturamentoAssinatura: 0,
              assinantes: 0,
              clientesNovos: 0,
              clientesSemPreferencia: 0,
              clientesAtendidos: 0,
              servicosRealizados: 0,
              vendaProdutosValor: 0,
              vendasProdutosQtd: 0,
            };

            let totalVal = 0;
            let totalQtd = 0;
            for (const barber of cashbarberReport.barbers) {
              const u = users.find((uu) => uu.id === manualUserMapping[barber.name]);
              if (u && u.unit === uId) {
                totalVal += barber.totalSales;
                totalQtd += barber.totalProducts;
              }
            }

            await updateMonthlyUnitStats({
              ...currentUnitStat,
              vendaProdutosValor: (currentUnitStat.vendaProdutosValor || 0) + totalVal,
              vendasProdutosQtd: (currentUnitStat.vendasProdutosQtd || 0) + totalQtd,
            });
          }
        }`;

if (!code.includes('} else if (importType === "CASHBARBER_PRODUTOS" && cashbarberReport) {')) {
  code = code.replace(
    `        } else if (importType === "CATALOGO") {`,
    `${saveStr} else if (importType === "CATALOGO") {`
  );
  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Patched handleSave");
}

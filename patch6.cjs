const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const target = "    try {\n      if (importType === 'CATALOGO') {";
const replacement = `    try {
      if (importType === 'DPOTE_PDF' && dpoteReport) {
        const unitIds = new Set<string>();
        
        for (const barber of dpoteReport.barbers) {
           const userId = manualUserMapping[barber.name];
           if (!userId) continue;
           
           const user = users.find(u => u.id === userId);
           if (user && user.unit) {
              unitIds.add(user.unit);
           }
           
           const userUnit = user?.unit || 'ALL';
           const statId = \`\${monthStr}_\${userId}\`;
           const currentStat = monthlyBarberStats.find(s => s.id === statId) || {
              id: statId, barberId: userId, unitId: userUnit, month: monthStr,
              faturamentoTotal: 0, faturamentoAssinatura: 0, comissao: 0, clientesAtendidos: 0,
              servicosRealizados: 0, vendaProdutosValor: 0, vendasProdutosQtd: 0, taxaRetorno: 0, clientesNovos: 0, clientesSemPreferencia: 0
           };
           
           const fatAssinatura = (barber.potPercentage / 100) * dpoteReport.totalAssinaturas;
           
           await updateMonthlyBarberStats({
              ...currentStat,
              faturamentoAssinatura: (currentStat.faturamentoAssinatura || 0) + fatAssinatura,
           });
           
           const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);
           const dateStr = \`\${selectedYear}-\${selectedMonth}-\${String(lastDay.getDate()).padStart(2, '0')}\`;

           await addPayment({
              id: 'pay_' + Date.now() + Math.random().toString(36).substring(2, 9),
              userId: userId,
              date: dateStr,
              commissionAvulso: 0,
              commissionProductGeneral: 0,
              commissionProductAvant: 0,
              commissionSubscriptions: barber.commission,
              discount: 0,
              discountDescription: '',
              amountToBePaid: barber.commission,
              status: 'PENDENTE',
              isPaid: false,
              potPercentage: barber.potPercentage,
              potData: barber.services.map(s => ({
                  id: 'pot_' + Date.now() + Math.random().toString(36).substring(2, 9),
                  name: s.name,
                  quantity: s.quantity,
                  tokens: s.tokens
              }))
           });
        }
        
        for (const uId of unitIds) {
           const statId = \`\${monthStr}_\${uId}\`;
           const currentUnitStat = monthlyUnitStats.find(s => s.id === statId) || {
             id: statId, unitId: uId, month: monthStr, faturamentoTotal: 0, faturamentoAssinatura: 0, assinantes: 0, clientesNovos: 0, clientesSemPreferencia: 0, clientesAtendidos: 0, servicosRealizados: 0, vendaProdutosValor: 0, vendasProdutosQtd: 0
           };
           
           await updateMonthlyUnitStats({
              ...currentUnitStat,
              faturamentoAssinatura: (currentUnitStat.faturamentoAssinatura || 0) + dpoteReport.totalAssinaturas
           });
        }
      } else if (importType === 'CATALOGO') {`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/DataImporterView.tsx', content);
    console.log("Patched!");
} else {
    console.log("Target not found!");
}

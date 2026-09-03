import { getBarbeariaDemoData, runReconciliationEngine } from './src/utils/reconciliationEngine';

const demo = getBarbeariaDemoData();
const result = runReconciliationEngine(
  demo.pdv,
  demo.clube,
  demo.redePagamentos,
  demo.redeRecebidos,
  demo.previsao,
  demo.entradasManuais || []
);

console.log('KPIs:', JSON.stringify(result.kpis, null, 2));
console.log('Daily Closings:', result.dailyClosings.length);

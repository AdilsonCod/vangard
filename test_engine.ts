import { getBarbeariaDemoData, runReconciliationEngine } from './src/utils/reconciliationEngine.js';
const demo = getBarbeariaDemoData();
const result = runReconciliationEngine(demo.pdv, demo.clube, demo.redePagamentos, demo.redeRecebidos, demo.previsao);
console.log('Result items:', result.items.length);
console.log('Batches:', result.batches.length);

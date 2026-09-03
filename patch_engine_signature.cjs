const fs = require('fs');
let code = fs.readFileSync('src/utils/reconciliationEngine.ts', 'utf8');

// 1. Add EntradaManual to imports
code = code.replace(
  'ReconciliationKPIs,\n  BatchConciliationItem',
  'ReconciliationKPIs,\n  BatchConciliationItem,\n  EntradaManual'
);

// 2. Add entradasManuais to signature
code = code.replace(
  '  previsaoData: PrevisaoRecebivel[]\n): {',
  '  previsaoData: PrevisaoRecebivel[],\n  entradasManuais: EntradaManual[] = []\n): {'
);

fs.writeFileSync('src/utils/reconciliationEngine.ts', code);

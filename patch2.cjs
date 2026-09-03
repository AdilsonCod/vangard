const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

code = code.replace(
  'setCashFlowTimeline(result.cashFlowTimeline);',
  'setCashFlowTimeline(result.cashFlowTimeline);\n    if (result.batches) setBatches(result.batches);'
);

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

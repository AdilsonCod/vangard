const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

// 1. Add to imports
code = code.replace(
  'ReconciliationKPIs,\n  BatchConciliationItem',
  'ReconciliationKPIs,\n  BatchConciliationItem,\n  EntradaManual'
);

// 2. Add state
code = code.replace(
  '  const [previsaoData, setPrevisaoData] = useState<PrevisaoRecebivel[]>([]);',
  '  const [previsaoData, setPrevisaoData] = useState<PrevisaoRecebivel[]>([]);\n  const [entradasManuaisData, setEntradasManuaisData] = useState<EntradaManual[]>([]);'
);

// 3. Update handleLoadDemo
code = code.replace(
  '    setPrevisaoData(demo.previsao);',
  '    setPrevisaoData(demo.previsao);\n    setEntradasManuaisData(demo.entradasManuais || []);'
);

code = code.replace(
  '      demo.previsao\n    );',
  '      demo.previsao,\n      demo.entradasManuais || []\n    );'
);

// 4. Update handleClear
code = code.replace(
  '    setPrevisaoData([]);',
  '    setPrevisaoData([]);\n    setEntradasManuaisData([]);'
);

// 5. Update handleRunReconciliation
code = code.replace(
  '      previsaoData\n    );',
  '      previsaoData,\n      entradasManuaisData\n    );'
);

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

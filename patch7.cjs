const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `            {importType === "UNIDADE_ITENS" && (`,
  `            {(importType === "UNIDADE_ITENS" || importType === "DPOTE_PDF") && (`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

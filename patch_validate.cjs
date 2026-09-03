const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `    const handleSave = async () => {
      setIsSaving(true);
      const monthStr = \`\${selectedYear}-\${selectedMonth}\`;

      try {
        if (importType === "DPOTE_PDF" && dpoteReport) {`,
  `    const handleSave = async () => {
      if ((importType === "DPOTE_PDF" || importType === "UNIDADE_ITENS") && !targetUnitId) {
         alert("Por favor, selecione a Unidade Alvo antes de salvar.");
         return;
      }
      setIsSaving(true);
      const monthStr = \`\${selectedYear}-\${selectedMonth}\`;

      try {
        if (importType === "DPOTE_PDF" && dpoteReport) {`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

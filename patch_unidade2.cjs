const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `    const handleSave = async () => {
      if ((importType === "DPOTE_PDF" || importType === "UNIDADE_ITENS") && !targetUnitId) {
         alert("Por favor, selecione a Unidade Alvo antes de salvar.");
         return;
      }`,
  `    const handleSave = async () => {
      if (!targetUnitId && importType !== "CATALOGO") {
         alert("Por favor, selecione a Unidade Alvo antes de salvar.");
         return;
      }`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

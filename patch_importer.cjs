const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

if (!code.includes('"CASHBARBER_PRODUTOS"')) {
  code = code.replace(
    `    | "DPOTE_PDF"`,
    `    | "DPOTE_PDF"\n    | "CASHBARBER_PRODUTOS"`
  );
  
  code = code.replace(
    `<option value="DPOTE_PDF">Relatório D'Pote (PDF/Planilha)</option>`,
    `<option value="DPOTE_PDF">Relatório D'Pote (PDF/Planilha)</option>\n                <option value="CASHBARBER_PRODUTOS">Comissão de Produtos Cashbarber (Planilha/PDF)</option>`
  );

  fs.writeFileSync('src/components/DataImporterView.tsx', code);
  console.log("Patched");
}

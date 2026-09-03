const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

if (!code.includes('import { parseCashbarberProductsSpreadsheet, parseCashbarberProductsPDF, CashbarberProductReport } from "../CashbarberParser";')) {
  code = code.replace(
    `import { parseDPotePDF, DPoteReport, parseDPoteSpreadsheet } from "../DPoteParser";`,
    `import { parseDPotePDF, DPoteReport, parseDPoteSpreadsheet } from "../DPoteParser";\nimport { parseCashbarberProductsSpreadsheet, parseCashbarberProductsPDF, CashbarberProductReport } from "../CashbarberParser";`
  );
}

if (!code.includes('const [cashbarberReport, setCashbarberReport]')) {
  code = code.replace(
    `  const [dpoteReport, setDpoteReport] = useState<DPoteReport | null>(null);`,
    `  const [dpoteReport, setDpoteReport] = useState<DPoteReport | null>(null);\n  const [cashbarberReport, setCashbarberReport] = useState<CashbarberProductReport | null>(null);`
  );
}

if (!code.includes('if (importType === "CASHBARBER_PRODUTOS") {')) {
  const fileProcessStr = `if (importType === "CASHBARBER_PRODUTOS") {
        const handleCashbarberReport = (rep: CashbarberProductReport) => {
          setCashbarberReport(rep);
          const newMap = { ...manualUserMapping };
          rep.barbers.forEach((b) => {
            const matchedUser = users.find(
              (u) =>
                u.name.toLowerCase() === b.name.toLowerCase() ||
                u.name.toLowerCase().includes(b.name.toLowerCase()) ||
                b.name.toLowerCase().includes(u.name.toLowerCase()),
            );
            if (matchedUser) {
              newMap[b.name] = matchedUser.id;
            }
          });
          setManualUserMapping(newMap);
          setIsParsing(false);
        };

        if (fileName.endsWith(".pdf")) {
          parseCashbarberProductsPDF(file)
            .then(handleCashbarberReport)
            .catch((err) => {
              alert(err.message || "Erro ao ler PDF do Cashbarber");
              setIsParsing(false);
            });
        } else {
          parseCashbarberProductsSpreadsheet(file)
            .then(handleCashbarberReport)
            .catch((err) => {
              alert(err.message || "Erro ao ler Planilha do Cashbarber");
              setIsParsing(false);
            });
        }
        return;
      }`;
  
  code = code.replace(
    `      if (importType === "DPOTE_PDF") {`,
    `${fileProcessStr}\n\n      if (importType === "DPOTE_PDF") {`
  );
}

if (!code.includes('|| importType === "CASHBARBER_PRODUTOS"')) {
  code = code.replace(
    `if ((importType === "DPOTE_PDF" || importType === "UNIDADE_ITENS") && !targetUnitId) {`,
    `if ((importType === "DPOTE_PDF" || importType === "UNIDADE_ITENS" || importType === "CASHBARBER_PRODUTOS") && !targetUnitId) {`
  );
}

fs.writeFileSync('src/components/DataImporterView.tsx', code);
console.log("Patched");

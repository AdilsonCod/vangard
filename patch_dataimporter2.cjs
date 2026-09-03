const fs = require('fs');

let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

// Update Import
code = code.replace(
  `import { parseDPotePDF, DPoteReport } from "../DPoteParser";`,
  `import { parseDPotePDF, DPoteReport, parseDPoteSpreadsheet } from "../DPoteParser";`
);

// Update select option
code = code.replace(
  `<option value="DPOTE_PDF">Relatório D'Pote (PDF)</option>`,
  `<option value="DPOTE_PDF">Relatório D'Pote (PDF/Planilha)</option>`
);

// Update title
code = code.replace(
  `Resumo do PDF D'Pote`,
  `Resumo do Relatório D'Pote`
);

// Update processFile logic
const oldProcessLogic = `      if (importType === "DPOTE_PDF" && fileName.endsWith(".pdf")) {
        parseDPotePDF(file)
          .then((rep) => {
            setDpoteReport(rep);
            // Auto-map barbers to users if names match
            const newMap = { ...manualUserMapping };
            rep.barbers.forEach((b) => {
              const matchedUser = users.find(
                (u) =>
                  u.name.toLowerCase() === b.name.toLowerCase() ||
                  u.name
                    .toLowerCase()
                    .includes(b.name.toLowerCase().split(" ")[0]),
              );
              if (matchedUser) {
                newMap[b.name] = matchedUser.id;
              }
            });
            setManualUserMapping(newMap);
            setIsParsing(false);
          })
          .catch((err) => {
            console.error(err);
            setIsParsing(false);
            alert("Erro ao ler PDF");
          });
        return;
      }`;

const newProcessLogic = `      if (importType === "DPOTE_PDF") {
        const handleDPoteReport = (rep: DPoteReport) => {
          setDpoteReport(rep);
          const newMap = { ...manualUserMapping };
          rep.barbers.forEach((b) => {
            const matchedUser = users.find(
              (u) =>
                u.name.toLowerCase() === b.name.toLowerCase() ||
                u.name
                  .toLowerCase()
                  .includes(b.name.toLowerCase().split(" ")[0])
            );
            if (matchedUser) {
              newMap[b.name] = matchedUser.id;
            }
          });
          setManualUserMapping(newMap);
          setIsParsing(false);
        };

        if (fileName.endsWith(".pdf")) {
          parseDPotePDF(file)
            .then(handleDPoteReport)
            .catch((err) => {
              console.error(err);
              setIsParsing(false);
              alert("Erro ao ler PDF");
            });
        } else {
          parseDPoteSpreadsheet(file)
            .then(handleDPoteReport)
            .catch((err) => {
              console.error(err);
              setIsParsing(false);
              alert("Erro ao ler Planilha do D'Pote");
            });
        }
        return;
      }`;

code = code.replace(oldProcessLogic, newProcessLogic);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

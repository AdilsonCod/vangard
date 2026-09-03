const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

// Remove parsing logic from handleFileUpload
code = code.replace(
  `    if (
      importType === "DPOTE_PDF" &&
      file.name.toLowerCase().endsWith(".pdf")
    ) {
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
        })
        .catch((err) => {
          console.error(err);
          alert("Erro ao ler PDF");
        });
    }`,
  ``
);

// Add it to processFile
code = code.replace(
  `    const processFile = () => {
      if (!file) return;
      setIsParsing(true);

      const fileName = file.name.toLowerCase();`,
  `    const processFile = () => {
      if (!file) return;
      setIsParsing(true);

      const fileName = file.name.toLowerCase();
      
      if (importType === "DPOTE_PDF" && fileName.endsWith(".pdf")) {
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
      }`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

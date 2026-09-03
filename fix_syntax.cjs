const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `}
        } else if (importType === "UNIDADE_ITENS") {`,
  `} else if (importType === "UNIDADE_ITENS") {`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

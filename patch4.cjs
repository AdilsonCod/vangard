const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

content = content.replace(/setParsedData\(\[\]\);/g, "setParsedData([]);\n      setDpoteReport(null);");

fs.writeFileSync('src/components/DataImporterView.tsx', content);

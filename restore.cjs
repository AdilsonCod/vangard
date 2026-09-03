const fs = require('fs');
const lines = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8').split('\n');

// Find the exact line in the first 200 lines
const origIdx = lines.findIndex((l, i) => i < 200 && l.includes('} else if (importType === "UNIDADE_ITENS") {'));

// Find the bad duplicated line after 500
const dupIdx = lines.findIndex((l, i) => i > 500 && l.includes('} else if (importType === "UNIDADE_ITENS") {'));

console.log("origIdx:", origIdx);
console.log("dupIdx:", dupIdx);

if (origIdx !== -1 && dupIdx !== -1) {
  const restoredLines = [...lines.slice(0, origIdx), ...lines.slice(dupIdx)];
  fs.writeFileSync('src/components/DataImporterView.tsx', restoredLines.join('\n'));
  console.log("Restored!");
}

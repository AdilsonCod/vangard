const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const target = "        </div>\n      {importType === 'DPOTE_PDF' && dpoteReport && (";
content = content.replace("        </div>\n      {importType === 'DPOTE_PDF' && dpoteReport && (", "        </div>\n      )}\n      {importType === 'DPOTE_PDF' && dpoteReport && (");

fs.writeFileSync('src/components/DataImporterView.tsx', content);

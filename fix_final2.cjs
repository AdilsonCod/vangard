const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

const target = /        <\/div>\s*\{importType === 'DPOTE_PDF'/;
if (target.test(content)) {
    content = content.replace(target, "        </div>\n      )}\n      {importType === 'DPOTE_PDF'");
    fs.writeFileSync('src/components/DataImporterView.tsx', content);
    console.log("Replaced!");
} else {
    console.log("Not found.");
}


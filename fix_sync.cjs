const fs = require('fs');
let content = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

// The incorrect async logic is inside processMappedData
const startIdx = content.indexOf('const processMappedData = () => {');
const nextFuncIdx = content.indexOf('const handleSave = async () => {', startIdx);

let sub = content.substring(startIdx, nextFuncIdx);

// Remove the incorrect DPOTE block from sub
const wrongBlock = sub.match(/if \(importType === 'DPOTE_PDF' && dpoteReport\) \{[\s\S]*?\} else if \(importType === 'CATALOGO'\) \{/);
if (wrongBlock) {
    sub = sub.replace(wrongBlock[0], "if (importType === 'CATALOGO') {");
    content = content.substring(0, startIdx) + sub + content.substring(nextFuncIdx);
    fs.writeFileSync('src/components/DataImporterView.tsx', content);
    console.log("Fixed!");
} else {
    console.log("Not found wrong block in sub");
}

const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

const regexToggle = /<div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">[\s\S]*?<\/div>\n\s*<\/div>/m;
code = code.replace(regexToggle, "</div>");

const regexViewStart = /\{viewModeRegra2 === 'LOTE' \? \(/m;
code = code.replace(regexViewStart, "");

const regexViewEnd = /<table className="w-full text-left border-collapse text-xs">[\s\S]*?<\/table>\n\s*<\/div>\n\s*\) : \([\s\S]*?<\/table>\n\s*<\/div>\n\s*\)} \/\* fecha viewModeRegra2 \*\//m;

// we need to keep the LOTE table, and remove the DETALHADA table.
const regexKeepLote = /<table className="w-full text-left border-collapse text-xs">[\s\S]*?<\/table>\n\s*<\/div>/m;
const matchLote = code.match(regexKeepLote);

const regexReplaceWholeView = /\{viewModeRegra2 === 'LOTE' \? \([\s\S]*?\} \/\* fecha viewModeRegra2 \*\//m;
if (matchLote) {
  code = code.replace(regexReplaceWholeView, matchLote[0]);
}

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

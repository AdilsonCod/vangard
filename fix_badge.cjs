const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

const regex = /      case 'NAO_ENCONTRADO_REDE':\n        return \(\n          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950\/40 dark:text-purple-300 border border-purple-300\/40">\n            <HelpCircle className="w-3.5 h-3.5" \/>\n            Não Encontrado na Rede\n          <\/span>\n        \);/g;

code = code.replace(regex, '');
fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/FintechReconciliation.tsx', 'utf8');

const newBadges = `
      case 'CONCILIADO_REDE':
      case 'CONCILIADO_PIX_BANCO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-300/40">
            <CheckCircle className="w-3.5 h-3.5" />
            {status === 'CONCILIADO_REDE' ? 'Conciliado Rede' : 'Baixa Banco (PIX)'}
          </span>
        );
      case 'ALERTA_GATEWAY_SEM_ENTRADA':
      case 'ALERTA_ENTRADA_SEM_GATEWAY':
      case 'NAO_ENCONTRADO_REDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status === 'NAO_ENCONTRADO_REDE' ? 'Não Encontrado Rede' : 'Falta Lançamento'}
          </span>
        );
`;

code = code.replace(
  "      case 'CONCILIADO':",
  newBadges + "      case 'CONCILIADO':"
);

fs.writeFileSync('src/components/FintechReconciliation.tsx', code);

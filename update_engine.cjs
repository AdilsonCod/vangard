const fs = require('fs');
let code = fs.readFileSync('src/utils/reconciliationEngine.ts', 'utf8');

const target = '  const allDates = new Set<string>();';

const batchLogic = `
  // --- NOVA ABORDAGEM: Conciliação Macro (Por Lotes Diários / Forma Pgto) ---
  const batchMap = new Map<string, BatchConciliationItem>();
  
  // 1. Agrupar PDV (apenas cartões)
  pdvCartao.forEach(pdv => {
    const isDebito = pdv.formaPgto.toLowerCase().includes('débito') || pdv.formaPgto.toLowerCase().includes('debito');
    const modalidade = isDebito ? 'DÉBITO' : 'CRÉDITO';
    const key = \`\${pdv.dataDia}|\${modalidade}\`;
    
    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: \`batch_\${key}\`,
        dataVenda: pdv.dataDia,
        modalidade,
        totalPdv: 0,
        totalRedeBruto: 0,
        totalRedeLiquido: 0,
        diferencaBruta: 0,
        taxaMdrMedia: 0,
        status: 'PENDENTE_LIQUIDACAO', // Default
      });
    }
    const b = batchMap.get(key)!;
    b.totalPdv += pdv.valor;
  });

  // 2. Agrupar Rede
  redePagamentos.forEach(rp => {
    // Normalizar modalidade para bater com a chave
    const mod = rp.modalidade.includes('DÉBITO') ? 'DÉBITO' : 'CRÉDITO';
    const key = \`\${rp.dataVenda}|\${mod}\`;
    
    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: \`batch_\${key}\`,
        dataVenda: rp.dataVenda,
        modalidade: mod,
        totalPdv: 0,
        totalRedeBruto: 0,
        totalRedeLiquido: 0,
        diferencaBruta: 0,
        taxaMdrMedia: 0,
        status: 'PENDENTE_LIQUIDACAO', // Default
      });
    }
    const b = batchMap.get(key)!;
    b.totalRedeBruto += rp.valorBruto;
    b.totalRedeLiquido += rp.valorLiquido;
  });

  // 3. Calcular Diferenças e Status
  const batches = Array.from(batchMap.values()).map(b => {
    b.diferencaBruta = Math.abs(b.totalPdv - b.totalRedeBruto);
    const mdrTotal = b.totalRedeBruto - b.totalRedeLiquido;
    b.taxaMdrMedia = b.totalRedeBruto > 0 ? (mdrTotal / b.totalRedeBruto) * 100 : 0;
    
    // Status (Tolerância de 1.00 BRL para o lote todo)
    if (b.diferencaBruta <= 1.00 && b.totalRedeBruto > 0) {
      b.status = 'CONCILIADO';
    } else if (b.diferencaBruta > 1.00 && b.totalRedeBruto > 0) {
      b.status = 'DIVERGENTE';
    } else if (b.totalPdv > 0 && b.totalRedeBruto === 0) {
      b.status = 'NAO_ENCONTRADO_REDE';
    }
    return b;
  });

`;

code = code.replace(target, batchLogic + '\n' + target);
fs.writeFileSync('src/utils/reconciliationEngine.ts', code);

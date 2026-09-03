const fs = require('fs');
let code = fs.readFileSync('src/utils/reconciliationEngine.ts', 'utf8');

const injectionPoint = '  // REGRA 1: Gateway vs. Previsão de Recebíveis (Matching por Código/Transação e Valor)';

const newLogic = `
  // --- PASSO 1 & 2: Roteamento de Entradas Manuais (Assinaturas Balcão) ---
  const redeAssinaturaIds = new Set<string>();
  const entradasConciliadasIds = new Set<string>();

  // Helper de RegEx para extrair chaves
  const extractCode = (desc: string) => {
    const match = desc.match(/(?:NSU|AUT|PIX|ID|REF)[\\s:=-]*([A-Za-z0-9]+)/i);
    return match ? match[1].toUpperCase() : desc.trim().toUpperCase();
  };

  entradasManuais.forEach(entrada => {
    const isRede = entrada.tag === 'ASSINATURA_BALCAO_REDE';
    const isPix = entrada.tag === 'ASSINATURA_BALCAO_PIX';
    const chave = extractCode(entrada.descricao);

    if (isRede) {
      // Procura na aba de pagamentos da Rede (NSU ou NumAutorizacao)
      const match = redePagamentos.find(rp => 
        (rp.nsuCv?.toUpperCase() === chave || rp.numAutorizacao?.toUpperCase() === chave) &&
        !redeAssinaturaIds.has(rp.id)
      );

      if (match) {
        redeAssinaturaIds.add(match.id);
        entradasConciliadasIds.add(entrada.id);
        
        items.push({
          id: \`recon_balcao_rede_\${entrada.id}\`,
          regra: 'REGRA_3_ASSINATURA_BALCAO_REDE',
          dataVenda: entrada.data,
          identificador: chave,
          clienteOuDesc: entrada.cliente,
          modalidadeOuPlano: 'Assinatura Balcão (Rede)',
          valorBruto: entrada.valor,
          valorMdrRetido: match.valorMdr,
          valorLiquido: match.valorLiquido,
          mdrTaxaEfetiva: match.taxaMdrPerc,
          diferencaTaxa: 0,
          status: 'CONCILIADO_REDE',
          statusDescricao: \`Conciliado com Rede (NSU/AUT: \${chave})\`,
          dataLiquidacaoPrevista: match.dataRecebimento
        });
      } else {
        items.push({
          id: \`recon_balcao_rede_\${entrada.id}\`,
          regra: 'REGRA_3_ASSINATURA_BALCAO_REDE',
          dataVenda: entrada.data,
          identificador: chave,
          clienteOuDesc: entrada.cliente,
          modalidadeOuPlano: 'Assinatura Balcão (Rede)',
          valorBruto: entrada.valor,
          valorMdrRetido: 0,
          valorLiquido: entrada.valor,
          mdrTaxaEfetiva: 0,
          diferencaTaxa: 0,
          status: 'NAO_ENCONTRADO_REDE',
          statusDescricao: \`Entrada Manual sem match na adquirente. (Busca: \${chave})\`
        });
      }
    } else if (isPix) {
      // Assinatura PIX não bate na Rede, vai direto pro caixa/extrato bancário (simulado aqui como conciliado_pix)
      entradasConciliadasIds.add(entrada.id);
      items.push({
        id: \`recon_balcao_pix_\${entrada.id}\`,
        regra: 'REGRA_3_ASSINATURA_BALCAO_PIX',
        dataVenda: entrada.data,
        identificador: chave,
        clienteOuDesc: entrada.cliente,
        modalidadeOuPlano: 'Assinatura Balcão (PIX)',
        valorBruto: entrada.valor,
        valorMdrRetido: 0,
        valorLiquido: entrada.valor,
        mdrTaxaEfetiva: 0,
        diferencaTaxa: 0,
        status: 'CONCILIADO_PIX_BANCO',
        statusDescricao: \`Baixa PIX Direta (Comprovante: \${chave})\`
      });
    }
  });

  // --- PASSO 2: Validação Cruzada Gateway (Paga fora do sistema) ---
  clubeData.forEach(fatura => {
    if (fatura.status.toLowerCase().includes('paga fora do sistema')) {
      const match = entradasManuais.find(e => 
        e.cliente.toLowerCase().includes(fatura.nomeCliente.toLowerCase()) && 
        e.valor === fatura.valor
      );
      
      if (!match) {
        items.push({
          id: \`recon_gateway_ext_\${fatura.id}\`,
          regra: 'REGRA_4_GATEWAY_EXTERNO',
          dataVenda: fatura.vencimento,
          identificador: fatura.codigo,
          clienteOuDesc: fatura.nomeCliente,
          modalidadeOuPlano: fatura.plano,
          valorBruto: fatura.valor,
          valorMdrRetido: 0,
          valorLiquido: fatura.valor,
          mdrTaxaEfetiva: 0,
          diferencaTaxa: 0,
          status: 'ALERTA_GATEWAY_SEM_ENTRADA',
          statusDescricao: 'Fatura baixada por fora no Gateway sem Entrada Manual correspondente.'
        });
      }
    }
  });
`;

code = code.replace(injectionPoint, newLogic + '\n' + injectionPoint);

// Remove Rede matched from REGRA 2:
// Search for: redePagamentos.forEach(rp => {
// Or where Rede logic is applied for Batch:
const batchRedeFind = '  // 2. Agrupar Rede\n  redePagamentos.forEach(rp => {';
code = code.replace(
  batchRedeFind,
  '  // 2. Agrupar Rede\n  redePagamentos.forEach(rp => {\n    if (redeAssinaturaIds.has(rp.id)) return; // Exclui vendas balcao'
);

const rede1To1Find = '    // Procura pagamento correspondente na Rede por data, valor, e modalidade\n    let match = redePagamentos.find(rp => {\n      if (matchedRedePagIds.has(rp.id)) return false;';
code = code.replace(
  rede1To1Find,
  '    // Procura pagamento correspondente na Rede por data, valor, e modalidade\n    let match = redePagamentos.find(rp => {\n      if (matchedRedePagIds.has(rp.id) || redeAssinaturaIds.has(rp.id)) return false;'
);

fs.writeFileSync('src/utils/reconciliationEngine.ts', code);

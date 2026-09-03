const fs = require('fs');
let code = fs.readFileSync('src/utils/reconciliationEngine.ts', 'utf8');

const target = '  return {\n    pdv,\n    clube,\n    redePagamentos,\n    redeRecebidos,\n    previsao\n  };';

const demoData = `
  const entradasManuais = [
    {
      id: 'em-101',
      data: '2026-09-02',
      valor: 89.90,
      cliente: 'Carlos Eduardo',
      tag: 'ASSINATURA_BALCAO_REDE',
      descricao: 'Venda de Plano no balcão NSU: 887766'
    },
    {
      id: 'em-102',
      data: '2026-09-02',
      valor: 110.00,
      cliente: 'Rafael Lima',
      tag: 'ASSINATURA_BALCAO_PIX',
      descricao: 'Pagou o clube direto no PIX REF-ABC123XYZ'
    },
    {
      id: 'em-103',
      data: '2026-09-03',
      valor: 89.90,
      cliente: 'Fernando Souza',
      tag: 'ASSINATURA_BALCAO_REDE',
      descricao: 'Plano mensal NSU: 999000 (Sem match na Rede)'
    }
  ];

  // Injetando uma transação extra na Rede para casar com a em-101
  redePagamentos.push({
    id: 'rp-extra-1',
    dataVenda: '2026-09-02',
    nsuCv: '887766',
    numAutorizacao: 'AUT123',
    resumo: 'Venda Débito',
    modalidade: 'DÉBITO À VISTA',
    valorBruto: 89.90,
    valorLiquido: 88.11,
    valorMdr: 1.79,
    taxaMdrPerc: 1.99,
    dataRecebimento: '2026-09-03',
    plano: 'À VISTA'
  });

  // Injetando faturas do Gateway 'Paga fora do sistema'
  clube.push(
    {
      id: 'gc-extra-1',
      codigo: 'FAT-OUT-01',
      nomeCliente: 'Carlos Eduardo',
      plano: 'Plano Basic',
      vencimento: '2026-09-02',
      valor: 89.90,
      taxa: 0,
      valorLiquido: 89.90,
      status: 'Paga fora do sistema' // Bate com em-101
    },
    {
      id: 'gc-extra-2',
      codigo: 'FAT-OUT-02',
      nomeCliente: 'Bruno Oliveira',
      plano: 'Plano Pro',
      vencimento: '2026-09-02',
      valor: 150.00,
      taxa: 0,
      valorLiquido: 150.00,
      status: 'Paga fora do sistema' // Sem entrada manual, gera alerta
    }
  );

  return {
    pdv,
    clube,
    redePagamentos,
    redeRecebidos,
    previsao,
    entradasManuais
  };
`;

code = code.replace(target, demoData);
fs.writeFileSync('src/utils/reconciliationEngine.ts', code);

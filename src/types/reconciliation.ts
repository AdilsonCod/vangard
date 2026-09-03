export interface PDVMovimentacao {
  id: string;
  cliente: string;
  telefone: string;
  formaPgto: 'Cartão de crédito' | 'Cartão de débito' | 'Pix' | 'Dinheiro' | 'Assinatura' | string;
  valor: number;
  data: string; // YYYY-MM-DD HH:MM
  dataDia: string; // YYYY-MM-DD
  isAssinaturaClube: boolean; // valor === 0
}

export interface GatewayClubeTransacao {
  id: string;
  codigo: string;
  nomeCliente: string;
  plano: string;
  vencimento: string;
  valor: number;
  status: string; // PAGO, PENDENTE, RECUSADO, CANCELADO, etc.
  dataStatusAtual: string;
  codigoAprovacao: string;
  tid: string;
  descricaoStatus: string;
}

export interface AdquirenteRedePagamento {
  id: string;
  dataRecebimento: string;
  dataVenda: string;
  valorBruto: number;
  taxaMdrPerc: number;
  valorMdr: number;
  valorLiquido: number;
  tid: string;
  nsuCv: string;
  numAutorizacao: string;
  modalidade: 'CREDITO' | 'DEBITO' | 'PIX' | string;
  modalidadeOriginal?: string; // Nome original capturado da coluna 'Modalidade' do relatório da adquirente
  bandeira: string;
  status: string;
}

export interface AdquirenteRedeRecebido {
  id: string;
  dataDeposito: string;
  valorTotalLote: number;
  banco: string;
  agenciaConta: string;
  status: string;
}

export interface PrevisaoRecebivel {
  id: string;
  aReceber: string;
  dataVenda: string;
  parcela: string;
  transacao: string; // Cruza com "Código" do Clube
  tid: string;
  operacao: string;
  bandeira: string;
  valorBruto: number;
  mdrTaxaPerc: number;
  mdrValor: number;
  antecipacao: number;
  valorLiquido: number;
  statusTransacao: string;
  dMais31: string; // Data projetada de liquidação
}

export type StatusDivergencia = 
  | 'CONCILIADO'
  | 'NAO_AUTORIZADO'
  | 'PENDENTE_LIQUIDACAO'
  | 'DIVERGENCIA_TAXA'
  | 'NAO_ENCONTRADO_REDE'
  | 'CONCILIADO_REDE'
  | 'CONCILIADO_PIX_BANCO'
  | 'ALERTA_GATEWAY_SEM_ENTRADA'
  | 'ALERTA_ENTRADA_SEM_GATEWAY'
  | 'RECEBIDO_FORA_DO_GATEWAY';

export interface ConciliationItem {
  id: string;
  regra: 'REGRA_1_CLUBE_PREVISAO' | 'REGRA_2_PDV_REDE'
  | 'REGRA_3_ASSINATURA_BALCAO_REDE'
  | 'REGRA_3_ASSINATURA_BALCAO_PIX'
  | 'REGRA_4_GATEWAY_EXTERNO';
  dataVenda: string;
  identificador: string; // TID ou Código/Transação
  clienteOuDesc: string;
  modalidadeOuPlano: string;
  bandeira?: string;
  valorBruto: number;
  valorMdrRetido: number;
  valorLiquido: number;
  mdrTaxaEfetiva: number;
  mdrTaxaContratual?: number;
  diferencaTaxa: number;
  status: StatusDivergencia;
  statusDescricao: string;
  statusPrevisao?: string;
  dataLiquidacaoPrevista?: string;
  dataLiquidacaoEfetiva?: string;
  loteDeposito?: string;
}

export interface DailyClosing {
  data: string;
  pdvTotalBruto: number;
  pdvDinheiro: number;
  pdvPix: number;
  pdvCartaoCredito: number;
  pdvCartaoDebito: number;
  pdvAssinaturasCount: number;
  redeTotalBruto: number;
  redeTotalLiquido: number;
  redeTaxasMdr: number;
  redeDepositosConfirmados: number;
  divergenciasCount: number;
  status: 'CONCILIADO' | 'PENDENTE_LIQUIDACAO' | 'DIVERGENTE';
}

export interface ReconciliationKPIs {
  saldoRealEmConta: number;
  totalFaturadoPDV: number;
  totalAprovadoAdquirente: number;
  previsaoEntradasD30: number;
  totalDivergenciasValor: number;
  totalDivergenciasCount: number;
  totalTaxasMdrRetidas: number;
}
export interface BatchConciliationItem {
  id: string;
  dataVenda: string;
  modalidade: 'Crédito' | 'Débito' | 'PIX' | 'Dinheiro' | 'Assinatura' | 'Cortesia' | 'Vale Presente' | 'Crédito Anterior' | 'Outros' | string;
  qtdPdv: number;
  totalPdv: number;
  qtdRede: number;
  totalRedeBruto: number;
  totalTaxaMdr: number;
  totalRedeLiquido: number;
  diferencaBruta: number;
  taxaMdrMedia: number;
  status: 'CONCILIADO' | 'DIVERGENTE' | 'PIX_CONTA_BANCARIA' | 'CAIXA_FISICO' | 'ASSINATURA_CLUBE' | 'SALDO_NAO_INTERMEDIADO' | StatusDivergencia;
  diagnostico?: string;
  tipoSaldo?: 'INTERMEDIADO_REDE' | 'PIX_DIRETO' | 'CAIXA_GAVETA' | 'ASSINATURA_ONLINE' | 'CORTESIA_OUTROS';
}

export interface SaldoNaoAdquirenteItem {
  data: string;
  formaPgto: string;
  categoria: 'PIX_DIRETO' | 'DINHEIRO_GAVETA' | 'ASSINATURA_CLUBE' | 'CARTAO_NAO_CAPTURADO' | 'CORTESIA_OUTROS';
  valor: number;
  qtd: number;
  descricao: string;
}

export interface ResumoLotesCartao {
  totalBrutoPdvCartao: number;
  qtdVendasPdvCartao: number;
  totalBrutoRedeCartao: number;
  qtdVendasRedeCartao: number;
  totalTaxaMdrCartao: number;
  taxaMdrMediaPerc: number;
  totalLiquidoRedeCartao: number;
  diferencaBrutaGlobal: number;
  qtdLotesTotal: number;
  qtdLotesConciliados: number;
  qtdLotesDivergentes: number;
  totalSaldosNaoAdquirente: number;
  totalPixContaBancaria: number;
  totalDinheiroCaixa: number;
  totalCartaoFaltaRede: number;
  totalCartaoSobraRede: number;
  diasDivergentes: Array<{
    data: string;
    modalidade: string;
    diferenca: number;
    totalPdv: number;
    totalRede: number;
    motivo: string;
  }>;
  saldosNaoAdquirente: SaldoNaoAdquirenteItem[];
}

export interface EntradaManual {
  id: string;
  data: string;
  valor: number;
  cliente: string;
  tag: 'ASSINATURA_BALCAO_REDE' | 'ASSINATURA_BALCAO_PIX' | string;
  descricao: string;
}

export interface FormaPagamentoComparison {
  id: string;
  formaPgtoNome: string;
  categoria: 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'DINHEIRO' | 'ASSINATURA' | 'CORTESIA' | 'VALE_PRESENTE' | 'CREDITO_ANTERIOR' | 'OUTROS';
  totalPdv: number;
  qtdPdv: number;
  totalAdquirenteBruto: number;
  qtdAdquirente: number;
  diferencaBruta: number;
  totalMdrRetido: number;
  taxaMdrMedia: number;
  totalAdquirenteLiquido: number;
  status: 'CONCILIADO' | 'DIVERGENTE' | 'CAIXA_FISICO' | 'PIX_CONTA_BANCARIA' | 'NAO_ENCONTRADO_ADQUIRENTE' | 'NAO_ENCONTRADO_PDV' | 'CORTESIA_BALCAO' | 'SALDO_NAO_INTERMEDIADO';
  descricaoStatus: string;
}

export interface TotaisComparativoFormasPgto {
  totaisPorForma: FormaPagamentoComparison[];
  subtotalCartoes: {
    totalPdv: number;
    qtdPdv: number;
    totalAdquirenteBruto: number;
    qtdAdquirente: number;
    diferencaBruta: number;
    totalMdrRetido: number;
    taxaMdrMedia: number;
    totalAdquirenteLiquido: number;
    status: 'CONCILIADO' | 'DIVERGENTE';
  };
  totalLotesAdquirente: {
    totalPdv: number;
    qtdPdv: number;
    totalAdquirenteBruto: number;
    qtdAdquirente: number;
    totalCreditoRede: number;
    totalDebitoRede: number;
    totalPixRede: number;
    diferencaBruta: number;
    totalMdrRetido: number;
    taxaMdrMedia: number;
    totalAdquirenteLiquido: number;
    status: 'CONCILIADO' | 'DIVERGENTE';
  };
  totalGeral: {
    totalPdv: number;
    qtdPdv: number;
    totalAdquirenteBruto: number;
    qtdAdquirente: number;
    totalCreditoRede: number;
    totalDebitoRede: number;
    totalPixRede: number;
    diferencaBruta: number;
    totalMdrRetido: number;
    totalAdquirenteLiquido: number;
  };
  saldosNaoAdquirenteTotal: {
    totalPixContaBancaria: number;
    qtdPixContaBancaria: number;
    totalDinheiroGaveta: number;
    qtdDinheiroGaveta: number;
    totalAssinaturasClube: number;
    qtdAssinaturasClube: number;
    totalCortesiasVales: number;
    qtdCortesiasVales: number;
    totalGeralNaoAdquirente: number;
  };
}


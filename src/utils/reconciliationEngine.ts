import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  PDVMovimentacao, 
  GatewayClubeTransacao, 
  AdquirenteRedePagamento, 
  AdquirenteRedeRecebido, 
  PrevisaoRecebivel, 
  ConciliationItem, 
  DailyClosing, 
  ReconciliationKPIs,
  BatchConciliationItem,
  FormaPagamentoComparison,
  TotaisComparativoFormasPgto,
  ResumoLotesCartao,
  SaldoNaoAdquirenteItem,
  EntradaManual
} from '../types/reconciliation';

// Helpers para limpeza de dados FinTech
export function cleanCurrency(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }
  if (!val) return 0;
  let str = String(val).trim();
  // Remove non-breaking space (\u00A0) and all whitespace characters
  str = str.replace(/[\u00A0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\s]/g, '');
  const isNegative = str.includes('-') || (str.startsWith('(') && str.endsWith(')'));
  str = str.replace(/[R$\s().+-]/g, '');
  if (str.includes(',') && str.includes('.')) {
    // 1.250,50 -> 1250.50
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // 70,00 -> 70.00
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  if (isNaN(parsed)) return 0;
  return Number((isNegative ? -parsed : parsed).toFixed(2));
}

export function cleanTaxRate(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[%\s]/g, '').replace(',', '.').trim();
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseDateString(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date to YYYY-MM-DD
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
  }
  const str = String(val).trim();
  // Formatos DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY HH:MM ou DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Formato YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().split('T')[0];
  }
  return '';
}

// Normalizador de chaves de objeto (case-insensitive e sem acentos)
function normalizeKey(key: string): string {
  if (!key) return '';
  return String(key)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\uFEFF\xA0]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getProp(row: Record<string, any>, ...candidates: string[]): any {
  if (!row) return undefined;
  const keys = Object.keys(row);
  
  // 1. Busca exata (normalizada sem acentos e case-insensitive)
  for (const cand of candidates) {
    const normCand = normalizeKey(cand);
    const foundKey = keys.find(k => normalizeKey(k) === normCand);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return row[foundKey];
    }
  }

  // 2. Busca por contenção (ex: coluna 'Modalidade' ou 'Modalidade de Pagamento')
  for (const cand of candidates) {
    const normCand = normalizeKey(cand);
    const foundKey = keys.find(k => normalizeKey(k).includes(normCand));
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return row[foundKey];
    }
  }

  return undefined;
}

// Padronizador de Forma de Pagamento do PDV
export function normalizeFormaPgto(raw: string): {
  nome: string;
  modalidadeLote: 'Crédito' | 'Débito' | 'PIX' | 'Dinheiro' | 'Assinatura' | 'Cortesia' | 'Vale Presente' | 'Crédito Anterior' | 'Outros';
  categoria: 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'DINHEIRO' | 'ASSINATURA' | 'CORTESIA' | 'VALE_PRESENTE' | 'CREDITO_ANTERIOR' | 'OUTROS';
} {
  const norm = normalizeKey(raw || '');
  if (norm.includes('debito') || norm.includes('deb')) {
    return { nome: 'Cartão de débito', modalidadeLote: 'Débito', categoria: 'CARTAO_DEBITO' };
  }
  if (norm.includes('credito') || norm.includes('cred') || norm.includes('cartao')) {
    return { nome: 'Cartão de crédito', modalidadeLote: 'Crédito', categoria: 'CARTAO_CREDITO' };
  }
  if (norm.includes('pix')) {
    return { nome: 'Pix', modalidadeLote: 'PIX', categoria: 'PIX' };
  }
  if (norm.includes('dinheiro') || norm.includes('especie')) {
    return { nome: 'Dinheiro', modalidadeLote: 'Dinheiro', categoria: 'DINHEIRO' };
  }
  if (norm.includes('assinatura') || norm.includes('clube')) {
    return { nome: 'Assinatura', modalidadeLote: 'Assinatura', categoria: 'ASSINATURA' };
  }
  if (norm.includes('cortesia')) {
    const trimmed = String(raw || '').trim();
    return { nome: trimmed || 'Cortesia', modalidadeLote: 'Cortesia', categoria: 'CORTESIA' };
  }
  if (norm.includes('valepresente') || norm.includes('voucher')) {
    return { nome: 'Vale presente', modalidadeLote: 'Vale Presente', categoria: 'VALE_PRESENTE' };
  }
  if (norm.includes('creditoanterior') || norm.includes('saldo')) {
    return { nome: 'Credito Anterior', modalidadeLote: 'Crédito Anterior', categoria: 'CREDITO_ANTERIOR' };
  }
  const clean = String(raw || '').trim() || 'Outros';
  return { nome: clean, modalidadeLote: 'Outros', categoria: 'OUTROS' };
}

// Ingestão 1: PDV / Caixa Operacional (Relatório20_Movimentacoes.csv ou .xlsx)
export async function parsePDVFile(file: File): Promise<PDVMovimentacao[]> {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(30, rawMatrix.length); i++) {
      const rowStr = (rawMatrix[i] || []).map(c => normalizeKey(String(c || ''))).join(' ');
      if (rowStr.includes('cliente') || rowStr.includes('formapgto') || rowStr.includes('valor')) {
        headerRowIdx = i;
        break;
      }
    }

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx });
    return rows.map((row, idx) => {
      const cliente = String(getProp(row, 'cliente', 'nome do cliente', 'consumidor') || 'Cliente Balcão').trim();
      const telefone = String(getProp(row, 'telefone', 'celular', 'contato') || '').trim();
      const rawForma = String(getProp(row, 'forma de pgto', 'forma pgto', 'forma de pagamento', 'tipo pgto', 'forma pagamento', 'pagamento', 'tipo') || 'Dinheiro').trim();
      const rawValor = getProp(row, 'valor', 'total', 'valor total');
      const rawData = getProp(row, 'data', 'data/hora', 'data movimentacao', 'data hora');
      
      const valor = cleanCurrency(rawValor);
      const dataDia = parseDateString(rawData) || new Date().toISOString().split('T')[0];
      const normForma = normalizeFormaPgto(rawForma);
      const isAssinatura = normForma.categoria === 'ASSINATURA' || (valor === 0 && normForma.categoria !== 'CORTESIA');

      return {
        id: `pdv_${idx + 1}_${Date.now()}`,
        cliente,
        telefone,
        formaPgto: normForma.nome,
        valor,
        data: String(rawData || dataDia),
        dataDia,
        isAssinaturaClube: isAssinatura
      };
    });
  }

  // Se for CSV ou TXT
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as Record<string, any>[]).map((row, idx) => {
          const cliente = String(getProp(row, 'cliente', 'nome do cliente', 'consumidor') || 'Cliente Balcão').trim();
          const telefone = String(getProp(row, 'telefone', 'celular', 'contato') || '').trim();
          const rawForma = String(getProp(row, 'forma de pgto', 'forma pgto', 'forma de pagamento', 'tipo pgto', 'forma pagamento', 'pagamento', 'tipo') || 'Dinheiro').trim();
          const rawValor = getProp(row, 'valor', 'total', 'valor total');
          const rawData = getProp(row, 'data', 'data/hora', 'data movimentacao', 'data hora');
          
          const valor = cleanCurrency(rawValor);
          const dataDia = parseDateString(rawData) || new Date().toISOString().split('T')[0];
          const normForma = normalizeFormaPgto(rawForma);
          const isAssinatura = normForma.categoria === 'ASSINATURA' || (valor === 0 && normForma.categoria !== 'CORTESIA');

          return {
            id: `pdv_${idx + 1}_${Date.now()}`,
            cliente,
            telefone,
            formaPgto: normForma.nome,
            valor,
            data: String(rawData || dataDia),
            dataDia,
            isAssinaturaClube: isAssinatura
          };
        });
        resolve(rows);
      },
      error: (err) => reject(err)
    });
  });
}

// Ingestão 2: Gateway de Assinaturas do Clube (71975-relatorio-transacoes...csv)
export async function parseGatewayClubeFile(file: File): Promise<GatewayClubeTransacao[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as Record<string, any>[]).map((row, idx) => {
          const codigo = String(getProp(row, 'codigo', 'código', 'id transacao', 'transacao') || '').trim();
          const nomeCliente = String(getProp(row, 'nome do cliente', 'cliente', 'nome') || '').trim();
          const plano = String(getProp(row, 'plano', 'nome do plano', 'assinatura') || 'Vans Club').trim();
          const vencimento = parseDateString(getProp(row, 'vencimento', 'data vencimento'));
          const valor = cleanCurrency(getProp(row, 'valor', 'mensalidade'));
          const status = String(getProp(row, 'status', 'status atual', 'situacao') || 'PENDENTE').trim().toUpperCase();
          const dataStatusAtual = parseDateString(getProp(row, 'data do status atual', 'data status', 'data'));
          const codigoAprovacao = String(getProp(row, 'codigo de aprovacao', 'código de aprovação', 'autorizacao') || '').trim();
          const tid = String(getProp(row, 'tid', 'id tid', 'nsu') || '').trim();
          const descricaoStatus = String(getProp(row, 'descricao do status atual', 'descrição do status atual', 'motivo') || '').trim();

          return {
            id: `clube_${idx + 1}_${codigo || Date.now()}`,
            codigo,
            nomeCliente,
            plano,
            vencimento,
            valor,
            status,
            dataStatusAtual,
            codigoAprovacao,
            tid,
            descricaoStatus
          };
        });
        resolve(rows);
      },
      error: (err) => reject(err)
    });
  });
}

// Ingestão 3: Extrato Adquirente Rede (Suporta XLSX e CSV com detecção inteligente de abas)
export interface RedeParseResult {
  pagamentos: AdquirenteRedePagamento[];
  recebidos: AdquirenteRedeRecebido[];
  resumoInfo?: {
    periodo?: string;
    dataEmissao?: string;
    liquidoRecebido?: number;
    cobrancas?: number;
    aReceber?: number;
    estabelecimento?: string;
    isOnlyResumo?: boolean;
    nomeAbaProcessada?: string;
  };
}

type RedeResumoInfo = NonNullable<RedeParseResult['resumoInfo']>;

interface RedeHeaderCandidate {
  sheetName: string;
  headerRowIdx: number;
  score: number;
}

const REDE_HEADER_ALIASES = {
  date: [
    'data', 'data venda', 'data da venda', 'data recebimento', 'data do recebimento',
    'data pagamento', 'data do pagamento', 'data credito', 'data liquidacao',
    'data prevista', 'previsao pagamento', 'previsao recebimento', 'dt venda',
    'dt pagamento', 'dt credito'
  ],
  value: [
    'valor', 'valor bruto', 'valor liquido', 'valor da venda', 'valor da parcela',
    'valor pago', 'valor creditado', 'valor a receber', 'bruto', 'liquido',
    'vlr bruto', 'vlr liquido', 'montante'
  ],
  identifier: [
    'nsu', 'tid', 'autorizacao', 'codigo autorizacao', 'numero autorizacao',
    'numero do rv', 'numero rv', 'rv', 'comprovante', 'documento'
  ],
  modality: [
    'modalidade', 'tipo venda', 'tipo de venda', 'tipo transacao',
    'forma pagamento', 'produto', 'operacao', 'bandeira'
  ],
  fee: ['mdr', 'taxa', 'taxa administrativa', 'desconto', 'comissao'],
  status: ['status', 'situacao']
};

function headerCellMatches(cell: string, aliases: string[]): boolean {
  return aliases.some(alias => {
    const normalizedAlias = normalizeKey(alias);
    return cell === normalizedAlias || cell.includes(normalizedAlias);
  });
}

/**
 * Identifica uma linha de cabeçalho pela estrutura de colunas, e não apenas por
 * palavras soltas. Isso evita classificar textos da capa, como
 * "Pagamentos: são os valores...", como se fossem uma tabela.
 */
function scoreRedeHeaderRow(row: any[]): number | null {
  const cells = (row || [])
    .map(value => String(value ?? '').trim())
    .filter(Boolean);

  if (cells.length < 3) return null;

  // Cabeçalhos reais são curtos e distribuídos em várias colunas. Parágrafos
  // explicativos da capa normalmente ocupam uma única célula muito longa.
  const normalizedCells = cells
    .filter(cell => cell.length <= 100)
    .map(normalizeKey)
    .filter(Boolean);
  if (normalizedCells.length < 3) return null;

  const matches = {
    date: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.date)),
    value: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.value)),
    identifier: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.identifier)),
    modality: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.modality)),
    fee: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.fee)),
    status: normalizedCells.some(cell => headerCellMatches(cell, REDE_HEADER_ALIASES.status))
  };

  const structuralGroups = [matches.date, matches.identifier, matches.modality].filter(Boolean).length;
  if (!matches.value || structuralGroups === 0) return null;

  return (
    (matches.date ? 35 : 0) +
    (matches.value ? 35 : 0) +
    (matches.identifier ? 20 : 0) +
    (matches.modality ? 20 : 0) +
    (matches.fee ? 8 : 0) +
    (matches.status ? 5 : 0) +
    Math.min(normalizedCells.length, 20)
  );
}

function findResumoAmount(matrix: any[][], labelAliases: string[]): number | undefined {
  for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
    const row = matrix[rowIdx] || [];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const label = normalizeKey(String(row[colIdx] ?? ''));
      if (!labelAliases.some(alias => label.includes(normalizeKey(alias)))) continue;

      const nearbyValues: any[] = [];
      for (let rowOffset = 0; rowOffset <= 3; rowOffset++) {
        const nearbyRow = matrix[rowIdx + rowOffset] || [];
        for (let colOffset = -1; colOffset <= 3; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          nearbyValues.push(nearbyRow[colIdx + colOffset]);
        }
      }

      const amountValue = nearbyValues.find(value => {
        if (typeof value === 'number') return true;
        const text = String(value ?? '').trim();
        return /\d/.test(text) && (/R\$/i.test(text) || /^-?[\d.,]+$/.test(text));
      });

      if (amountValue !== undefined) return cleanCurrency(amountValue);
    }
  }
  return undefined;
}

function extractRedeResumo(matrix: any[][], sheetName: string): RedeResumoInfo | undefined {
  const textDump = matrix.map(row => (row || []).map(value => String(value ?? '')).join(' ')).join('\n');
  const periodoMatch = textDump.match(/PER[ÍI]ODO:\s*([0-9/]+)\s*(?:A|AT[ÉE]|-)\s*([0-9/]+)/i);
  const emissaoMatch = textDump.match(/DATA\s+DE\s+EMISS[ÃA]O:\s*([0-9/]+(?:\s+[0-9:]+)?)/i);
  const estabelecimentoMatch = textDump.match(/Estabelecimentos?\s+selecionados?:\s*([^\r\n]+)/i);
  const liquidoRecebido = findResumoAmount(matrix, ['liquido recebido no periodo']);
  const cobrancas = findResumoAmount(matrix, ['cobrancas no periodo']);
  const aReceber = findResumoAmount(matrix, ['a receber no periodo']);

  if (!periodoMatch && !emissaoMatch && liquidoRecebido === undefined && cobrancas === undefined && aReceber === undefined) {
    return undefined;
  }

  return {
    periodo: periodoMatch ? `${periodoMatch[1]} a ${periodoMatch[2]}` : undefined,
    dataEmissao: emissaoMatch?.[1]?.trim(),
    liquidoRecebido,
    cobrancas,
    aReceber,
    estabelecimento: estabelecimentoMatch?.[1]?.trim(),
    isOnlyResumo: true,
    nomeAbaProcessada: sheetName
  };
}

export async function parseRedeFile(file: File): Promise<RedeParseResult> {
  const pagamentos: AdquirenteRedePagamento[] = [];
  const recebidos: AdquirenteRedeRecebido[] = [];
  let resumoInfo: RedeResumoInfo | undefined;
  let pagamentosRows: any[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const isTextFile = /\.(csv|txt)$/i.test(file.name);
    let workbook: XLSX.WorkBook;

    if (isTextFile) {
      // SheetJS pode interpretar bytes UTF-8 de CSV como Windows-1252 (ex.:
      // "PERÍODO" vira "PERÃODO"). Decodificar explicitamente preserva
      // acentos, NBSP e os nomes de colunas usados pelo detector.
      const bytes = new Uint8Array(arrayBuffer);
      let decodedText = new TextDecoder('utf-8').decode(bytes);
      if (decodedText.includes('\uFFFD')) {
        decodedText = new TextDecoder('windows-1252').decode(bytes);
      }
      workbook = XLSX.read(decodedText, { type: 'string', cellDates: true });
    } else {
      workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    }
    let bestCandidate: RedeHeaderCandidate | null = null;

    // Vasculha TODAS as abas e todas as primeiras linhas para achar a tabela de transações
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rawMatrix.length === 0) continue;

      // 1. Extração oportunista de Resumo/Capa
      const normSheet = normalizeKey(sheetName);
      if (normSheet.includes('resumo') || normSheet.includes('capa') || normSheet.includes('inicio') || workbook.SheetNames.length === 1) {
        resumoInfo ||= extractRedeResumo(rawMatrix, sheetName);
      }

      // 2. Procura um cabeçalho tabular. O nome da aba ajuda na escolha, mas
      // nunca substitui a presença real de colunas de data + valor.
      let sheetScoreBoost = 0;
      if (normSheet === 'pagamentos') sheetScoreBoost += 120;
      else if (normSheet.includes('pagamento') || normSheet.includes('pagto')) sheetScoreBoost += 90;
      else if (normSheet.includes('venda')) sheetScoreBoost += 35;
      if (normSheet.includes('resumo') || normSheet.includes('capa') || normSheet.includes('inicio')) sheetScoreBoost -= 80;
      if (normSheet.includes('futuro') || normSheet.includes('ajuste') || normSheet.includes('cancelamento')) sheetScoreBoost -= 30;

      for (let i = 0; i < Math.min(500, rawMatrix.length); i++) {
        const row = rawMatrix[i] || [];
        const headerScore = scoreRedeHeaderRow(row);
        if (headerScore !== null) {
          // A posição só desempata. O código anterior somava o tamanho da aba,
          // fazendo capas longas vencerem a aba Pagamentos.
          const totalScore = headerScore + sheetScoreBoost - (i * 0.01);
          if (!bestCandidate || totalScore > bestCandidate.score) {
            bestCandidate = { sheetName, headerRowIdx: i, score: totalScore };
          }
        }
      }
    }

    if (bestCandidate) {
      const sheet = workbook.Sheets[bestCandidate.sheetName];
      pagamentosRows = XLSX.utils.sheet_to_json(sheet, {
        range: bestCandidate.headerRowIdx,
        defval: '',
        blankrows: false,
        raw: true
      });
      console.log('--- DBG REDE ---');
      console.log(`Melhor aba: ${bestCandidate.sheetName}, Linha de cabeçalho: ${bestCandidate.headerRowIdx}, Score: ${bestCandidate.score}`);
      console.log(`Linhas extraídas: ${pagamentosRows.length}`);
      if (pagamentosRows.length > 0) {
        console.log('Primeira linha (raw):', pagamentosRows[0]);
      }
      
      if (resumoInfo) {
        resumoInfo.isOnlyResumo = false; // Tem transações
        resumoInfo.nomeAbaProcessada = bestCandidate.sheetName;
      } else {
        resumoInfo = {
          isOnlyResumo: false,
          nomeAbaProcessada: bestCandidate.sheetName
        };
      }
    } else {
      console.log('--- DBG REDE --- Nenhum cabeçalho válido encontrado nas abas.');
      return { pagamentos: [], recebidos: [], resumoInfo };
    }
  } catch (e) {
      console.error('--- DBG REDE --- Erro crítico ao ler arquivo:', e);
      throw e; // Lança o erro para o componente mostrar no alert
  }

  // Mapeia as linhas encontradas da Adquirente (Rede)
  const mappedPagamentos: AdquirenteRedePagamento[] = pagamentosRows
    .flatMap((row, idx): AdquirenteRedePagamento[] => {
      // Datas — suporta todos os formatos comuns do relatório Rede
      const dataRecebimento = parseDateString(
        getProp(row,
          'data do recebimento', 'data recebimento', 'data do pagamento', 'data pagamento',
          'data liquidacao', 'data credito', 'previsao de pagamento', 'dt pagamento', 'dt credito',
          'data de credito', 'data credit', 'dt. credito', 'dt credito', 'dt. pagamento',
          'data prevista do pagamento', 'data prevista de pagamento', 'data prevista',
          'data efetiva do pagamento', 'data efetiva', 'data do credito'
        )
      );
      const dataVenda = parseDateString(
        getProp(row,
          'data original da venda', 'data da venda', 'data venda', 'data transacao',
          'data da transacao', 'data operacao', 'data', 'dt venda', 'dt transacao',
          'dt. venda', 'dt. transacao', 'competencia', 'data de venda', 'data captura',
          'data original', 'data da captura', 'data do pedido'
        )
      );

      // Valores — suporta "Vlr. Bruto", "Valor Bruto", "Valor Total", etc.
      const valorBruto = cleanCurrency(
        getProp(row,
          'valor bruto da parcela original', 'valor bruto original', 'valor bruto',
          'bruto', 'valor da venda', 'valor transacao', 'valor total', 'valor',
          'vlr bruto', 'vlr. bruto', 'vl bruto', 'vl. bruto', 'total bruto',
          'valor venda', 'vl. da venda', 'vlr da venda', 'valor da parcela',
          'valor original da venda', 'valor original', 'montante bruto'
        )
      );
      const taxaMdrPerc = cleanTaxRate(
        getProp(row,
          'taxa mdr', 'taxa mdr (%)', 'mdr (%)', 'mdr', 'taxa (%)', 'taxa',
          'desconto taxa (%)', '% mdr', '% taxa', 'taxa retida', 'taxa desc',
          'taxa de desconto', '% desconto', 'percentual mdr', 'taxa (%)',
          'taxa administrativa (%)', 'percentual taxa administrativa', 'percentual da taxa'
        )
      );
      const valorMdr = cleanCurrency(
        getProp(row,
          'valor mdr descontado', 'valor mdr', 'desconto mdr', 'taxa descontada',
          'descontos', 'vlr mdr', 'valor desconto', 'desconto', 'valor taxa',
          'vlr. desconto', 'vl desconto', 'taxa cobrada', 'mdr retido',
          'valor taxa administrativa', 'taxa administrativa (r$)', 'valor da taxa',
          'valor comissao', 'comissao'
        )
      );
      const valorLiquido = cleanCurrency(
        getProp(row,
          'valor liquido da parcela', 'valor liquido', 'valor líquido', 'liquido',
          'líquido', 'valor a receber', 'valor pago', 'valor creditado',
          'vlr liquido', 'vlr líquido', 'vlr. liquido', 'vl liquido', 'vl. liquido',
          'total liquido', 'valor liq', 'vlr liq', 'valor liquido pago',
          'valor efetivo', 'montante liquido'
        )
      );

      // Identificadores
      const tid = String(getProp(row, 'tid', 'id tid', 'identificador', 'id transacao', 'transacao id', 'numero tid') || '').trim();
      const nsuCv = String(getProp(row, 'nsu/cv', 'nsu / cv', 'nsu', 'cv', 'numero comprovante', 'comprovante', 'nsu cv', 'num. comprovante', 'numero do comprovante', 'numero do nsu', 'numero nsu', 'numero do rv', 'numero rv', 'rv') || '').trim();
      const numAutorizacao = String(getProp(row, 'numero da autorizacao', 'número da autorização', 'autorizacao', 'autorização', 'cod autorizacao', 'código de autorização', 'num autorizacao', 'cod. autorizacao', 'codigo autorizacao', 'codigo de autorizacao') || '').trim();

      // Modalidade — suporta "Tipo de Venda", "Tipo Transação", "Produto Rede", etc.
      const modalidadeOriginal = String(
        getProp(row,
          'modalidade', 'modalidade de pagamento', 'tipo modalidade',
          'operacao', 'operação', 'produto', 'forma de pagamento',
          'tipo de transacao', 'tipo transacao', 'tipo',
          'tipo de venda', 'tipo venda', 'produto rede', 'tipo operacao',
          'descricao', 'descricao da modalidade', 'produto da venda',
          'tipo do produto', 'meio de captura'
        ) || ''
      ).trim();

      const rawModalidade = normalizeKey(modalidadeOriginal);
      let modalidade: 'CREDITO' | 'DEBITO' | 'PIX' = 'CREDITO';
      if (rawModalidade.includes('pix')) {
        modalidade = 'PIX';
      } else if (
        rawModalidade.includes('deb') || rawModalidade.includes('debit') ||
        rawModalidade.includes('maestro') || rawModalidade.includes('electron') ||
        rawModalidade.includes('elodebit')
      ) {
        modalidade = 'DEBITO';
      } else {
        modalidade = 'CREDITO';
      }

      const bandeira = String(getProp(row, 'bandeira', 'marca', 'bandeira cartao', 'cartao') || 'Outras').toUpperCase();
      const status = String(getProp(row, 'status', 'situacao', 'status pagamento', 'status transacao', 'situacao pagamento') || 'LIQUIDADO').toUpperCase();

      // Ignora linhas que NÃO têm nenhum campo relevante preenchido
      const temValorAlgum = valorBruto !== 0 || valorLiquido !== 0 || valorMdr !== 0;
      const temDataAlguma = !!(dataVenda || dataRecebimento);
      const temIdentificador = !!(tid || nsuCv || numAutorizacao);
      if (!temValorAlgum && !temDataAlguma && !temIdentificador) {
        return [];
      }

      // Calcula valores derivados se algum estiver ausente
      const valorMdrAbs = Math.abs(valorMdr);
      const vBruto = valorBruto || (valorLiquido > 0 ? valorLiquido + valorMdrAbs : 0);
      const vMdr = valorMdrAbs || (vBruto > valorLiquido && valorLiquido > 0 ? vBruto - valorLiquido : 0);
      const vLiquido = valorLiquido || (vBruto - vMdr > 0 ? vBruto - vMdr : vBruto);

      return [{
        id: `rede_pag_${idx + 1}_${tid || nsuCv || Date.now()}`,
        dataRecebimento,
        dataVenda: dataVenda || dataRecebimento,
        valorBruto: vBruto,
        taxaMdrPerc,
        valorMdr: vMdr,
        valorLiquido: vLiquido,
        tid,
        nsuCv,
        numAutorizacao,
        modalidade,
        modalidadeOriginal: modalidadeOriginal || modalidade,
        bandeira,
        status
      }];
    });

  pagamentos.push(...mappedPagamentos);

  return { pagamentos, recebidos, resumoInfo };
}

// Ingestão 4: Previsão de Recebíveis Futuros (exportacao-relatorio-previsao...xlsx)
export async function parsePrevisaoFile(file: File): Promise<PrevisaoRecebivel[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

  return rows.map((row, idx) => {
    const aReceber = String(getProp(row, 'a receber', 'situacao') || 'Sim').trim();
    const dataVenda = parseDateString(getProp(row, 'data da venda', 'data venda'));
    const parcela = String(getProp(row, 'parcela') || '1/1').trim();
    const transacao = String(getProp(row, 'transacao', 'transação', 'codigo', 'código') || '').trim();
    const tid = String(getProp(row, 'tid') || '').trim();
    const operacao = String(getProp(row, 'operacao', 'operação', 'modalidade') || 'Crédito').trim();
    const bandeira = String(getProp(row, 'bandeira') || 'Mastercard').trim();
    const valorBruto = cleanCurrency(getProp(row, 'valor bruto', 'bruto'));
    const mdrTaxaPerc = cleanTaxRate(getProp(row, 'mdr', 'taxa mdr'));
    const mdrValor = cleanCurrency(getProp(row, 'mdr valor', 'valor mdr'));
    const antecipacao = cleanCurrency(getProp(row, 'antecipacao', 'antecipação'));
    const valorLiquido = cleanCurrency(getProp(row, 'valor', 'valor liquido', 'valor líquido', 'liquido'));
    const statusTransacao = String(getProp(row, 'status da transacao', 'status da transação', 'status') || 'Previsto').trim();
    const dMais31 = parseDateString(getProp(row, 'd+31', 'd+30', 'previsao liquidacao', 'vencimento'));

    return {
      id: `prev_${idx + 1}_${transacao || tid || Date.now()}`,
      aReceber,
      dataVenda,
      parcela,
      transacao,
      tid,
      operacao,
      bandeira,
      valorBruto,
      mdrTaxaPerc,
      mdrValor: mdrValor || (valorBruto - valorLiquido),
      antecipacao,
      valorLiquido: valorLiquido || (valorBruto - mdrValor),
      statusTransacao,
      dMais31: dMais31 || addDays(dataVenda, 31)
    };
  });
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// MOTOR DE CONCILIAÇÃO COMPLETO
export function runReconciliationEngine(
  pdvData: PDVMovimentacao[],
  clubeData: GatewayClubeTransacao[],
  redePagamentos: AdquirenteRedePagamento[],
  redeRecebidos: AdquirenteRedeRecebido[],
  previsaoData: PrevisaoRecebivel[],
  entradasManuais: EntradaManual[] = []
): {
  items: ConciliationItem[];
  dailyClosings: DailyClosing[];
  kpis: ReconciliationKPIs;
  cashFlowTimeline: { data: string; realizado: number; projetado: number; taxas: number }[];
  batches: BatchConciliationItem[];
  comparativoFormasPgto?: TotaisComparativoFormasPgto;
  resumoLotesCartao?: ResumoLotesCartao;
} {
  const items: ConciliationItem[] = [];

  // --- PASSO 1 & 2: Roteamento de Entradas Manuais (Assinaturas Balcão) ---
  const redeAssinaturaIds = new Set<string>();
  const entradasConciliadasIds = new Set<string>();

  const extractCode = (desc: string) => {
    const match = desc.match(/(?:NSU|AUT|PIX|ID|REF)[\s:=-]*([A-Za-z0-9]+)/i);
    return match ? match[1].toUpperCase() : desc.trim().toUpperCase();
  };

  entradasManuais.forEach(entrada => {
    const isRede = entrada.tag === 'ASSINATURA_BALCAO_REDE';
    const isPix = entrada.tag === 'ASSINATURA_BALCAO_PIX';
    const chave = extractCode(entrada.descricao);

    if (isRede) {
      const match = redePagamentos.find(rp => 
        (rp.nsuCv?.toUpperCase() === chave || rp.numAutorizacao?.toUpperCase() === chave) &&
        !redeAssinaturaIds.has(rp.id)
      );

      if (match) {
        redeAssinaturaIds.add(match.id);
        entradasConciliadasIds.add(entrada.id);
        
        items.push({
          id: `recon_balcao_rede_${entrada.id}`,
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
          statusDescricao: `Conciliado com Rede (NSU/AUT: ${chave})`,
          dataLiquidacaoPrevista: match.dataRecebimento
        });
      } else {
        items.push({
          id: `recon_balcao_rede_${entrada.id}`,
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
          statusDescricao: `Entrada Manual sem match na adquirente. (Busca: ${chave})`
        });
      }
    } else if (isPix) {
      entradasConciliadasIds.add(entrada.id);
      items.push({
        id: `recon_balcao_pix_${entrada.id}`,
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
        statusDescricao: `Baixa PIX Direta (Comprovante: ${chave})`
      });
    }
  });

  // Validação Cruzada Gateway
  clubeData.forEach(fatura => {
    if (fatura.status.toLowerCase().includes('paga fora do sistema')) {
      const match = entradasManuais.find(e => 
        e.cliente.toLowerCase().includes(fatura.nomeCliente.toLowerCase()) && 
        e.valor === fatura.valor
      );
      
      if (!match) {
        items.push({
          id: `recon_gateway_ext_${fatura.id}`,
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
          statusDescricao: 'Marcada como Paga Fora do Sistema no Clube, mas sem lançamento de entrada correspondente.'
        });
      }
    }
  });

  // REGRA 1: Gateway vs. Previsão de Recebíveis
  const matchedPrevIds = new Set<string>();

  clubeData.forEach((clube) => {
    const isAuthorized = clube.status === 'PAGO' || clube.status === 'AUTORIZADO';
    
    const matchedPrev = previsaoData.find((prev) => {
      if (matchedPrevIds.has(prev.id)) return false;
      const matchTransacao = prev.transacao && clube.codigo && prev.transacao.toUpperCase() === clube.codigo.toUpperCase();
      const matchTid = prev.tid && clube.tid && prev.tid.toUpperCase() === clube.tid.toUpperCase();
      const matchValor = Math.abs(prev.valorBruto - clube.valor) <= 0.05;
      return (matchTransacao || matchTid) && matchValor;
    });

    if (matchedPrev) {
      matchedPrevIds.add(matchedPrev.id);
      const valorBruto = clube.valor;
      const valorLiquido = matchedPrev.valorLiquido;
      const mdrRetido = matchedPrev.mdrValor;
      const taxaEfetiva = matchedPrev.mdrTaxaPerc;
      const taxaContratual = matchedPrev.operacao.toLowerCase().includes('debito') ? 1.19 : 2.39;
      const diferencaTaxa = Math.abs(taxaEfetiva - taxaContratual);

      let status: ConciliationItem['status'] = 'CONCILIADO';
      let statusDescricao = 'Conciliado com sucesso com Previsão D+31';

      if (diferencaTaxa > 0.5) {
        status = 'DIVERGENCIA_TAXA';
        statusDescricao = `Taxa MDR Divergente: Cobrado ${taxaEfetiva.toFixed(2)}% vs Contratual ${taxaContratual}%`;
      }

      items.push({
        id: `c1_${clube.id}`,
        regra: 'REGRA_1_CLUBE_PREVISAO',
        dataVenda: matchedPrev.dataVenda || clube.dataStatusAtual || clube.vencimento,
        identificador: clube.tid || clube.codigo || matchedPrev.transacao,
        clienteOuDesc: clube.nomeCliente,
        modalidadeOuPlano: clube.plano,
        bandeira: matchedPrev.bandeira,
        valorBruto,
        valorMdrRetido: mdrRetido,
        valorLiquido,
        mdrTaxaEfetiva: Number(taxaEfetiva.toFixed(2)),
        mdrTaxaContratual: taxaContratual,
        diferencaTaxa: Number(diferencaTaxa.toFixed(2)),
        status,
        statusDescricao,
        statusPrevisao: matchedPrev.statusTransacao,
        dataLiquidacaoPrevista: matchedPrev.dMais31
      });
    } else {
      const status = isAuthorized ? 'RECEBIDO_FORA_DO_GATEWAY' : 'NAO_AUTORIZADO';
      items.push({
        id: `c1_orphan_${clube.id}`,
        regra: 'REGRA_1_CLUBE_PREVISAO',
        dataVenda: clube.dataStatusAtual || clube.vencimento,
        identificador: clube.tid || clube.codigo,
        clienteOuDesc: clube.nomeCliente,
        modalidadeOuPlano: clube.plano,
        valorBruto: clube.valor,
        valorMdrRetido: 0,
        valorLiquido: clube.valor,
        mdrTaxaEfetiva: 0,
        diferencaTaxa: 0,
        status,
        statusDescricao: isAuthorized 
          ? 'Autorizado no Clube, aguardando entrada no arquivo de previsão' 
          : `Não Autorizado: ${clube.descricaoStatus || clube.status}`
      });
    }
  });

  previsaoData.forEach((prev) => {
    if (!matchedPrevIds.has(prev.id)) {
      items.push({
        id: `c1_prev_only_${prev.id}`,
        regra: 'REGRA_1_CLUBE_PREVISAO',
        dataVenda: prev.dataVenda,
        identificador: prev.tid || prev.transacao,
        clienteOuDesc: 'Assinatura Recorrente',
        modalidadeOuPlano: prev.operacao,
        bandeira: prev.bandeira,
        valorBruto: prev.valorBruto,
        valorMdrRetido: prev.valorBruto - prev.valorLiquido,
        valorLiquido: prev.valorLiquido,
        mdrTaxaEfetiva: prev.mdrTaxaPerc,
        diferencaTaxa: 0,
        status: 'PENDENTE_LIQUIDACAO',
        statusDescricao: `Previsão a receber D+31 (${prev.dMais31})`,
        dataLiquidacaoPrevista: prev.dMais31,
        statusPrevisao: prev.statusTransacao
      });
    }
  });

  // --- CONCILIAÇÃO POR LOTES DIÁRIOS (CHAVE COMPOSTA: [Data da Venda, Forma de Pagamento / Modalidade]) ---
  // Mapeia todas as formas de pagamento do PDV e compara com os lotes da Adquirente Rede por dia
  const batchMap = new Map<string, BatchConciliationItem>();

  // 1. Agrupar PDV por [DataVenda, Modalidade]
  pdvData.forEach(pdv => {
    const dataVenda = pdv.dataDia;
    if (!dataVenda) return;
    const norm = normalizeFormaPgto(pdv.formaPgto);
    const modalidade = norm.modalidadeLote;
    const key = `${dataVenda}|${modalidade}`;

    let tipoSaldo: BatchConciliationItem['tipoSaldo'] = 'INTERMEDIADO_REDE';
    if (modalidade === 'PIX') tipoSaldo = 'PIX_DIRETO';
    else if (modalidade === 'Dinheiro') tipoSaldo = 'CAIXA_GAVETA';
    else if (modalidade === 'Assinatura') tipoSaldo = 'ASSINATURA_ONLINE';
    else if (['Cortesia', 'Vale Presente', 'Crédito Anterior', 'Outros'].includes(modalidade)) tipoSaldo = 'CORTESIA_OUTROS';

    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: `batch_${key}`,
        dataVenda,
        modalidade,
        qtdPdv: 0,
        totalPdv: 0,
        qtdRede: 0,
        totalRedeBruto: 0,
        totalTaxaMdr: 0,
        totalRedeLiquido: 0,
        diferencaBruta: 0,
        taxaMdrMedia: 0,
        status: 'CONCILIADO',
        diagnostico: '',
        tipoSaldo
      });
    }

    const b = batchMap.get(key)!;
    b.qtdPdv += 1;
    b.totalPdv += pdv.valor;
  });

  // 2. Agrupar Rede por [DataVenda, Modalidade]
  redePagamentos.forEach(rp => {
    if (redeAssinaturaIds.has(rp.id)) return;
    const dataVenda = rp.dataVenda;
    if (!dataVenda) return;

    let mod: 'Crédito' | 'Débito' | 'PIX' = 'Crédito';
    if (rp.modalidade === 'DEBITO') mod = 'Débito';
    else if (rp.modalidade === 'PIX') mod = 'PIX';
    else mod = 'Crédito';

    const key = `${dataVenda}|${mod}`;

    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: `batch_${key}`,
        dataVenda,
        modalidade: mod,
        qtdPdv: 0,
        totalPdv: 0,
        qtdRede: 0,
        totalRedeBruto: 0,
        totalTaxaMdr: 0,
        totalRedeLiquido: 0,
        diferencaBruta: 0,
        taxaMdrMedia: 0,
        status: 'CONCILIADO',
        diagnostico: '',
        tipoSaldo: 'INTERMEDIADO_REDE'
      });
    }

    const b = batchMap.get(key)!;
    b.qtdRede += 1;
    b.totalRedeBruto += rp.valorBruto;
    b.totalTaxaMdr += rp.valorMdr;
    b.totalRedeLiquido += rp.valorLiquido;
    // Se a Rede processou PIX neste dia, atualiza tipo de saldo
    if (mod === 'PIX' && b.totalRedeBruto > 0) {
      b.tipoSaldo = 'INTERMEDIADO_REDE';
    }
  });

  // 3. Cruzamento Full Outer Join e Cálculo de Diferenças e Status
  const batches: BatchConciliationItem[] = Array.from(batchMap.values()).map(b => {
    b.totalPdv = Number(b.totalPdv.toFixed(2));
    b.totalRedeBruto = Number(b.totalRedeBruto.toFixed(2));
    b.totalTaxaMdr = Number(b.totalTaxaMdr.toFixed(2));
    b.totalRedeLiquido = Number(b.totalRedeLiquido.toFixed(2));
    b.diferencaBruta = Number((b.totalPdv - b.totalRedeBruto).toFixed(2));
    b.taxaMdrMedia = b.totalRedeBruto > 0 ? Number(((b.totalTaxaMdr / b.totalRedeBruto) * 100).toFixed(2)) : 0;

    // Regras de Status por Modalidade
    if (b.modalidade === 'Crédito' || b.modalidade === 'Débito') {
      if (Math.abs(b.diferencaBruta) <= 0.05 && b.totalRedeBruto > 0) {
        b.status = 'CONCILIADO';
        b.diagnostico = 'Lote 100% conciliado com a Rede';
      } else if (b.totalPdv > 0 && b.totalRedeBruto === 0) {
        b.status = 'DIVERGENTE';
        b.diagnostico = 'Vendas no PDV sem lote correspondente na Rede (Falta na Rede)';
      } else if (b.totalPdv === 0 && b.totalRedeBruto > 0) {
        b.status = 'DIVERGENTE';
        b.diagnostico = 'Transação na Rede sem registro no PDV (Sobra na Rede)';
      } else if (b.diferencaBruta > 0.05) {
        b.status = 'DIVERGENTE';
        b.diagnostico = `PDV maior em R$ ${b.diferencaBruta.toFixed(2)} (Falta na Rede / venda não capturada)`;
      } else {
        b.status = 'DIVERGENTE';
        b.diagnostico = `Rede maior em R$ ${Math.abs(b.diferencaBruta).toFixed(2)} (Sobra na Rede / venda não lançada no balcão)`;
      }
    } else if (b.modalidade === 'PIX') {
      if (b.totalRedeBruto > 0) {
        b.tipoSaldo = 'INTERMEDIADO_REDE';
        if (Math.abs(b.diferencaBruta) <= 0.05) {
          b.status = 'CONCILIADO';
          b.diagnostico = 'Lote Pix na maquininha 100% conciliado';
        } else {
          b.status = 'DIVERGENTE';
          b.diagnostico = `Diferença Pix de R$ ${b.diferencaBruta.toFixed(2)} entre PDV e Rede`;
        }
      } else {
        b.tipoSaldo = 'PIX_DIRETO';
        b.status = 'PIX_CONTA_BANCARIA';
        b.diagnostico = 'Recebimento Pix direto em conta bancária (saldo fora da maquininha Rede)';
      }
    } else if (b.modalidade === 'Dinheiro') {
      b.tipoSaldo = 'CAIXA_GAVETA';
      b.status = 'CAIXA_FISICO';
      b.diagnostico = 'Recebido em espécie no caixa físico da barbearia (gaveta)';
    } else if (b.modalidade === 'Assinatura') {
      b.tipoSaldo = 'ASSINATURA_ONLINE';
      b.status = 'ASSINATURA_CLUBE';
      b.diagnostico = 'Atendimento de assinante do Clube VANS (faturamento online via gateway recorrente)';
    } else {
      b.tipoSaldo = 'CORTESIA_OUTROS';
      b.status = 'SALDO_NAO_INTERMEDIADO';
      b.diagnostico = `${b.modalidade}: atendimento sem intermediação financeira de adquirente`;
    }

    return b;
  });

  // Ordenar por data decrescente e modalidade
  batches.sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || a.modalidade.localeCompare(b.modalidade));

  // Adicionar lotes divergentes e relevantes à lista de itens principais
  batches.forEach(b => {
    items.push({
      id: b.id,
      regra: 'REGRA_2_PDV_REDE',
      dataVenda: b.dataVenda,
      identificador: `Lote ${b.dataVenda} - ${b.modalidade}`,
      clienteOuDesc: `Fechamento Lote (${b.modalidade})`,
      modalidadeOuPlano: b.modalidade,
      valorBruto: b.totalPdv,
      valorMdrRetido: b.totalTaxaMdr,
      valorLiquido: b.totalRedeLiquido,
      mdrTaxaEfetiva: Number(b.taxaMdrMedia.toFixed(2)),
      mdrTaxaContratual: b.modalidade === 'Débito' ? 1.19 : 2.39,
      diferencaTaxa: Math.abs(b.diferencaBruta),
      status: b.status as any,
      statusDescricao: b.diagnostico || `Status: ${b.status}`
    });
  });

  // 4. Apuração dos Saldos Não Intermediados na Adquirente e Divergências
  const saldosNaoAdquirente: SaldoNaoAdquirenteItem[] = [];
  let totalPixContaBancaria = 0;
  let totalDinheiroCaixa = 0;
  let totalCartaoFaltaRede = 0;
  let totalCartaoSobraRede = 0;

  batches.forEach(b => {
    if (b.modalidade === 'PIX' && b.totalRedeBruto === 0 && b.totalPdv > 0) {
      totalPixContaBancaria += b.totalPdv;
      saldosNaoAdquirente.push({
        data: b.dataVenda,
        formaPgto: 'Pix Direto (Conta)',
        categoria: 'PIX_DIRETO',
        valor: b.totalPdv,
        qtd: b.qtdPdv,
        descricao: `Recebido direto em conta bancária via Pix (${b.qtdPdv} vendas)`
      });
    } else if (b.modalidade === 'Dinheiro' && b.totalPdv > 0) {
      totalDinheiroCaixa += b.totalPdv;
      saldosNaoAdquirente.push({
        data: b.dataVenda,
        formaPgto: 'Dinheiro (Gaveta)',
        categoria: 'DINHEIRO_GAVETA',
        valor: b.totalPdv,
        qtd: b.qtdPdv,
        descricao: `Dinheiro em espécie no caixa físico (${b.qtdPdv} vendas)`
      });
    } else if ((b.modalidade === 'Crédito' || b.modalidade === 'Débito') && b.diferencaBruta > 0.05) {
      totalCartaoFaltaRede += b.diferencaBruta;
      saldosNaoAdquirente.push({
        data: b.dataVenda,
        formaPgto: `Cartão de ${b.modalidade}`,
        categoria: 'CARTAO_NAO_CAPTURADO',
        valor: b.diferencaBruta,
        qtd: Math.max(1, b.qtdPdv - b.qtdRede),
        descricao: `Venda de ${b.modalidade} no PDV não identificada na Rede (R$ ${b.diferencaBruta.toFixed(2)})`
      });
    } else if ((b.modalidade === 'Crédito' || b.modalidade === 'Débito') && b.diferencaBruta < -0.05) {
      totalCartaoSobraRede += Math.abs(b.diferencaBruta);
    } else if (['Cortesia', 'Vale Presente', 'Crédito Anterior', 'Outros'].includes(b.modalidade) && b.totalPdv > 0) {
      saldosNaoAdquirente.push({
        data: b.dataVenda,
        formaPgto: b.modalidade,
        categoria: 'CORTESIA_OUTROS',
        valor: b.totalPdv,
        qtd: b.qtdPdv,
        descricao: `Atendimento via ${b.modalidade} (${b.qtdPdv} atendimentos)`
      });
    }
  });

  const totalSaldosNaoAdquirente = Number((totalPixContaBancaria + totalDinheiroCaixa + totalCartaoFaltaRede).toFixed(2));

  // 5. Resumo Executivo dos Lotes de Cartão e Divergências
  const lotesCartao = batches.filter(b => b.modalidade === 'Crédito' || b.modalidade === 'Débito');
  const totalBrutoPdvCartao = Number(lotesCartao.reduce((s, b) => s + b.totalPdv, 0).toFixed(2));
  const qtdVendasPdvCartao = lotesCartao.reduce((s, b) => s + b.qtdPdv, 0);
  const totalBrutoRedeCartao = Number(lotesCartao.reduce((s, b) => s + b.totalRedeBruto, 0).toFixed(2));
  const qtdVendasRedeCartao = lotesCartao.reduce((s, b) => s + b.qtdRede, 0);
  const totalTaxaMdrCartao = Number(lotesCartao.reduce((s, b) => s + b.totalTaxaMdr, 0).toFixed(2));
  const totalLiquidoRedeCartao = Number(lotesCartao.reduce((s, b) => s + b.totalRedeLiquido, 0).toFixed(2));
  const diferencaBrutaGlobal = Number((totalBrutoPdvCartao - totalBrutoRedeCartao).toFixed(2));
  const taxaMdrMediaPerc = totalBrutoRedeCartao > 0 ? Number(((totalTaxaMdrCartao / totalBrutoRedeCartao) * 100).toFixed(2)) : 0;
  
  const lotesConciliados = lotesCartao.filter(b => b.status === 'CONCILIADO').length;
  const lotesDivergentes = lotesCartao.filter(b => b.status === 'DIVERGENTE').length;

  const diasDivergentes = lotesCartao
    .filter(b => b.status === 'DIVERGENTE')
    .map(b => ({
      data: b.dataVenda,
      modalidade: b.modalidade,
      diferenca: b.diferencaBruta,
      totalPdv: b.totalPdv,
      totalRede: b.totalRedeBruto,
      motivo: b.diagnostico || (b.diferencaBruta > 0 ? 'Falta na Rede' : 'Sobra na Rede')
    }));

  const resumoLotesCartao: ResumoLotesCartao = {
    totalBrutoPdvCartao,
    qtdVendasPdvCartao,
    totalBrutoRedeCartao,
    qtdVendasRedeCartao,
    totalTaxaMdrCartao,
    taxaMdrMediaPerc,
    totalLiquidoRedeCartao,
    diferencaBrutaGlobal,
    qtdLotesTotal: lotesCartao.length,
    qtdLotesConciliados: lotesConciliados,
    qtdLotesDivergentes: lotesDivergentes,
    totalSaldosNaoAdquirente,
    totalPixContaBancaria: Number(totalPixContaBancaria.toFixed(2)),
    totalDinheiroCaixa: Number(totalDinheiroCaixa.toFixed(2)),
    totalCartaoFaltaRede: Number(totalCartaoFaltaRede.toFixed(2)),
    totalCartaoSobraRede: Number(totalCartaoSobraRede.toFixed(2)),
    diasDivergentes,
    saldosNaoAdquirente
  };

  // 6. Fechamento Diário de Caixa
  const allDates = new Set<string>();
  pdvData.forEach(p => p.dataDia && allDates.add(p.dataDia));
  redePagamentos.forEach(r => r.dataVenda && allDates.add(r.dataVenda));
  const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

  const dailyClosings: DailyClosing[] = sortedDates.map(date => {
    const dayPdv = pdvData.filter(p => p.dataDia === date);
    const dayRede = redePagamentos.filter(r => r.dataVenda === date);

    const pdvTotalBruto = Number(dayPdv.reduce((sum, p) => sum + p.valor, 0).toFixed(2));
    const pdvDinheiro = Number(dayPdv.filter(p => normalizeKey(p.formaPgto).includes('dinheiro')).reduce((sum, p) => sum + p.valor, 0).toFixed(2));
    const pdvPix = Number(dayPdv.filter(p => normalizeKey(p.formaPgto).includes('pix')).reduce((sum, p) => sum + p.valor, 0).toFixed(2));
    const pdvCartaoCredito = Number(dayPdv.filter(p => {
      const f = normalizeKey(p.formaPgto);
      return (f.includes('cred') || f.includes('cartao')) && !f.includes('deb');
    }).reduce((sum, p) => sum + p.valor, 0).toFixed(2));
    const pdvCartaoDebito = Number(dayPdv.filter(p => normalizeKey(p.formaPgto).includes('deb')).reduce((sum, p) => sum + p.valor, 0).toFixed(2));
    const pdvAssinaturasCount = dayPdv.filter(p => p.isAssinaturaClube).length;

    const redeTotalBruto = Number(dayRede.reduce((sum, r) => sum + r.valorBruto, 0).toFixed(2));
    const redeTotalLiquido = Number(dayRede.reduce((sum, r) => sum + r.valorLiquido, 0).toFixed(2));
    const redeTaxasMdr = Number((redeTotalBruto - redeTotalLiquido).toFixed(2));
    const redeDepositosConfirmados = redeTotalLiquido;

    const dayBatches = batches.filter(b => b.dataVenda === date && (b.modalidade === 'Crédito' || b.modalidade === 'Débito'));
    const divergencias = dayBatches.filter(b => b.status === 'DIVERGENTE');

    let status: DailyClosing['status'] = 'CONCILIADO';
    if (divergencias.length > 0) {
      status = 'DIVERGENTE';
    }

    return {
      data: date,
      pdvTotalBruto,
      pdvDinheiro,
      pdvPix,
      pdvCartaoCredito,
      pdvCartaoDebito,
      pdvAssinaturasCount,
      redeTotalBruto,
      redeTotalLiquido,
      redeTaxasMdr,
      redeDepositosConfirmados,
      divergenciasCount: divergencias.length,
      status
    };
  });

  // KPIs
  const totalLiquidadosRede = redePagamentos.reduce((sum, r) => sum + r.valorLiquido, 0);
  const totalDinheiroPixPdv = pdvData
    .filter(p => {
      const f = normalizeKey(p.formaPgto);
      return f.includes('dinheiro') || f.includes('pix');
    })
    .reduce((sum, p) => sum + p.valor, 0);

  const saldoRealEmConta = Number((totalLiquidadosRede + totalDinheiroPixPdv).toFixed(2));
  const totalFaturadoPDV = Number(pdvData.reduce((sum, p) => sum + p.valor, 0).toFixed(2));
  const totalAprovadoAdquirente = Number(redePagamentos.reduce((sum, r) => sum + r.valorBruto, 0).toFixed(2));
  const previsaoEntradasD30 = Number(previsaoData.reduce((sum, p) => sum + p.valorLiquido, 0).toFixed(2));
  
  const totalDivergenciasValor = Number((totalCartaoFaltaRede + totalCartaoSobraRede).toFixed(2));
  const totalDivergenciasCount = diasDivergentes.length;
  const totalTaxasMdrRetidas = Number(redePagamentos.reduce((sum, r) => sum + r.valorMdr, 0).toFixed(2));

  const kpis: ReconciliationKPIs = {
    saldoRealEmConta,
    totalFaturadoPDV,
    totalAprovadoAdquirente,
    previsaoEntradasD30,
    totalDivergenciasValor,
    totalDivergenciasCount,
    totalTaxasMdrRetidas
  };

  // Linha do tempo de fluxo de caixa
  const timelineMap: Record<string, { realizado: number; projetado: number; taxas: number }> = {};
  dailyClosings.forEach(dc => {
    if (!timelineMap[dc.data]) {
      timelineMap[dc.data] = { realizado: 0, projetado: 0, taxas: 0 };
    }
    timelineMap[dc.data].realizado += (dc.redeTotalLiquido + dc.pdvDinheiro + dc.pdvPix);
    timelineMap[dc.data].taxas += dc.redeTaxasMdr;
  });

  previsaoData.forEach(p => {
    const targetDate = p.dMais31 || addDays(p.dataVenda, 31);
    if (targetDate) {
      if (!timelineMap[targetDate]) {
        timelineMap[targetDate] = { realizado: 0, projetado: 0, taxas: 0 };
      }
      timelineMap[targetDate].projetado += p.valorLiquido;
      timelineMap[targetDate].taxas += (p.valorBruto - p.valorLiquido);
    }
  });

  const cashFlowTimeline = Object.keys(timelineMap)
    .sort((a, b) => a.localeCompare(b))
    .map(data => ({
      data,
      realizado: Number(timelineMap[data].realizado.toFixed(2)),
      projetado: Number(timelineMap[data].projetado.toFixed(2)),
      taxas: Number(timelineMap[data].taxas.toFixed(2))
    }));

  const comparativoFormasPgto = calcularComparativoFormasPagamento(pdvData, redePagamentos, redeAssinaturaIds);

  return { items, dailyClosings, kpis, cashFlowTimeline, batches, comparativoFormasPgto, resumoLotesCartao };
}

// Função dedicada para comparar totais de cada forma de pagamento do PDV com a Adquirente
export function calcularComparativoFormasPagamento(
  pdvData: PDVMovimentacao[],
  redePagamentos: AdquirenteRedePagamento[],
  redeAssinaturaIds: Set<string> = new Set()
): TotaisComparativoFormasPgto {
  const redeValida = redePagamentos.filter(r => !redeAssinaturaIds.has(r.id));

  // 1. Cartão de Crédito
  const pdvCredito = pdvData.filter(p => {
    const f = normalizeKey(p.formaPgto);
    return (f.includes('cred') || f.includes('cartao')) && !f.includes('deb');
  });
  const redeCredito = redeValida.filter(r => {
    const m = normalizeKey(r.modalidade);
    return (m === 'credito' || m.includes('cred')) && !m.includes('deb') && !m.includes('pix');
  });

  const totalPdvCredito = Number(pdvCredito.reduce((s, p) => s + p.valor, 0).toFixed(2));
  const totalRedeCreditoBruto = Number(redeCredito.reduce((s, r) => s + r.valorBruto, 0).toFixed(2));
  const totalRedeCreditoLiquido = Number(redeCredito.reduce((s, r) => s + r.valorLiquido, 0).toFixed(2));
  const totalMdrCredito = Number((totalRedeCreditoBruto - totalRedeCreditoLiquido).toFixed(2));
  const difCredito = Number((totalPdvCredito - totalRedeCreditoBruto).toFixed(2));

  // 2. Cartão de Débito
  const pdvDebito = pdvData.filter(p => normalizeKey(p.formaPgto).includes('deb'));
  const redeDebito = redeValida.filter(r => {
    const m = normalizeKey(r.modalidade);
    return m === 'debito' || m.includes('deb');
  });

  const totalPdvDebito = Number(pdvDebito.reduce((s, p) => s + p.valor, 0).toFixed(2));
  const totalRedeDebitoBruto = Number(redeDebito.reduce((s, r) => s + r.valorBruto, 0).toFixed(2));
  const totalRedeDebitoLiquido = Number(redeDebito.reduce((s, r) => s + r.valorLiquido, 0).toFixed(2));
  const totalMdrDebito = Number((totalRedeDebitoBruto - totalRedeDebitoLiquido).toFixed(2));
  const difDebito = Number((totalPdvDebito - totalRedeDebitoBruto).toFixed(2));

  // 3. Pix
  const pdvPix = pdvData.filter(p => normalizeKey(p.formaPgto).includes('pix'));
  const redePix = redeValida.filter(r => normalizeKey(r.modalidade).includes('pix'));

  const totalPdvPix = Number(pdvPix.reduce((s, p) => s + p.valor, 0).toFixed(2));
  const totalRedePixBruto = Number(redePix.reduce((s, r) => s + r.valorBruto, 0).toFixed(2));
  const totalRedePixLiquido = Number(redePix.reduce((s, r) => s + r.valorLiquido, 0).toFixed(2));
  const totalMdrPix = Number((totalRedePixBruto - totalRedePixLiquido).toFixed(2));
  const difPix = Number((totalPdvPix - totalRedePixBruto).toFixed(2));

  // 4. Dinheiro
  const pdvDinheiro = pdvData.filter(p => normalizeKey(p.formaPgto).includes('dinheiro') || normalizeKey(p.formaPgto).includes('especie'));
  const totalPdvDinheiro = Number(pdvDinheiro.reduce((s, p) => s + p.valor, 0).toFixed(2));

  // 5. Assinaturas Balcão
  const pdvAssinaturas = pdvData.filter(p => normalizeKey(p.formaPgto).includes('assinatura') || p.isAssinaturaClube);
  const totalPdvAssinaturas = Number(pdvAssinaturas.reduce((s, p) => s + p.valor, 0).toFixed(2));

  // 6. Cortesia
  const pdvCortesia = pdvData.filter(p => normalizeKey(p.formaPgto).includes('cortesia'));
  const totalPdvCortesia = Number(pdvCortesia.reduce((s, p) => s + p.valor, 0).toFixed(2));

  // 7. Vale Presente
  const pdvVale = pdvData.filter(p => normalizeKey(p.formaPgto).includes('valepresente') || normalizeKey(p.formaPgto).includes('voucher'));
  const totalPdvVale = Number(pdvVale.reduce((s, p) => s + p.valor, 0).toFixed(2));

  // 8. Crédito Anterior
  const pdvCreditoAnterior = pdvData.filter(p => normalizeKey(p.formaPgto).includes('creditoanterior') || normalizeKey(p.formaPgto).includes('saldo'));
  const totalPdvCreditoAnterior = Number(pdvCreditoAnterior.reduce((s, p) => s + p.valor, 0).toFixed(2));

  // 9. Outros
  const pdvOutros = pdvData.filter(p => {
    const f = normalizeKey(p.formaPgto);
    return !f.includes('cred') && !f.includes('cartao') && !f.includes('deb') &&
           !f.includes('pix') && !f.includes('dinheiro') && !f.includes('especie') &&
           !f.includes('assinatura') && !f.includes('cortesia') &&
           !f.includes('valepresente') && !f.includes('voucher') &&
           !f.includes('creditoanterior') && !f.includes('saldo') &&
           !p.isAssinaturaClube;
  });
  const totalPdvOutros = Number(pdvOutros.reduce((s, p) => s + p.valor, 0).toFixed(2));

  const formatTaxa = (mdr: number, bruto: number) => bruto > 0 ? Number(((mdr / bruto) * 100).toFixed(2)) : 0;

  const getStatusCard = (dif: number, totalPdv: number, totalRede: number) => {
    if (Math.abs(dif) <= 0.05 && totalRede > 0) return { status: 'CONCILIADO' as const, desc: 'Valores 100% batendo entre PDV e Adquirente' };
    if (totalPdv > 0 && totalRede === 0) return { status: 'NAO_ENCONTRADO_ADQUIRENTE' as const, desc: 'Vendas no PDV sem lote correspondente na Adquirente' };
    if (totalPdv === 0 && totalRede > 0) return { status: 'NAO_ENCONTRADO_PDV' as const, desc: 'Transações na Adquirente sem venda registrada no PDV' };
    return {
      status: 'DIVERGENTE' as const,
      desc: dif > 0 
        ? `Diferença de R$ ${Math.abs(dif).toFixed(2)} (Falta na Adquirente / venda não capturada)` 
        : `Diferença de R$ ${Math.abs(dif).toFixed(2)} (Sobra na Adquirente / valor maior que PDV)`
    };
  };

  const statusCredito = getStatusCard(difCredito, totalPdvCredito, totalRedeCreditoBruto);
  const statusDebito = getStatusCard(difDebito, totalPdvDebito, totalRedeDebitoBruto);
  const statusPix = totalRedePixBruto > 0
    ? getStatusCard(difPix, totalPdvPix, totalRedePixBruto)
    : { status: 'PIX_CONTA_BANCARIA' as const, desc: 'Recebimento Pix direto em conta bancária (sem retenção de taxa na maquininha)' };

  const totaisPorForma: FormaPagamentoComparison[] = [
    {
      id: 'forma_credito',
      formaPgtoNome: 'Cartão de Crédito',
      categoria: 'CARTAO_CREDITO',
      totalPdv: totalPdvCredito,
      qtdPdv: pdvCredito.length,
      totalAdquirenteBruto: totalRedeCreditoBruto,
      qtdAdquirente: redeCredito.length,
      diferencaBruta: difCredito,
      totalMdrRetido: totalMdrCredito,
      taxaMdrMedia: formatTaxa(totalMdrCredito, totalRedeCreditoBruto),
      totalAdquirenteLiquido: totalRedeCreditoLiquido,
      status: statusCredito.status,
      descricaoStatus: statusCredito.desc
    },
    {
      id: 'forma_debito',
      formaPgtoNome: 'Cartão de Débito',
      categoria: 'CARTAO_DEBITO',
      totalPdv: totalPdvDebito,
      qtdPdv: pdvDebito.length,
      totalAdquirenteBruto: totalRedeDebitoBruto,
      qtdAdquirente: redeDebito.length,
      diferencaBruta: difDebito,
      totalMdrRetido: totalMdrDebito,
      taxaMdrMedia: formatTaxa(totalMdrDebito, totalRedeDebitoBruto),
      totalAdquirenteLiquido: totalRedeDebitoLiquido,
      status: statusDebito.status,
      descricaoStatus: statusDebito.desc
    },
    {
      id: 'forma_pix',
      formaPgtoNome: 'Pix',
      categoria: 'PIX',
      totalPdv: totalPdvPix,
      qtdPdv: pdvPix.length,
      totalAdquirenteBruto: totalRedePixBruto,
      qtdAdquirente: redePix.length,
      diferencaBruta: difPix,
      totalMdrRetido: totalMdrPix,
      taxaMdrMedia: formatTaxa(totalMdrPix, totalRedePixBruto),
      totalAdquirenteLiquido: totalRedePixLiquido,
      status: statusPix.status,
      descricaoStatus: statusPix.desc
    },
    {
      id: 'forma_dinheiro',
      formaPgtoNome: 'Dinheiro (Espécie)',
      categoria: 'DINHEIRO',
      totalPdv: totalPdvDinheiro,
      qtdPdv: pdvDinheiro.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvDinheiro,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'CAIXA_FISICO',
      descricaoStatus: 'Recebido em espécie no caixa físico da barbearia (gaveta)'
    },
    {
      id: 'forma_assinatura',
      formaPgtoNome: 'Assinatura / Clube (Balcão)',
      categoria: 'ASSINATURA',
      totalPdv: totalPdvAssinaturas,
      qtdPdv: pdvAssinaturas.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvAssinaturas,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'CONCILIADO',
      descricaoStatus: 'Atendimentos do plano clube (faturamento online via gateway recorrente D+31)'
    }
  ];

  if (pdvCortesia.length > 0) {
    totaisPorForma.push({
      id: 'forma_cortesia',
      formaPgtoNome: 'Cortesia',
      categoria: 'CORTESIA',
      totalPdv: totalPdvCortesia,
      qtdPdv: pdvCortesia.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvCortesia,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'CORTESIA_BALCAO',
      descricaoStatus: 'Atendimentos bonificados / cortesias (sem cobrança financeira de adquirente)'
    });
  }

  if (pdvVale.length > 0) {
    totaisPorForma.push({
      id: 'forma_vale',
      formaPgtoNome: 'Vale Presente',
      categoria: 'VALE_PRESENTE',
      totalPdv: totalPdvVale,
      qtdPdv: pdvVale.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvVale,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'SALDO_NAO_INTERMEDIADO',
      descricaoStatus: 'Pagamento via voucher ou vale presente pré-adquirido'
    });
  }

  if (pdvCreditoAnterior.length > 0) {
    totaisPorForma.push({
      id: 'forma_credito_anterior',
      formaPgtoNome: 'Crédito Anterior',
      categoria: 'CREDITO_ANTERIOR',
      totalPdv: totalPdvCreditoAnterior,
      qtdPdv: pdvCreditoAnterior.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvCreditoAnterior,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'SALDO_NAO_INTERMEDIADO',
      descricaoStatus: 'Abatimento de saldo prévio / crédito acumulado do cliente'
    });
  }

  if (pdvOutros.length > 0) {
    totaisPorForma.push({
      id: 'forma_outros',
      formaPgtoNome: 'Outros Pagamentos',
      categoria: 'OUTROS',
      totalPdv: totalPdvOutros,
      qtdPdv: pdvOutros.length,
      totalAdquirenteBruto: 0,
      qtdAdquirente: 0,
      diferencaBruta: totalPdvOutros,
      totalMdrRetido: 0,
      taxaMdrMedia: 0,
      totalAdquirenteLiquido: 0,
      status: 'SALDO_NAO_INTERMEDIADO',
      descricaoStatus: 'Outros lançamentos não intermediados pela adquirente'
    });
  }

  // --- SOMA DOS LOTES DA ADQUIRENTE: CRÉDITO + DÉBITO + PIX ---
  const totalRedeLotesBruto = Number((totalRedeCreditoBruto + totalRedeDebitoBruto + totalRedePixBruto).toFixed(2));
  const totalRedeLotesLiquido = Number((totalRedeCreditoLiquido + totalRedeDebitoLiquido + totalRedePixLiquido).toFixed(2));
  const totalMdrLotes = Number((totalMdrCredito + totalMdrDebito + totalMdrPix).toFixed(2));
  const qtdRedeLotes = redeCredito.length + redeDebito.length + redePix.length;

  const totalPdvLotes = Number((totalPdvCredito + totalPdvDebito + totalPdvPix).toFixed(2));
  const qtdPdvLotes = pdvCredito.length + pdvDebito.length + pdvPix.length;
  const diferencaLotes = Number((totalPdvLotes - totalRedeLotesBruto).toFixed(2));

  const totalLotesAdquirente = {
    totalPdv: totalPdvLotes,
    qtdPdv: qtdPdvLotes,
    totalAdquirenteBruto: totalRedeLotesBruto,
    qtdAdquirente: qtdRedeLotes,
    totalCreditoRede: totalRedeCreditoBruto,
    totalDebitoRede: totalRedeDebitoBruto,
    totalPixRede: totalRedePixBruto,
    diferencaBruta: diferencaLotes,
    totalMdrRetido: totalMdrLotes,
    taxaMdrMedia: formatTaxa(totalMdrLotes, totalRedeLotesBruto),
    totalAdquirenteLiquido: totalRedeLotesLiquido,
    status: Math.abs(diferencaLotes) <= 0.05 ? ('CONCILIADO' as const) : ('DIVERGENTE' as const)
  };

  // Subtotal Cartões (Crédito + Débito)
  const totalPdvCartoes = Number((totalPdvCredito + totalPdvDebito).toFixed(2));
  const qtdPdvCartoes = pdvCredito.length + pdvDebito.length;
  const totalRedeCartoesBruto = Number((totalRedeCreditoBruto + totalRedeDebitoBruto).toFixed(2));
  const qtdRedeCartoes = redeCredito.length + redeDebito.length;
  const diferencaCartoes = Number((totalPdvCartoes - totalRedeCartoesBruto).toFixed(2));
  const mdrCartoes = Number((totalMdrCredito + totalMdrDebito).toFixed(2));
  const liquidoCartoes = Number((totalRedeCreditoLiquido + totalRedeDebitoLiquido).toFixed(2));

  const subtotalCartoes = {
    totalPdv: totalPdvCartoes,
    qtdPdv: qtdPdvCartoes,
    totalAdquirenteBruto: totalRedeCartoesBruto,
    qtdAdquirente: qtdRedeCartoes,
    diferencaBruta: diferencaCartoes,
    totalMdrRetido: mdrCartoes,
    taxaMdrMedia: formatTaxa(mdrCartoes, totalRedeCartoesBruto),
    totalAdquirenteLiquido: liquidoCartoes,
    status: Math.abs(diferencaCartoes) <= 0.05 ? ('CONCILIADO' as const) : ('DIVERGENTE' as const)
  };

  // Saldos Não Intermediados na Adquirente
  const totalCortesiasVales = Number((totalPdvCortesia + totalPdvVale + totalPdvCreditoAnterior + totalPdvOutros).toFixed(2));
  const qtdCortesiasVales = pdvCortesia.length + pdvVale.length + pdvCreditoAnterior.length + pdvOutros.length;
  const totalGeralNaoAdquirente = Number((totalPdvPix * (totalRedePixBruto === 0 ? 1 : 0) + totalPdvDinheiro + totalPdvAssinaturas + totalCortesiasVales).toFixed(2));

  const saldosNaoAdquirenteTotal = {
    totalPixContaBancaria: totalRedePixBruto === 0 ? totalPdvPix : 0,
    qtdPixContaBancaria: totalRedePixBruto === 0 ? pdvPix.length : 0,
    totalDinheiroGaveta: totalPdvDinheiro,
    qtdDinheiroGaveta: pdvDinheiro.length,
    totalAssinaturasClube: totalPdvAssinaturas,
    qtdAssinaturasClube: pdvAssinaturas.length,
    totalCortesiasVales,
    qtdCortesiasVales,
    totalGeralNaoAdquirente
  };

  // TOTAL GERAL: Soma de 100% dos lançamentos do PDV
  const totalPdvGeral = Number(pdvData.reduce((s, p) => s + p.valor, 0).toFixed(2));
  const totalRedeGeralBruto = totalRedeLotesBruto;
  const totalRedeGeralLiquido = totalRedeLotesLiquido;
  const mdrGeral = totalMdrLotes;
  const diferencaGeral = Number((totalPdvGeral - totalRedeGeralBruto).toFixed(2));

  const totalGeral = {
    totalPdv: totalPdvGeral,
    qtdPdv: pdvData.length,
    totalAdquirenteBruto: totalRedeGeralBruto,
    qtdAdquirente: qtdRedeLotes,
    totalCreditoRede: totalRedeCreditoBruto,
    totalDebitoRede: totalRedeDebitoBruto,
    totalPixRede: totalRedePixBruto,
    diferencaBruta: diferencaGeral,
    totalMdrRetido: mdrGeral,
    totalAdquirenteLiquido: totalRedeGeralLiquido
  };

  return { totaisPorForma, subtotalCartoes, totalLotesAdquirente, totalGeral, saldosNaoAdquirenteTotal };
}

// Gerador de dados de demonstração completos da Barbearia Vangard Ltda (Agosto de 2026)
export function getBarbeariaDemoData() {
  // Gera uma distribuição realista para todo o mês de Agosto de 2026 (01/08/2026 a 31/08/2026)
  // Totalizando o volume real observado: ~R$ 56.574,20 Crédito, ~R$ 25.017,40 Débito, ~R$ 18.859,30 Pix, R$ 4.340,20 Dinheiro
  const pdv: PDVMovimentacao[] = [];
  const redePagamentos: AdquirenteRedePagamento[] = [];
  const clube: GatewayClubeTransacao[] = [];
  const previsao: PrevisaoRecebivel[] = [];

  const clientesNomes = [
    'Nelson Rodrigues', 'Leonardo da Silva', 'Cliente Avulso', 'Gabriel Gurgel', 'Pedro Mendes',
    'Jose Sales', 'Vanessa de Oliveira', 'Antonio Lucas', 'Renato Barbosa', 'Henrique Carneiro',
    'Thiago Callou', 'Francisco Reinaldo', 'Enzo Jesus', 'Antonio Ducci', 'Alvaro Leonel',
    'Cristiano Alves', 'Vinicius Fernandes', 'Carlos Anderson', 'Fabio Nascimento', 'Xandinho',
    'Fransergio Tavares', 'Rafael Sousa', 'Mateus Souto', 'Wagner Faquei', 'Alan Fernandes',
    'Cassio Fagundes', 'Emanuel Pinheiro', 'Junior Moreira', 'Joel Soares', 'Pedro Augusto',
    'Italo Teofilo', 'Eduardo Lopes', 'Caio Moreira', 'Zania Thayse', 'Pedro Maia',
    'Darlan Almeida', 'Arthur Lobo', 'Gabriel Muniz', 'Marcio Rodrigues', 'Vladimir Vidal',
    'Geilson Silva', 'Kaio Feitosa', 'Raphael Bandeira', 'Daniel Felinto', 'Marcos Tulio',
    'Edleno Costa', 'Agenor Paulino', 'Felipe Uchoa', 'Astley Costa', 'Rodolfo Hoton'
  ];

  // Distribuir vendas ao longo dos 31 dias de Agosto de 2026
  let pdvIdCounter = 1;
  let redeIdCounter = 1;

  for (let dia = 1; dia <= 31; dia++) {
    const diaStr = String(dia).padStart(2, '0');
    const dataDia = `2026-08-${diaStr}`;

    // Volume diário médio para atingir os totais
    // Crédito: ~R$ 1.825/dia (média de 20 vendas)
    // Débito: ~R$ 807/dia (média de 9-10 vendas)
    // Pix: ~R$ 608/dia (média de 7 vendas)
    // Dinheiro: ~R$ 140/dia (média de 1-2 vendas)
    // Assinaturas: ~19 atendimentos/dia

    // 1. Crédito no dia
    const qtdCreditoDia = dia % 7 === 0 || dia % 7 === 6 ? 28 : 18; // fins de semana têm mais movimento
    let totalCreditoDia = 0;
    for (let c = 0; c < qtdCreditoDia; c++) {
      const valor = [70, 80, 120, 140, 60, 95, 126, 160, 210][(dia * 3 + c) % 9];
      totalCreditoDia += valor;
      const cliente = clientesNomes[(dia + c) % clientesNomes.length];
      pdv.push({
        id: `pdv_${pdvIdCounter++}`,
        cliente,
        telefone: '(85) 98800-0000',
        formaPgto: 'Cartão de crédito',
        valor,
        data: `${diaStr}/08/2026 14:${String((c * 3) % 60).padStart(2, '0')}`,
        dataDia,
        isAssinaturaClube: false
      });

      // No dia 28/08, simula 1 venda não capturada na Rede para auditoria
      if (dia === 28 && c === 0) {
        continue; // Não entra na Rede (Falta na Rede R$ 70)
      }

      // Adiciona na Rede com taxa MDR de 2.39%
      const taxa = 2.39;
      const mdr = Number(((valor * taxa) / 100).toFixed(2));
      redePagamentos.push({
        id: `rede_${redeIdCounter++}`,
        dataRecebimento: addDays(dataDia, 30),
        dataVenda: dataDia,
        valorBruto: valor,
        taxaMdrPerc: taxa,
        valorMdr: mdr,
        valorLiquido: Number((valor - mdr).toFixed(2)),
        tid: `TID-${diaStr}${c}`,
        nsuCv: `NSU${diaStr}0${c}`,
        numAutorizacao: `AUT${diaStr}${c}`,
        modalidade: 'CREDITO',
        bandeira: c % 2 === 0 ? 'MASTERCARD' : 'VISA',
        status: 'LIQUIDADO'
      });
    }

    // 2. Débito no dia
    const qtdDebitoDia = dia % 7 === 0 || dia % 7 === 6 ? 14 : 8;
    for (let d = 0; d < qtdDebitoDia; d++) {
      const valor = [60, 70, 75, 80, 105, 120, 145][(dia * 2 + d) % 7];
      const cliente = clientesNomes[(dia + d + 5) % clientesNomes.length];
      pdv.push({
        id: `pdv_${pdvIdCounter++}`,
        cliente,
        telefone: '(85) 98800-0000',
        formaPgto: 'Cartão de débito',
        valor,
        data: `${diaStr}/08/2026 11:${String((d * 5) % 60).padStart(2, '0')}`,
        dataDia,
        isAssinaturaClube: false
      });

      // No dia 15/08, simula 1 transação a mais na Rede (Sobra na Rede)
      const taxa = 1.19;
      const mdr = Number(((valor * taxa) / 100).toFixed(2));
      redePagamentos.push({
        id: `rede_${redeIdCounter++}`,
        dataRecebimento: addDays(dataDia, 1),
        dataVenda: dataDia,
        valorBruto: valor,
        taxaMdrPerc: taxa,
        valorMdr: mdr,
        valorLiquido: Number((valor - mdr).toFixed(2)),
        tid: `TID-D-${diaStr}${d}`,
        nsuCv: `NSU-D${diaStr}${d}`,
        numAutorizacao: `AUT-D${diaStr}${d}`,
        modalidade: 'DEBITO',
        bandeira: 'VISA',
        status: 'LIQUIDADO'
      });
    }

    // 3. Pix no dia (Pix cai direto na conta bancária, saldo não intermediado)
    const qtdPixDia = 7;
    for (let p = 0; p < qtdPixDia; p++) {
      const valor = [60, 70, 75, 80, 95, 120, 140, 150][(dia + p) % 8];
      const cliente = clientesNomes[(dia + p + 10) % clientesNomes.length];
      pdv.push({
        id: `pdv_${pdvIdCounter++}`,
        cliente,
        telefone: '(85) 98800-0000',
        formaPgto: 'Pix',
        valor,
        data: `${diaStr}/08/2026 16:${String((p * 7) % 60).padStart(2, '0')}`,
        dataDia,
        isAssinaturaClube: false
      });
    }

    // 4. Dinheiro no dia
    if (dia % 2 === 0) {
      pdv.push({
        id: `pdv_${pdvIdCounter++}`,
        cliente: clientesNomes[dia % clientesNomes.length],
        telefone: '(85) 98800-0000',
        formaPgto: 'Dinheiro',
        valor: 70,
        data: `${diaStr}/08/2026 18:00`,
        dataDia,
        isAssinaturaClube: false
      });
    }

    // 5. Assinaturas do Clube (Balcão)
    for (let a = 0; a < 19; a++) {
      pdv.push({
        id: `pdv_${pdvIdCounter++}`,
        cliente: clientesNomes[(dia + a) % clientesNomes.length],
        telefone: '(85) 98800-0000',
        formaPgto: 'Assinatura',
        valor: 0,
        data: `${diaStr}/08/2026 10:${String((a * 3) % 60).padStart(2, '0')}`,
        dataDia,
        isAssinaturaClube: true
      });
    }
  }

  // Gateway e Previsão D+31 para simulação de Clube
  clube.push(
    { id: 'clube_1', codigo: 'VANG-AGO-01', nomeCliente: 'Mateus Souto', plano: 'Vans Club Gold', vencimento: '2026-08-10', valor: 149.90, status: 'PAGO', dataStatusAtual: '2026-08-10', codigoAprovacao: 'AP-9812', tid: 'TID-CLUBE-9812', descricaoStatus: 'Autorizado' },
    { id: 'clube_2', codigo: 'VANG-AGO-02', nomeCliente: 'Enzo Jesus', plano: 'Vans Club Silver', vencimento: '2026-08-15', valor: 99.90, status: 'PAGO', dataStatusAtual: '2026-08-15', codigoAprovacao: 'AP-9813', tid: 'TID-CLUBE-9813', descricaoStatus: 'Autorizado' },
    { id: 'clube_3', codigo: 'VANG-AGO-03', nomeCliente: 'Walisson Albuquerque', plano: 'Vans Club Platinum', vencimento: '2026-08-20', valor: 199.90, status: 'RECUSADO', dataStatusAtual: '2026-08-20', codigoAprovacao: '', tid: 'TID-CLUBE-9814', descricaoStatus: 'Cartão recusado' }
  );

  previsao.push(
    { id: 'prev_1', aReceber: 'Sim', dataVenda: '2026-08-10', parcela: '1/1', transacao: 'VANG-AGO-01', tid: 'TID-CLUBE-9812', operacao: 'Crédito Recorrente', bandeira: 'Mastercard', valorBruto: 149.90, mdrTaxaPerc: 2.49, mdrValor: 3.73, antecipacao: 0, valorLiquido: 146.17, statusTransacao: 'Previsto', dMais31: '2026-09-10' },
    { id: 'prev_2', aReceber: 'Sim', dataVenda: '2026-08-15', parcela: '1/1', transacao: 'VANG-AGO-02', tid: 'TID-CLUBE-9813', operacao: 'Crédito Recorrente', bandeira: 'Visa', valorBruto: 99.90, mdrTaxaPerc: 2.49, mdrValor: 2.49, antecipacao: 0, valorLiquido: 97.41, statusTransacao: 'Previsto', dMais31: '2026-09-15' }
  );

  const redeRecebidos: AdquirenteRedeRecebido[] = [];

  return { pdv, clube, redePagamentos, redeRecebidos, previsao };
}

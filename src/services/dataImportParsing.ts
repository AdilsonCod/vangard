export type DataImportType =
  | 'SERVICOS' | 'PRODUTOS' | 'UNIDADE' | 'UNIDADE_ITENS' | 'UNIDADE_SERVICOS'
  | 'UNIDADE_PRODUTOS' | 'CATALOGO' | 'DPOTE_PDF' | 'CASHBARBER_PRODUTOS'
  | 'RELATORIO_09' | 'RELATORIO_17' | 'RELATORIO_33';

export function detectImportTypeFromFilename(filename: string): DataImportType | null {
  const name = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('matriz ass')) return 'DPOTE_PDF';
  if (name.includes('produtos barbeiros')) return 'CASHBARBER_PRODUTOS';
  if (name.includes('servicos barbeiros')) return 'SERVICOS';
  if (name.includes('servicos realizados')) return 'UNIDADE_SERVICOS';
  if (name.includes('relatorio produtos')) return 'UNIDADE_PRODUTOS';
  if (/relatorio\s*09/.test(name)) return 'RELATORIO_09';
  if (/relatorio\s*17/.test(name)) return 'RELATORIO_17';
  if (/relatorio\s*33/.test(name)) return 'RELATORIO_33';
  return null;
}

export function parseImportCurrency(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let cleaned = String(value).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith('-');
  cleaned = cleaned.replace(/[()\-+]/g, '').replace(/[^\d.,]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    cleaned = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    const parts = cleaned.split('.');
    const decimal = parts.at(-1)?.length === 2 ? `.${parts.pop()}` : '';
    cleaned = `${parts.join('')}${decimal}`;
  } else if (lastDot >= 0 && cleaned.length - lastDot - 1 === 3) {
    cleaned = cleaned.replace('.', '');
  }
  const parsed = Number.parseFloat(cleaned) || 0;
  return negative ? -parsed : parsed;
}

export function parseImportWholeNumber(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  return Number.parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10) || 0;
}

const headerKeywords = [
  'profissional', 'barbeiro', 'funcionario', 'colaborador', 'servico', 'produto',
  'item', 'descricao', 'quantidade', 'qtd', 'valor', 'total', 'comissao', 'unidade',
  'filial', 'loja', 'categoria', 'cliente',
];

export function findImportHeaderIndex(matrix: unknown[][]): number {
  let headerIndex = 0;
  let bestScore = -1;
  matrix.slice(0, 30).forEach((row, index) => {
    const values = row.map(cell => String(cell ?? '').trim()).filter(Boolean);
    if (values.length < 2) return;
    const normalized = values.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const score = headerKeywords.filter(keyword => normalized.includes(keyword)).length * 10 + values.length;
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });
  return headerIndex;
}

export async function createImportFingerprint(value: ArrayBuffer | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const MESSAGE_CONTACT_IMPORT_EXTENSIONS = ['csv', 'xlsx', 'xls', 'ods'] as const;
export const MESSAGE_CONTACT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export type MessageContactMapping = {
  name: string;
  phone: string;
  origin: string;
  consentAt: string;
  evidence: string;
  variableColumns: string[];
};

export type ImportedMessageContact = {
  name: string;
  phone: string;
  origin: string;
  consentAt: string;
  evidence: string;
  variables: Record<string, string>;
  sourceRow: number;
};

const value = (row: Record<string, unknown>, column: string) => column ? String(row[column] ?? '').trim() : '';

export function normalizeImportedPhone(input: unknown) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? digits : '';
}

export function validateMessageContactFile(file: { name: string; size: number }) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!MESSAGE_CONTACT_IMPORT_EXTENSIONS.includes(extension as typeof MESSAGE_CONTACT_IMPORT_EXTENSIONS[number])) throw new Error('Formato não suportado. Use CSV, XLSX, XLS ou ODS.');
  if (file.size <= 0) throw new Error('O arquivo selecionado está vazio.');
  if (file.size > MESSAGE_CONTACT_IMPORT_MAX_BYTES) throw new Error('O arquivo excede o limite de 10 MB.');
  return extension;
}

export function validateMessageContactContent(extension: string, content: ArrayBuffer | Uint8Array) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  if (!bytes.length) throw new Error('O arquivo selecionado está vazio.');
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isCompoundFile = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);
  if ((extension === 'xlsx' || extension === 'ods') && !isZip) throw new Error(`O arquivo ${extension.toUpperCase()} está malformado ou corrompido.`);
  if (extension === 'xls' && !isCompoundFile) throw new Error('O arquivo XLS está malformado ou corrompido.');
  return true;
}

export function detectMessageContactMapping(columns: string[]): MessageContactMapping {
  const pick = (patterns: RegExp[]) => columns.find(column => patterns.some(pattern => pattern.test(column))) || '';
  return {
    name: pick([/^nome$/i, /cliente/i, /contato/i]),
    phone: pick([/telefone/i, /celular/i, /whats/i, /n[uú]mero/i]),
    origin: pick([/origem/i, /fonte/i]),
    consentAt: pick([/data.*opt/i, /data.*consent/i, /aceite/i]),
    evidence: pick([/evid/i, /comprov/i, /observ/i]),
    variableColumns: [],
  };
}

export function mapMessageContactRows(rows: Record<string, unknown>[], mapping: MessageContactMapping) {
  if (!mapping.phone) throw new Error('Selecione a coluna que contém o telefone.');
  const seen = new Set<string>();
  const contacts: ImportedMessageContact[] = [];
  const invalid: { row: number; value: string }[] = [];
  const duplicates: { row: number; phone: string }[] = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const rawPhone = value(row, mapping.phone);
    const phone = normalizeImportedPhone(rawPhone);
    if (!phone) { invalid.push({ row: sourceRow, value: rawPhone }); return; }
    if (seen.has(phone)) { duplicates.push({ row: sourceRow, phone }); return; }
    seen.add(phone);
    const variables = Object.fromEntries(mapping.variableColumns.filter(Boolean).map(column => [column, value(row, column)]));
    contacts.push({ name: value(row, mapping.name), phone, origin: value(row, mapping.origin), consentAt: value(row, mapping.consentAt), evidence: value(row, mapping.evidence), variables, sourceRow });
  });
  return { contacts, invalid, duplicates, totalRows: rows.length };
}

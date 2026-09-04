import { strFromU8, unzipSync } from 'fflate';
import type { CellObject, WorkBook, WorkSheet } from 'xlsx';

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readAttribute(attributes: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = attributes.match(new RegExp(`(?:^|\\s)${escapedName}=(?:"([^"]*)"|'([^']*)')`));
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : decodeXmlText(value);
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const sharedItemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;

  for (const itemMatch of xml.matchAll(sharedItemPattern)) {
    const textParts = [...itemMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)];
    strings.push(textParts.map(part => decodeXmlText(part[1])).join(''));
  }

  return strings;
}

function resolveWorkbookTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);

  const parts = `xl/${target.replace(/\\/g, '/')}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function hydrateWorksheet(
  worksheet: WorkSheet,
  worksheetXml: string,
  sharedStrings: string[]
): number {
  let hydrated = 0;

  for (const cellMatch of worksheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
    const attributes = cellMatch[1];
    if (readAttribute(attributes, 't') !== 's') continue;

    const address = readAttribute(attributes, 'r');
    const valueIndexMatch = cellMatch[2].match(/<v\b[^>]*>(\d+)<\/v>/i);
    if (!address || !valueIndexMatch) continue;

    const value = sharedStrings[Number(valueIndexMatch[1])];
    if (value === undefined) continue;

    const currentCell = worksheet[address] as CellObject | undefined;
    worksheet[address] = {
      ...currentCell,
      t: 's',
      v: value,
      w: value
    };
    hydrated += 1;
  }

  return hydrated;
}

/**
 * Reidrata células de texto compartilhado em relatórios XLSX que omitem os
 * atributos count/uniqueCount do sharedStrings.xml. Algumas versões da Rede
 * geram esse OOXML válido, mas o SheetJS deixa o valor dessas células vazio.
 */
export function hydrateXlsxSharedStrings(workbook: WorkBook, bytes: Uint8Array): number {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return 0;
  }

  const sharedStringsFile = files['xl/sharedStrings.xml'];
  const workbookFile = files['xl/workbook.xml'];
  const relationshipsFile = files['xl/_rels/workbook.xml.rels'];
  if (!sharedStringsFile || !workbookFile || !relationshipsFile) return 0;

  const sharedStrings = parseSharedStrings(strFromU8(sharedStringsFile));
  if (sharedStrings.length === 0) return 0;

  const relationshipTargets = new Map<string, string>();
  const relationshipsXml = strFromU8(relationshipsFile);
  for (const relationship of relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const id = readAttribute(relationship[1], 'Id');
    const target = readAttribute(relationship[1], 'Target');
    if (id && target) relationshipTargets.set(id, resolveWorkbookTarget(target));
  }

  let hydrated = 0;
  const workbookXml = strFromU8(workbookFile);
  for (const sheetMatch of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)) {
    const sheetName = readAttribute(sheetMatch[1], 'name');
    const relationshipId = readAttribute(sheetMatch[1], 'r:id');
    const target = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    const worksheetFile = target ? files[target] : undefined;
    if (!worksheet || !worksheetFile) continue;

    hydrated += hydrateWorksheet(worksheet, strFromU8(worksheetFile), sharedStrings);
  }

  return hydrated;
}

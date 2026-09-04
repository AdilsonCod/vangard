import * as XLSX from "xlsx";
import Papa from "papaparse";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

if (typeof pdfjsWorker === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface DPoteBarberData {
  name: string;
  commission: number;
  potPercentage: number;
  totalServices: number;
  totalTokens: number;
  services: { name: string; quantity: number; tokens: number }[];
}

export interface DPoteReport {
  totalAssinaturas: number;
  barbers: DPoteBarberData[];
}

export async function parseDPotePDF(file: File): Promise<DPoteReport> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  type PdfRow = { page: number; y: number; items: { x: number; text: string }[]; text: string };
  const rows: PdfRow[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageRows: { y: number; items: { x: number; text: string }[] }[] = [];

    for (const item of textContent.items as any[]) {
      const text = String(item.str || '').trim();
      if (!text) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      let row = pageRows.find(candidate => Math.abs(candidate.y - y) <= 3);
      if (!row) {
        row = { y, items: [] };
        pageRows.push(row);
      }
      row.items.push({ x, text });
    }

    pageRows
      .sort((a, b) => b.y - a.y)
      .forEach(row => {
        row.items.sort((a, b) => a.x - b.x);
        rows.push({
          page: pageNum,
          y: row.y,
          items: row.items,
          text: row.items.map(item => item.text).join(' '),
        });
      });
  }

  const parseCurrency = (value: string) =>
    Number.parseFloat(value.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.')) || 0;
  const parsePercentage = (value: string) =>
    Number.parseFloat(value.replace('%', '').replace(',', '.')) || 0;

  let totalAssinaturas = 0;
  const barbers: DPoteBarberData[] = [];
  let currentBarber: DPoteBarberData | null = null;

  rows.forEach((row, index) => {
    const normalized = row.text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    if (normalized.includes('valor total das assinaturas')) {
      const currency = row.text.match(/R\$\s*[\d.,]+/i);
      if (currency) totalAssinaturas = parseCurrency(currency[0]);
      return;
    }

    if (normalized.includes('comissao total')) {
      const previousRow = rows[index - 1];
      const name = previousRow?.items.find(item => item.x < 250)?.text.trim() || '';
      const currency = row.text.match(/R\$\s*[\d.,]+/i);
      const percentage = row.text.match(/\(([\d.,]+)%\)/);
      if (name && currency && percentage) {
        currentBarber = {
          name,
          commission: parseCurrency(currency[0]),
          potPercentage: parsePercentage(percentage[1]),
          totalServices: 0,
          totalTokens: 0,
          services: [],
        };
        barbers.push(currentBarber);
      }
      return;
    }

    if (currentBarber && row.items[0]?.text.startsWith('- ')) {
      const numericValues = row.items
        .filter(item => item.x > 450 && /^\d+$/.test(item.text))
        .map(item => Number.parseInt(item.text, 10));
      if (numericValues.length >= 2) {
        currentBarber.services.push({
          name: row.items[0].text.replace(/^-\s*/, '').trim(),
          quantity: numericValues[0],
          tokens: numericValues[1],
        });
      }
    }
  });

  barbers.forEach(barber => {
    barber.totalServices = barber.services.reduce((sum, service) => sum + service.quantity, 0);
    barber.totalTokens = barber.services.reduce((sum, service) => sum + service.tokens, 0);
  });

  return {
    totalAssinaturas,
    barbers: barbers.filter(barber => barber.commission > 0 && barber.potPercentage > 0),
  };
}

export function extractDPoteFrom2DArray(rows: any[][]): DPoteReport {
  let totalAssinaturas = 0;
  const barbersMap = new Map<string, DPoteBarberData>();

  let currentSection = "";

  const parseCurrency = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.'));
  };

  const parsePercentage = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') {
      if (val < 1 && val > 0) return val * 100;
      return val;
    }
    const match = String(val).match(/([\d,]+)%?/);
    if (match) return parseFloat(match[1].replace(',', '.'));
    return 0;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || "").trim();

    if (firstCell.startsWith("INFORMAÇÕES GERAIS")) {
      currentSection = "GERAL";
      continue;
    } else if (firstCell.startsWith("RESUMO POR PROFISSIONAL")) {
      currentSection = "RESUMO";
      continue;
    } else if (firstCell.startsWith("DETALHAMENTO DE SERVIÇOS")) {
      currentSection = "DETALHAMENTO";
      continue;
    }

    if (currentSection === "GERAL") {
      if (firstCell === "Valor total das assinaturas") {
        totalAssinaturas = parseCurrency(row[1]);
      }
    } else if (currentSection === "RESUMO") {
      if (firstCell === "Profissional" || firstCell === "TOTAL" || !firstCell) continue;
      const name = firstCell;
      const totalServices = parseInt(String(row[1]).replace(/\D/g, '')) || 0;
      const totalTokens = parseInt(String(row[2]).replace(/\D/g, '')) || 0;
      const potPerc = parsePercentage(row[3]);
      const commission = parseCurrency(row[4]);

      barbersMap.set(name, {
        name,
        commission,
        potPercentage: potPerc,
        totalServices,
        totalTokens,
        services: []
      });
    } else if (currentSection === "DETALHAMENTO") {
      if (firstCell === "Profissional" || firstCell === "TOTAL" || !firstCell) continue;
      const name = firstCell;
      const serviceName = String(row[1] || "").trim();
      const quantity = parseInt(row[2]) || 0;
      const tokens = parseInt(row[3]) || 0;

      if (serviceName.toLowerCase() === "total" || !serviceName) continue;

      if (barbersMap.has(name)) {
        barbersMap.get(name)!.services.push({
          name: serviceName,
          quantity,
          tokens
        });
      }
    }
  }

  return {
    totalAssinaturas,
    barbers: Array.from(barbersMap.values()).filter(b => b.commission > 0)
  };
}

export async function parseDPoteSpreadsheet(file: File): Promise<DPoteReport> {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            resolve(extractDPoteFrom2DArray(results.data as string[][]));
          } catch (e) { reject(e); }
        },
        error: reject
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          resolve(extractDPoteFrom2DArray(json));
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}

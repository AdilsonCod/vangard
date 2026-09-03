import * as XLSX from "xlsx";
import Papa from "papaparse";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
  
  let allLines: { y: number; text: string; x: number }[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group by Y coordinate
    const items = textContent.items as any[];
    
    // Round Y to nearest integer
    items.forEach(item => {
      if (item.str.trim() !== '') {
        allLines.push({
          y: Math.round(item.transform[5]),
          x: Math.round(item.transform[4]),
          text: item.str.trim()
        });
      }
    });
  }

  allLines.sort((a, b) => b.y - a.y || a.x - b.x);

  const groupedLines: { y: number; items: {x: number, text: string}[] }[] = [];
  let currentY = -1000;
  
  for (const item of allLines) {
    if (Math.abs(item.y - currentY) > 3) {
      currentY = item.y;
      groupedLines.push({ y: currentY, items: [] });
    }
    groupedLines[groupedLines.length - 1].items.push(item);
  }

  groupedLines.forEach(line => {
    line.items.sort((a, b) => a.x - b.x);
  });

  const lines = groupedLines.map(line => line.items.map(i => i.text).join('   '));
  
  let totalAssinaturas = 0;
  const barbers: DPoteBarberData[] = [];
  let currentBarber: DPoteBarberData | null = null;
  
  const parseCurrency = (str: string) => {
    return parseFloat(str.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.'));
  };

  const parsePercentage = (str: string) => {
    const match = str.match(/([\d,]+)%/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return 0;
  };

  // Keep track of the raw text order too, just in case
  const rawTextOrder = allLines.sort((a, b) => a.y === b.y ? a.x - b.x : b.y - a.y).map(i => i.text);

  // Let's iterate raw lines grouped by Y for better heuristics
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.toLowerCase().includes('valor total das assinaturas')) {
      const match = line.match(/R\$\s*[\d\.,]+/);
      if (match) {
        totalAssinaturas = parseCurrency(match[0]);
      } else {
        // The value might be on the same Y but grouped incorrectly, or on the next line
        if (i + 1 < lines.length && lines[i+1].includes('R$')) {
           const nextMatch = lines[i+1].match(/R\$\s*[\d\.,]+/);
           if (nextMatch) totalAssinaturas = parseCurrency(nextMatch[0]);
        }
      }
    }
    
    if (line.toLowerCase().includes('comissão total')) {
      // Find name. Usually it's the line immediately preceding "Comissão total"
      // Wait, in the OCR it shows: "Denis Lima Santiago" then "Comissão total"
      let name = i > 0 ? lines[i-1].trim() : 'Desconhecido';
      // clean name if it has other stuff
      
      const valMatch = line.match(/R\$\s*[\d\.,]+/);
      const percMatch = line.match(/\(([\d,]+)%\)/);
      
      if (valMatch && percMatch) {
         currentBarber = {
           name: name,
           commission: parseCurrency(valMatch[0]),
           potPercentage: parsePercentage(percMatch[1]),
           totalServices: 0,
           totalTokens: 0,
           services: []
         };
         barbers.push(currentBarber);
      } else if (i + 1 < lines.length) {
         // Sometimes the value is on the next line
         const nextLine = lines[i+1];
         const nValMatch = nextLine.match(/R\$\s*[\d\.,]+/);
         const nPercMatch = nextLine.match(/\(([\d,]+)%\)/);
         if (nValMatch && nPercMatch) {
           currentBarber = {
             name: name,
             commission: parseCurrency(nValMatch[0]),
             potPercentage: parsePercentage(nPercMatch[1]),
             totalServices: 0,
             totalTokens: 0,
             services: []
           };
           barbers.push(currentBarber);
         }
      }
    }
    
    if (currentBarber && line.startsWith('- ')) {
       const parts = line.split('   ').map(p => p.trim()).filter(p => p);
       if (parts.length >= 3) {
         currentBarber.services.push({
           name: parts[0].substring(2).trim(),
           quantity: parseInt(parts[1]) || 0,
           tokens: parseInt(parts[2]) || 0
         });
       } else {
         const match = line.match(/- (.+?)\s+(\d+)\s+(\d+)$/);
         if (match) {
           currentBarber.services.push({
             name: match[1].trim(),
             quantity: parseInt(match[2]) || 0,
             tokens: parseInt(match[3]) || 0
           });
         }
       }
    }
  }

  // Fallback for parsing totalAssinaturas if Y grouping failed
  if (totalAssinaturas === 0) {
     for (let i = 0; i < rawTextOrder.length; i++) {
        if (rawTextOrder[i].toLowerCase() === 'valor total das assinaturas') {
           // Look ahead for currency
           for(let j = i+1; j < Math.min(i+5, rawTextOrder.length); j++) {
              if (rawTextOrder[j].startsWith('R$')) {
                 totalAssinaturas = parseCurrency(rawTextOrder[j]);
                 break;
              }
           }
        }
     }
  }

  // Fallback for barbers if Y grouping failed
  if (barbers.length === 0) {
     for (let i = 0; i < rawTextOrder.length; i++) {
        if (rawTextOrder[i].toLowerCase() === 'comissão total') {
           let name = rawTextOrder[i-1] || 'Desconhecido';
           let commission = 0;
           let perc = 0;
           for(let j = i+1; j < Math.min(i+5, rawTextOrder.length); j++) {
              if (rawTextOrder[j].startsWith('R$')) {
                 commission = parseCurrency(rawTextOrder[j]);
                 const pMatch = rawTextOrder[j].match(/\(([\d,]+)%\)/);
                 if (pMatch) perc = parsePercentage(pMatch[1]);
                 break;
              }
           }
           if (commission > 0) {
              currentBarber = { name, commission, potPercentage: perc, totalServices: 0, totalTokens: 0, services: [] };
              barbers.push(currentBarber);
           }
        } else if (rawTextOrder[i].startsWith('- ') && currentBarber) {
           // services in raw text order might be: "- Corte", "28", "1120"
           let sName = rawTextOrder[i].substring(2).trim();
           let qty = parseInt(rawTextOrder[i+1]) || 0;
           let tokens = parseInt(rawTextOrder[i+2]) || 0;
           if (qty > 0 || tokens > 0) {
              currentBarber.services.push({ name: sName, quantity: qty, tokens });
           }
        }
     }
  }

  barbers.forEach(b => {
    if (b.totalServices === 0) {
      b.totalServices = b.services.reduce((acc, s) => acc + s.quantity, 0);
    }
    if (b.totalTokens === 0) {
      b.totalTokens = b.services.reduce((acc, s) => acc + s.tokens, 0);
    }
  });
  const validBarbers = barbers.filter(b => b.commission > 0 && b.potPercentage > 0);
  return { totalAssinaturas, barbers: validBarbers };
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

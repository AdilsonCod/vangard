import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
if (typeof pdfjsWorker === 'string') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface CashbarberProductReport {
  barbers: {
    name: string;
    totalProducts: number; // Qtd total
    totalSales: number; // Valor das vendas
    totalCommission: number; // Comissão total
    commissionProdGeral: number; // Comissão Cosméticos
    commissionProdAvant: number; // Comissão Cosméticos Avant
  }[];
}

export async function parseCashbarberProductsPDF(file: File): Promise<CashbarberProductReport> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let allItems: {text: string, x: number, y: number, page: number}[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    for (const item of items) {
      if (item.str.trim() !== "") {
        allItems.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
          page: pageNum
        });
      }
    }
  }

  // 1. Find Header X coordinates
  let xProf = -1, xCat = -1, xQtd = -1, xVendido = -1, xComissao = -1;
  for (const item of allItems) {
    const t = item.text.toLowerCase();
    if (t === "profissional" && item.x > 120) xProf = item.x;
    if (t === "categoria") xCat = item.x;
    if (t === "quantidade" || t === "qtd") xQtd = item.x;
    if (t === "vendido" || t === "total vendido") xVendido = item.x;
    if (t === "comissão" || t === "comissao") xComissao = item.x;
  }

  // Fallbacks just in case headers are slightly offset or named differently
  if (xProf === -1) xProf = 150;
  if (xCat === -1) xCat = 280;
  if (xQtd === -1) xQtd = 380;
  if (xVendido === -1) xVendido = 650;
  if (xComissao === -1) xComissao = 750;

  // Helper to extract and group a column
  function extractColumn(items: any[], xCenter: number, width: number) {
    const colItems = items.filter(i => Math.abs(i.x - xCenter) < width);
    colItems.sort((a, b) => b.y - a.y);
    const groups: {items: any[], y: number}[] = [];
    for (const item of colItems) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last.y - item.y) < 12) {
        last.items.push(item);
        last.y = last.items.reduce((s, i) => s + i.y, 0) / last.items.length;
      } else {
        groups.push({ items: [item], y: item.y });
      }
    }
    return groups.map(g => {
      g.items.sort((a, b) => a.x - b.x);
      return {
        text: g.items.map((i: any) => i.text).join(" ").trim(),
        y: g.y
      };
    });
  }

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    const str = val.replace(/R\$/g, '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
  };

  const parseQtd = (val: string) => {
    if (!val) return 0;
    return parseInt(val.trim(), 10) || 0;
  };

  const barbersMap = new Map<string, { totalProducts: number, totalSales: number, totalCommission: number, commissionProdGeral: number, commissionProdAvant: number }>();
  let globalLastPro = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pageItems = allItems.filter(i => i.page === pageNum);
    
    const rawPros = extractColumn(pageItems, xProf, 40).filter(p => {
      const t = p.text.toLowerCase();
      return t !== "profissional" && t !== "total geral" && p.text.length > 2;
    });
    const pros: { text: string; y: number }[] = [];
    for (const candidate of rawPros) {
      const previous = pros[pros.length - 1];
      if (previous && Math.abs(previous.y - candidate.y) < 25) {
        previous.text = `${previous.text} ${candidate.text}`.trim();
        previous.y = (previous.y + candidate.y) / 2;
      } else {
        pros.push({ ...candidate });
      }
    }
    const cats = extractColumn(pageItems, xCat, 50).filter(c => {
      const t = c.text.toLowerCase();
      return t !== "categoria" && c.text.length > 2;
    });
    const qtds = extractColumn(pageItems, xQtd, 30).filter(q => {
      return /\d/.test(q.text) && q.text.toLowerCase() !== "quantidade" && q.text.toLowerCase() !== "qtd";
    });
    const vendidos = extractColumn(pageItems, xVendido, 40).filter(v => {
      return v.text.toLowerCase() !== "vendido" && v.text.toLowerCase() !== "total vendido" && /\d/.test(v.text);
    });
    const comissoes = extractColumn(pageItems, xComissao, 40).filter(c => {
      return !c.text.toLowerCase().includes("comiss") && /\d/.test(c.text);
    });

    // Pair vendidos and comissoes
    const rows: {y: number, vendido: number, comissao: number}[] = [];
    for (const v of vendidos) {
      let closestC = null;
      let minD = Infinity;
      for (const c of comissoes) {
        const d = Math.abs(c.y - v.y);
        if (d < minD) {
          minD = d;
          closestC = c;
        }
      }
      if (closestC && minD < 15) {
        rows.push({
          y: (v.y + closestC.y) / 2,
          vendido: parseCurrency(v.text),
          comissao: parseCurrency(closestC.text)
        });
      }
    }

    // Process each Category Row
    for (const row of rows) {
      let closestCat = null;
      let minDCat = Infinity;
      for (const c of cats) {
        const d = Math.abs(c.y - row.y);
        if (d < minDCat) {
          minDCat = d;
          closestCat = c;
        }
      }
      
      const catName = closestCat ? closestCat.text.toLowerCase() : "";
      if (catName.includes("bebida") || catName.includes("cerveja") || catName.includes("agua") || catName.includes("água") || catName.includes("refrigerante")) {
        continue;
      }

      let closestPro = null;
      let minDPro = Infinity;
      for (const p of pros) {
        const d = Math.abs(p.y - row.y);
        if (d < minDPro) {
          minDPro = d;
          closestPro = p;
        }
      }

      let proName = globalLastPro;
      if (closestPro && minDPro < 150) { 
        proName = closestPro.text;
        globalLastPro = proName;
      }

      if (!proName) continue;

      let totalQtd = 0;
      for (const q of qtds) {
        let closestRow = null;
        let minDRow = Infinity;
        for (const r of rows) {
          const d = Math.abs(q.y - r.y);
          if (d < minDRow) {
            minDRow = d;
            closestRow = r;
          }
        }
        if (closestRow === row) {
          totalQtd += parseQtd(q.text);
        }
      }

      if (!barbersMap.has(proName)) {
        barbersMap.set(proName, { totalProducts: 0, totalSales: 0, totalCommission: 0, commissionProdGeral: 0, commissionProdAvant: 0 });
      }
      const b = barbersMap.get(proName)!;
      b.totalProducts += totalQtd;
      b.totalSales += row.vendido;
      b.totalCommission += row.comissao;
      
      if (catName.includes("avant")) {
        b.commissionProdAvant += row.comissao;
      } else {
        b.commissionProdGeral += row.comissao;
      }
    }
  }

  const barbers = Array.from(barbersMap.entries()).map(([name, data]) => ({
    name,
    ...data
  })).filter(b => b.totalProducts > 0 || b.totalSales > 0 || b.totalCommission > 0);

  if (barbers.length === 0) {
    throw new Error("Não foi possível extrair dados válidos deste PDF. Verifique se é o relatório correto de Comissão de Produtos.");
  }

  return { barbers };
}


export async function parseCashbarberProductsSpreadsheet(file: File): Promise<CashbarberProductReport> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Need to handle both CSV strings parsed as text and Excel files
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  let jsonData: any[][] = [];
  
  if (fileExt === 'csv') {
    // Better read via Papa if it's a CSV to avoid weird delimiter issues sometimes found in Excel's CSV parsing
    
    const text = new TextDecoder("utf-8").decode(arrayBuffer);
    const parsed = Papa.parse(text, { skipEmptyLines: true });
    jsonData = parsed.data as any[][];
  } else {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
  }

  let headerRowIdx = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i].map(c => String(c || "").trim().toLowerCase());
    if (row.includes("profissional") || row.includes("categoria") || row.includes("produto") || row.includes("comissão") || row.includes("comissao (grupo)")) {
      headerRowIdx = i;
      headers = row;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("Não foi possível encontrar o cabeçalho da planilha. Verifique se é o relatório correto.");
  }

  const profIdx = headers.findIndex(h => h.includes("profissional"));
  const catIdx = headers.findIndex(h => h.includes("categoria") || h.includes("grupo"));
  const qtdIdx = headers.findIndex(h => h === "quantidade" || h === "qtd" || h.includes("qtd"));
  
  // Specific columns from the new CSV model
  const totalItemIdx = headers.findIndex(h => h === "total item" || h === "total");
  const totalGrupoIdx = headers.findIndex(h => h.includes("total vendido") || h.includes("total"));
  const comissaoIdx = headers.findIndex(h => h.includes("comissão") || h.includes("comissao") || h.includes("comiss"));

  const parseCurrency = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/R\$/g, '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
  };

  const parseQtd = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseInt(String(val).trim(), 10) || 0;
  };

  const barbersMap = new Map<string, { totalProducts: number, totalSales: number, totalCommission: number, commissionProdGeral: number, commissionProdAvant: number }>();

  let currentProf = "";
  let currentCategoria = "";
  
  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    let prof = String(profIdx !== -1 ? row[profIdx] || "" : "").trim();
    if (prof.toUpperCase() === "TOTAL GERAL") continue;
    
    if (prof) {
      currentProf = prof;
      currentCategoria = ""; // reset category on new professional, just in case
    }
    if (!currentProf) continue;
    
    let categoria = String(catIdx !== -1 ? row[catIdx] || "" : "").trim().toLowerCase();
    if (categoria) {
      currentCategoria = categoria;
    }
    
    if (currentCategoria.includes("bebida") || currentCategoria.includes("cerveja") || currentCategoria.includes("agua") || currentCategoria.includes("água") || currentCategoria.includes("refrigerante")) {
      continue;
    }

    const qtd = parseQtd(qtdIdx !== -1 ? row[qtdIdx] : 0);
    
    // Some cashbarber exports put the value in "Total" or "Total Item" for each row.
    // If it's the exact new format, we want to sum the row's 'Total Item'.
    // If 'Total Item' is not there, we might fallback to 'Total Vendido' but only if it's the first row of a group.
    
    let saleValue = 0;
    if (totalItemIdx !== -1 && row[totalItemIdx]) {
       saleValue = parseCurrency(row[totalItemIdx]);
    } else if (totalGrupoIdx !== -1 && row[totalGrupoIdx]) {
       saleValue = parseCurrency(row[totalGrupoIdx]); // Fallback if no Total Item
    }
    
    // For commission, the new format has "Comissão (Grupo)" which appears once per group
    // In older formats, it might be per line. We just add whatever is there.
    let comissao = 0;
    if (comissaoIdx !== -1 && row[comissaoIdx]) {
       comissao = parseCurrency(row[comissaoIdx]);
    }

    if (!barbersMap.has(currentProf)) {
      barbersMap.set(currentProf, { totalProducts: 0, totalSales: 0, totalCommission: 0, commissionProdGeral: 0, commissionProdAvant: 0 });
    }
    
    const b = barbersMap.get(currentProf)!;
    b.totalProducts += qtd;
    b.totalSales += saleValue;
    b.totalCommission += comissao;
    
    if (currentCategoria.includes("avant")) {
      b.commissionProdAvant += comissao;
    } else {
      b.commissionProdGeral += comissao;
    }
  }

  const barbers = Array.from(barbersMap.entries()).map(([name, data]) => ({
    name,
    ...data
  })).filter(b => b.totalProducts > 0 || b.totalSales > 0 || b.totalCommission > 0);

  return { barbers };
}

const fs = require('fs');
let code = fs.readFileSync('src/CashbarberParser.ts', 'utf8');

const newPdfFunc = `export async function parseCashbarberProductsPDF(file: File): Promise<CashbarberProductReport> {
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
    if (t === "profissional") xProf = item.x;
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
    const str = val.replace(/R\\$/g, '').trim().replace(/\\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
  };

  const parseQtd = (val: string) => {
    if (!val) return 0;
    return parseInt(val.trim(), 10) || 0;
  };

  const barbersMap = new Map<string, { totalProducts: number, totalSales: number, totalCommission: number }>();
  let globalLastPro = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pageItems = allItems.filter(i => i.page === pageNum);
    
    const pros = extractColumn(pageItems, xProf, 40).filter(p => {
      const t = p.text.toLowerCase();
      return t !== "profissional" && t !== "total geral" && p.text.length > 2;
    });
    const cats = extractColumn(pageItems, xCat, 50).filter(c => {
      const t = c.text.toLowerCase();
      return t !== "categoria" && c.text.length > 2;
    });
    const qtds = extractColumn(pageItems, xQtd, 30).filter(q => {
      return /\\d/.test(q.text) && q.text.toLowerCase() !== "quantidade" && q.text.toLowerCase() !== "qtd";
    });
    const vendidos = extractColumn(pageItems, xVendido, 40).filter(v => {
      return v.text.toLowerCase() !== "vendido" && v.text.toLowerCase() !== "total vendido" && /\\d/.test(v.text);
    });
    const comissoes = extractColumn(pageItems, xComissao, 40).filter(c => {
      return !c.text.toLowerCase().includes("comiss") && /\\d/.test(c.text);
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
        barbersMap.set(proName, { totalProducts: 0, totalSales: 0, totalCommission: 0 });
      }
      const b = barbersMap.get(proName)!;
      b.totalProducts += totalQtd;
      b.totalSales += row.vendido;
      b.totalCommission += row.comissao;
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
`

const exportIdx = code.indexOf('export async function parseCashbarberProductsPDF');
const endIdx = code.indexOf('export async function parseCashbarberProductsSpreadsheet');

if (exportIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, exportIdx) + newPdfFunc + "\n\n" + code.substring(endIdx);
  fs.writeFileSync('src/CashbarberParser.ts', code);
  console.log("Patched PDF Parser");
} else {
  console.log("Could not find bounds");
}

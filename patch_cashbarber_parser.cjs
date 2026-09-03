const fs = require('fs');
let code = fs.readFileSync('src/CashbarberParser.ts', 'utf8');

const newFunc = `export async function parseCashbarberProductsSpreadsheet(file: File): Promise<CashbarberProductReport> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Need to handle both CSV strings parsed as text and Excel files
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  let jsonData: any[][] = [];
  
  if (fileExt === 'csv') {
    // Better read via Papa if it's a CSV to avoid weird delimiter issues sometimes found in Excel's CSV parsing
    const Papa = require("papaparse");
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
  const catIdx = headers.findIndex(h => h.includes("categoria"));
  const qtdIdx = headers.findIndex(h => h === "quantidade" || h === "qtd");
  
  // Specific columns from the new CSV model
  const totalItemIdx = headers.findIndex(h => h === "total item" || h === "total");
  const totalGrupoIdx = headers.findIndex(h => h.includes("total vendido"));
  const comissaoIdx = headers.findIndex(h => h.includes("comissão") || h.includes("comissao"));

  const parseCurrency = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/R\\$/g, '').trim().replace(/\\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
  };

  const parseQtd = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseInt(String(val).trim(), 10) || 0;
  };

  const barbersMap = new Map<string, { totalProducts: number, totalSales: number, totalCommission: number }>();

  let currentProf = "";
  
  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    let prof = String(profIdx !== -1 ? row[profIdx] || "" : "").trim();
    if (prof.toUpperCase() === "TOTAL GERAL") continue;
    
    if (prof) currentProf = prof;
    if (!currentProf) continue;
    
    let categoria = String(catIdx !== -1 ? row[catIdx] || "" : "").trim().toLowerCase();
    
    if (categoria.includes("bebida") || categoria.includes("cerveja") || categoria.includes("agua") || categoria.includes("água") || categoria.includes("refrigerante")) {
      continue;
    }

    const qtd = parseQtd(row[qtdIdx !== -1 ? row[qtdIdx] : 0]);
    
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
      barbersMap.set(currentProf, { totalProducts: 0, totalSales: 0, totalCommission: 0 });
    }
    
    const b = barbersMap.get(currentProf)!;
    b.totalProducts += qtd;
    b.totalSales += saleValue;
    b.totalCommission += comissao;
  }

  const barbers = Array.from(barbersMap.entries()).map(([name, data]) => ({
    name,
    ...data
  })).filter(b => b.totalProducts > 0 || b.totalSales > 0 || b.totalCommission > 0);

  return { barbers };
}`;

const exportIdx = code.indexOf('export async function parseCashbarberProductsSpreadsheet');
if (exportIdx !== -1) {
  code = code.substring(0, exportIdx) + newFunc;
  fs.writeFileSync('src/CashbarberParser.ts', code);
  console.log("Patched");
} else {
  console.log("Not found");
}

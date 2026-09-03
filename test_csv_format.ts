import Papa from "papaparse";

const csvText = `ID,Filial,Profissional,Categoria,Quantidade,Produto,Valor unidade,Total,Total vendido,Comissão
1,Vangard Eusébio,Kaio Feitosa Adm,Cosméticos,1,MATTE CLAY - BABOON,"R$ 98,00","R$ 98,00","R$ 325,50","R$ 22,79"
,,,,1,shampoo barba urbana (Preto),"R$ 80,00","R$ 59,50",,
,,,,1,ULTRA HOLD - BABOON,"R$ 98,00","R$ 98,00",,
,,,,1,shampoo barba urbana (branco),"R$ 80,00","R$ 70,00",,
1,Vangard Eusébio,Kaio Feitosa Adm,Cosméticos Avant,1,Iron hold,"R$ 78,00","R$ 70,00","R$ 70,00","R$ 14,00"
1,Vangard Eusébio,Kaio Feitosa Adm,Bebidas,1,REDBULL,"R$ 15,00","R$ 13,50","R$ 60,30","R$ 0,00"
,,,,4,CERVEJA HEINEKEN 330ML,"R$ 13,00","R$ 46,80",,
1,Vangard Eusébio,Kaio Feitosa Adm,Cosméticos Avant,2,Shampoo Avant,"R$ 55,00","R$ 104,50","R$ 237,50","R$ 47,50"
,,,,2,Stone clay,"R$ 78,00","R$ 133,00",,
2,Vangard Eusébio,Gabriel Souza,Cosméticos,2,Barba urbana - brilho,"R$ 98,00","R$ 186,20","R$ 615,60","R$ 61,56"
,,,,1,CEMENT EFECT - BABOON,"R$ 98,00","R$ 88,20",,
,,,,1,ULTRA HOLD - BABOON,"R$ 98,00","R$ 88,20",,
,,,,1,Leave In Baboon,"R$ 100,00","R$ 100,00",,
,,,,1,GROOMING - baboon,"R$ 90,00","R$ 76,50",,
,,,,1,HAIR SPRAY - BABOON,"R$ 85,00","R$ 76,50",,
2,Vangard Eusébio,Gabriel Souza,Cosméticos,2,Leave In Baboon,"R$ 100,00","R$ 190,00","R$ 260,00","R$ 52,00"
,,,,1,shampoo barba urbana (branco),"R$ 80,00","R$ 70,00",,`;

const parsed = Papa.parse(csvText, { skipEmptyLines: true });
const jsonData = parsed.data as any[][];

let headerRowIdx = -1;
let headers = [];
for (let i = 0; i < Math.min(20, jsonData.length); i++) {
  const row = jsonData[i].map(c => String(c || "").trim().toLowerCase());
  if (row.includes("profissional") || row.includes("categoria") || row.includes("produto") || row.includes("comissão") || row.includes("comissao (grupo)")) {
    headerRowIdx = i;
    headers = row;
    break;
  }
}

const profIdx = headers.findIndex(h => h.includes("profissional"));
const catIdx = headers.findIndex(h => h.includes("categoria"));
const qtdIdx = headers.findIndex(h => h === "quantidade" || h === "qtd");
const totalItemIdx = headers.findIndex(h => h === "total item" || h === "total");
const totalGrupoIdx = headers.findIndex(h => h.includes("total vendido"));
const comissaoIdx = headers.findIndex(h => h.includes("comissão") || h.includes("comissao"));

const parseCurrency = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/R\$/g, '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
};

const parseQtd = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseInt(String(val).trim(), 10) || 0;
};

const barbersMap = new Map();
let currentProf = "";
let currentCategoria = "";

for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;
  
  let prof = String(profIdx !== -1 ? row[profIdx] || "" : "").trim();
  if (prof.toUpperCase() === "TOTAL GERAL") continue;
  
  if (prof) {
    currentProf = prof;
    currentCategoria = "";
  }
  if (!currentProf) continue;
  
  let categoria = String(catIdx !== -1 ? row[catIdx] || "" : "").trim().toLowerCase();
  if (categoria) {
    currentCategoria = categoria;
  }
  
  if (currentCategoria.includes("bebida") || currentCategoria.includes("cerveja") || currentCategoria.includes("agua") || currentCategoria.includes("água") || currentCategoria.includes("refrigerante")) {
    continue;
  }

  const qtd = parseQtd(row[qtdIdx !== -1 ? row[qtdIdx] : 0]);
  
  let saleValue = 0;
  if (totalItemIdx !== -1 && row[totalItemIdx]) {
     saleValue = parseCurrency(row[totalItemIdx]);
  } else if (totalGrupoIdx !== -1 && row[totalGrupoIdx]) {
     saleValue = parseCurrency(row[totalGrupoIdx]);
  }
  
  let comissao = 0;
  if (comissaoIdx !== -1 && row[comissaoIdx]) {
     comissao = parseCurrency(row[comissaoIdx]);
  }

  if (!barbersMap.has(currentProf)) {
    barbersMap.set(currentProf, { totalProducts: 0, totalSales: 0, totalCommission: 0 });
  }
  
  const b = barbersMap.get(currentProf);
  b.totalProducts += qtd;
  b.totalSales += saleValue;
  b.totalCommission += comissao;
}

console.log(Array.from(barbersMap.entries()));

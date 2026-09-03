const fs = require('fs');
let code = fs.readFileSync('src/CashbarberParser.ts', 'utf8');

const targetStr = `  let currentProf = "";
  
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
    }`;

const newStr = `  let currentProf = "";
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
    }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/CashbarberParser.ts', code);
  console.log("Patched category state");
} else {
  console.log("Not found target string");
}

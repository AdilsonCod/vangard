const fs = require('fs');

let code = fs.readFileSync('src/DPoteParser.ts', 'utf8');

if (!code.includes('parseDPoteSpreadsheet')) {
  // Add imports if missing
  if (!code.includes('import * as XLSX')) {
    code = `import * as XLSX from "xlsx";\nimport Papa from "papaparse";\n` + code;
  }
  
  const additionalCode = `
export function extractDPoteFrom2DArray(rows: any[][]): DPoteReport {
  let totalAssinaturas = 0;
  const barbersMap = new Map<string, DPoteBarberData>();

  let currentSection = "";

  const parseCurrency = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/R\\$\\s*/g, '').replace(/\\./g, '').replace(',', '.'));
  };

  const parsePercentage = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') {
      if (val < 1 && val > 0) return val * 100;
      return val;
    }
    const match = String(val).match(/([\\d,]+)%?/);
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
      const potPerc = parsePercentage(row[3]);
      const commission = parseCurrency(row[4]);

      barbersMap.set(name, {
        name,
        commission,
        potPercentage: potPerc,
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
`;
  
  code += additionalCode;
  fs.writeFileSync('src/DPoteParser.ts', code);
}

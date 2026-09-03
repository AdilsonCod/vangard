const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `                unitId:
                  users.find((u) => u.id === group.userId)?.unit || "VANGARD",`,
  `                unitId:
                  targetUnitId || users.find((u) => u.id === group.userId)?.unit || "ALL",`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/DataImporterView.tsx', 'utf8');

code = code.replace(
  `              isPaid: false,
              potData: barber.services,
              potPercentage: barber.potPercentage,`,
  `              isPaid: false,
              potData: barber.services.map(s => ({ ...s, id: Math.random().toString(36).substring(2, 9) })),
              potPercentage: barber.potPercentage,`
);

fs.writeFileSync('src/components/DataImporterView.tsx', code);

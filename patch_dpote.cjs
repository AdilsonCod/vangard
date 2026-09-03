const fs = require('fs');
let code = fs.readFileSync('src/DPoteParser.ts', 'utf8');

code = code.replace(
  `export interface DPoteBarberData {
  name: string;
  commission: number;
  potPercentage: number;
  services: { name: string; quantity: number; tokens: number }[];
}`,
  `export interface DPoteBarberData {
  name: string;
  commission: number;
  potPercentage: number;
  totalServices: number;
  totalTokens: number;
  services: { name: string; quantity: number; tokens: number }[];
}`
);

code = code.replace(
  `      const name = firstCell;
      const potPerc = parsePercentage(row[3]);
      const commission = parseCurrency(row[4]);

      barbersMap.set(name, {
        name,
        commission,
        potPercentage: potPerc,
        services: []
      });`,
  `      const name = firstCell;
      const totalServices = parseInt(String(row[1]).replace(/\\D/g, '')) || 0;
      const totalTokens = parseInt(String(row[2]).replace(/\\D/g, '')) || 0;
      const potPerc = parsePercentage(row[3]);
      const commission = parseCurrency(row[4]);

      barbersMap.set(name, {
        name,
        commission,
        potPercentage: potPerc,
        totalServices,
        totalTokens,
        services: []
      });`
);

// We should also patch parseDPotePDF to supply totalServices and totalTokens
code = code.replace(
  `           if (commission > 0) {
              currentBarber = { name, commission, potPercentage: perc, services: [] };`,
  `           if (commission > 0) {
              currentBarber = { name, commission, potPercentage: perc, totalServices: 0, totalTokens: 0, services: [] };`
);

code = code.replace(
  `         currentBarber = {
           name: name,
           commission: parseCurrency(valMatch[0]),
           potPercentage: parsePercentage(percMatch[1]),
           services: []
         };`,
  `         currentBarber = {
           name: name,
           commission: parseCurrency(valMatch[0]),
           potPercentage: parsePercentage(percMatch[1]),
           totalServices: 0,
           totalTokens: 0,
           services: []
         };`
);

code = code.replace(
  `           currentBarber = {
             name: name,
             commission: parseCurrency(nValMatch[0]),
             potPercentage: parsePercentage(nPercMatch[1]),
             services: []
           };`,
  `           currentBarber = {
             name: name,
             commission: parseCurrency(nValMatch[0]),
             potPercentage: parsePercentage(nPercMatch[1]),
             totalServices: 0,
             totalTokens: 0,
             services: []
           };`
);

code = code.replace(
  `  const validBarbers = barbers.filter(b => b.commission > 0 && b.potPercentage > 0);
  return { totalAssinaturas, barbers: validBarbers };`,
  `  barbers.forEach(b => {
    if (b.totalServices === 0) {
      b.totalServices = b.services.reduce((acc, s) => acc + s.quantity, 0);
    }
    if (b.totalTokens === 0) {
      b.totalTokens = b.services.reduce((acc, s) => acc + s.tokens, 0);
    }
  });
  const validBarbers = barbers.filter(b => b.commission > 0 && b.potPercentage > 0);
  return { totalAssinaturas, barbers: validBarbers };`
);

fs.writeFileSync('src/DPoteParser.ts', code);

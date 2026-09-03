const fs = require('fs');
let code = fs.readFileSync('src/components/UsersDashboard.tsx', 'utf8');

code = code.replace(
  `export function UsersDashboard() {`,
  `export function UsersDashboard({ tabView }: { tabView?: "BARBERS" | "MANAGERS" | "UNITS" }) {`
);

code = code.replace(
  `const [subTab, setSubTab] = useState<"BARBERS" | "MANAGERS" | "UNITS">("BARBERS");`,
  `const subTab = tabView || "BARBERS";`
);

// We should also remove the resetForm from subTab changes because we don't have subTab buttons anymore, but it's safe to just remove the UI block.
const tabsRegex = /\{\/\*\s*Sub-tabs Navigation\s*\*\/\}.*?<\/div>/s;
code = code.replace(tabsRegex, '');

fs.writeFileSync('src/components/UsersDashboard.tsx', code);

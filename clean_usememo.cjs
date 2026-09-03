const fs = require('fs');
let content = fs.readFileSync('src/components/BarberDashboard.tsx', 'utf8');

content = content.replace(
  /const userNotifications = useMemo\(\(\) => \{\n\s*const navItems = \[\n\s*\{ id: "OVERVIEW", label: "Visão Geral", icon: LayoutDashboard \},\n\s*return \(notifications \|\| \[\]\).filter\(n => n\.userId === currentUser!\.id\)\.sort\(\(a,b\) => b\.createdAt\.localeCompare\(a\.createdAt\)\);\n\s*\}, \[notifications, currentUser\]\);/,
  `const userNotifications = useMemo(() => {
    return (notifications || []).filter(n => n.userId === currentUser!.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, currentUser]);`
);
fs.writeFileSync('src/components/BarberDashboard.tsx', content, 'utf8');

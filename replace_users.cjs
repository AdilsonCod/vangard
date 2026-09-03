const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

code = code.replace(
  '{ id: "USERS", label: "Usuários", icon: Users },',
  `{ 
      id: "USERS", 
      label: "Usuários & Unidades", 
      icon: Users,
      subItems: [
        { id: "USERS_STAFF", label: "Colaboradores" },
        { id: "USERS_MANAGEMENT", label: "Gerência" },
        { id: "USERS_UNITS", label: "Unidades" }
      ]
    },`
);

// We need to also fix where it says: ? allNavItems.filter(item => item.id === "FINANCE" || ... || item.id === "USERS")
// We can leave item.id === "USERS", since the ID is still "USERS".

code = code.replace(
  `        ) : activeTab === "USERS" ? (\n          <UsersDashboard />\n`,
  `        ) : activeTab === "USERS_STAFF" ? (\n          <UsersDashboard tabView="BARBERS" />\n        ) : activeTab === "USERS_MANAGEMENT" ? (\n          <UsersDashboard tabView="MANAGERS" />\n        ) : activeTab === "USERS_UNITS" ? (\n          <UsersDashboard tabView="UNITS" />\n`
);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);

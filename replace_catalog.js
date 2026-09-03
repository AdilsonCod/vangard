const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// 1. Update navItems for CATALOG
code = code.replace(
  '{ id: "CATALOG", label: "Catálogo (Barbearia/Produtos)", icon: BookOpen },',
  `{ 
      id: "CATALOG", 
      label: "Catálogo", 
      icon: BookOpen,
      subItems: [
        { id: "CATALOG_PRODUCTS", label: "Produtos" },
        { id: "CATALOG_SERVICES", label: "Serviços" },
        { id: "CATALOG_CATEGORIES", label: "Categorias" }
      ]
    },`
);

// 2. Update rendering logic in main
code = code.replace(
  `} else if (activeTab === "CATALOG") {\n          return <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} />;`,
  `// NOT DOING THIS REGEX`
); // wait, it's a ternary in AdminDashboard

code = code.replace(
  `} : activeTab === "CATALOG" ? (\n          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} />`,
  `} : activeTab === "CATALOG_PRODUCTS" ? (\n          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="PRODUCTS" />\n        ) : activeTab === "CATALOG_SERVICES" ? (\n          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="SERVICES" />\n        ) : activeTab === "CATALOG_CATEGORIES" ? (\n          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="CATEGORIES" />`
);
// wait the exact string is:
//         ) : activeTab === "CATALOG" ? (
//           <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} />

fs.writeFileSync('src/components/AdminDashboard.tsx', code);

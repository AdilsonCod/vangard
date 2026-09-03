const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

code = code.replace(
`function CatalogEditor({
  catalog,
  updateCatalog,
}: {
  catalog: CatalogItem[];
  updateCatalog: (cat: CatalogItem[]) => void;
}) {
  const { categories, subcategories, updateCategories, updateSubcategories, systemUnits } =
    useStore();
  const availableUnits = systemUnits || [];
  const [activeSubTab, setActiveSubTab] = useState<
    "ITEMS" | "CATEGORIES" | "SUBCATEGORIES"
  >("ITEMS");`,
`function CatalogEditor({
  catalog,
  updateCatalog,
  tabView
}: {
  catalog: CatalogItem[];
  updateCatalog: (cat: CatalogItem[]) => void;
  tabView: "PRODUCTS" | "SERVICES" | "CATEGORIES";
}) {
  const { categories, subcategories, updateCategories, updateSubcategories, systemUnits } =
    useStore();
  const availableUnits = systemUnits || [];
  const [catSubTab, setCatSubTab] = useState<"CATEGORIES" | "SUBCATEGORIES">("CATEGORIES");
  const activeSubTab = tabView === "CATEGORIES" ? catSubTab : "ITEMS";`
);

code = code.replace(
`  const addNew = () => {
    const newItem: CatalogItem = {
      id: "item_" + Date.now(),
      name: "Novo Item",
      type: categories[0]?.id || "SERVICE",`,
`  const addNew = () => {
    const defaultCat = categories.find(c => tabView === "PRODUCTS" ? c.type === "PRODUCT" : (c.type === "SERVICE" || c.type === "SUBSCRIPTION" || !c.type));
    const newItem: CatalogItem = {
      id: "item_" + Date.now(),
      name: "Novo Item",
      type: defaultCat?.id || (tabView === "PRODUCTS" ? "PRODUCT" : "SERVICE"),`
);

// We need to filter items based on tabView.
// At line 875, it maps over items:
// {items.map((item) => (
code = code.replace(
`      {activeSubTab === "ITEMS" ? (
        <div className="divide-y border rounded-xl overflow-hidden shadow-sm">
          {items.map((item) => (
            <div`,
`      {activeSubTab === "ITEMS" ? (
        <div className="divide-y border rounded-xl overflow-hidden shadow-sm">
          {items.filter((item) => {
             const cat = categories.find(c => c.id === item.type);
             const typeMatch = cat?.type || (item.type === "PRODUCT" ? "PRODUCT" : "SERVICE");
             if (tabView === "PRODUCTS") return typeMatch === "PRODUCT";
             return typeMatch === "SERVICE" || typeMatch === "SUBSCRIPTION";
          }).map((item) => (
            <div`
);

// In the category dropdown for items:
// {categories.map((cat) => (
code = code.replace(
`                    <select
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-full md:w-48"
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          type: e.target.value,
                          subcategoryId: "",
                        })
                      }
                    >
                      {categories.map((cat) => (`,
`                    <select
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-full md:w-48"
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          type: e.target.value,
                          subcategoryId: "",
                        })
                      }
                    >
                      {categories.filter(c => tabView === "PRODUCTS" ? c.type === "PRODUCT" : (c.type === "SERVICE" || c.type === "SUBSCRIPTION" || !c.type)).map((cat) => (`
);


// Replace the Sub-tabs selection
code = code.replace(
`      {/* Sub-tabs Selection */}
      <div className="flex gap-4 border-b mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("ITEMS")}
          className={\`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap \${activeSubTab === "ITEMS" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}\`}
        >
          Itens (Produtos/Serviços)
        </button>
        <button
          onClick={() => setActiveSubTab("CATEGORIES")}
          className={\`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap \${activeSubTab === "CATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}\`}
        >
          Categorias
        </button>
        <button
          onClick={() => setActiveSubTab("SUBCATEGORIES")}
          className={\`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap \${activeSubTab === "SUBCATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}\`}
        >
          Subcategorias
        </button>
      </div>`,
`      {/* Sub-tabs Selection */}
      {tabView === "CATEGORIES" && (
        <div className="flex gap-4 border-b mb-6 overflow-x-auto">
          <button
            onClick={() => setCatSubTab("CATEGORIES")}
            className={\`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap \${activeSubTab === "CATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}\`}
          >
            Categorias
          </button>
          <button
            onClick={() => setCatSubTab("SUBCATEGORIES")}
            className={\`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap \${activeSubTab === "SUBCATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}\`}
          >
            Subcategorias
          </button>
        </div>
      )}`
);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);

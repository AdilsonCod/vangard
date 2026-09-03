const fs = require('fs');

let content = fs.readFileSync('src/components/BarberDashboard.tsx', 'utf8');

// 1. Fix imports
content = content.replace(/import \{\s*LogOut,[\s\S]*?\} from "lucide-react";/, `import {
  LogOut,
  Calendar,
  Plus,
  ShoppingBag,
  Users,
  Settings,
  Menu,
  X,
  Scissors,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Save,
  Trophy,
  Bell,
  Calculator,
  TrendingUp,
  Coins,
  LayoutDashboard,
  Megaphone,
  Target,
  Edit3,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  DollarSign
} from "lucide-react";`);

// 2. Add isSidebarCollapsed state
content = content.replace(
  /const \[isMobileMenuOpen, setIsMobileMenuOpen\] = useState\(false\);/,
  `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { isDarkMode, setIsDarkMode } = useStore();`
);

// 3. Remove SIMULADOR from activeTab
content = content.replace(
  /"OVERVIEW" \| "AVISOS" \| "AUTOGESTAO" \| "METAS" \| "PAGAMENTOS" \| "RELATORIOS" \| "RANKINGS" \| "ANOTACOES" \| "CONFIGURACOES" \| "SIMULADOR"/,
  `"OVERVIEW" | "AVISOS" | "AUTOGESTAO" | "METAS" | "PAGAMENTOS" | "RELATORIOS" | "RANKINGS" | "ANOTACOES" | "CONFIGURACOES"`
);

// 4. Create navItems inside the component, right before return (
const renderRegex = /return \([\s\S]+?\);\s+\}/;

const newRender = `const navItems = [
    { id: "OVERVIEW", label: "Visão Geral", icon: LayoutDashboard },
    { id: "AVISOS", label: "Quadro de Avisos", icon: Megaphone },
    { id: "AUTOGESTAO", label: "Autogestão / Performance", icon: TrendingUp },
    { id: "METAS", label: "Lançamentos e Objetivos", icon: Target },
    { id: "PAGAMENTOS", label: "Meus Pagamentos", icon: DollarSign },
    { id: "RELATORIOS", label: "Meus Relatórios", icon: FileText },
    { id: "RANKINGS", label: "Rankings", icon: Trophy },
    { id: "ANOTACOES", label: "Anotações / Bloco", icon: Edit3 },
    { id: "CONFIGURACOES", label: "Configurações", icon: Settings },
  ] as const;

  return (
    <div className="h-[100dvh] overflow-hidden w-full bg-gray-50 dark:bg-zinc-950 text-gray-600 dark:text-zinc-300 flex transition-colors">
      
      {/* Desktop Sidebar */}
      <aside className={\`hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 transition-all duration-300 \${isSidebarCollapsed ? "w-20" : "w-64"} flex-shrink-0 h-full overflow-y-auto custom-scrollbar\`}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 border-b border-gray-100 dark:border-zinc-800/50 h-[72px]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <img src="/logo-escura.png" alt="Van's Logo" className="block dark:hidden w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
              <img src="/logo-clara.png" alt="Van's Logo" className="hidden dark:block w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
              <div className="flex flex-col min-w-0 flex-1">
                 <span className="font-bold text-gray-900 dark:text-zinc-100 truncate text-sm">Olá, {currentUser!.name}</span>
                 <span className="text-[10px] text-gray-500 truncate">{systemUnits?.find(su => su.id === currentUser!.unit)?.name || currentUser!.unit}</span>
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="mx-auto w-full flex justify-center">
              <img src="/logo-escura.png" alt="Van's Logo" className="block dark:hidden w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <img src="/logo-clara.png" alt="Van's Logo" className="hidden dark:block w-8 h-8 object-contain" referrerPolicy="no-referrer" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm \${
                  isActive 
                    ? "bg-[#FF7852]/10 text-[#FF7852]" 
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100"
                }\`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className={\`w-5 h-5 shrink-0 \${isActive ? "text-[#FF7852]" : "text-gray-400 dark:text-zinc-500"}\`} />
                {!isSidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-zinc-800 flex flex-col gap-1">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 \${isSidebarCollapsed ? 'justify-center' : ''}\`}
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 \${isSidebarCollapsed ? 'justify-center' : ''}\`}
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isSidebarCollapsed ? 'Expandir' : 'Recolher'}</span>}
          </button>

          <button
            onClick={logout}
            className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 \${isSidebarCollapsed ? 'justify-center' : ''}\`}
            title="Sair"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo-escura.png" alt="Van's Logo" className="block dark:hidden w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <img src="/logo-clara.png" alt="Van's Logo" className="hidden dark:block w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <h1 className="text-lg font-bold">Olá, {currentUser!.name}</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="p-2 text-gray-500 dark:text-zinc-400 hover:text-[#FF7852] transition-colors rounded-full relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 dark:text-zinc-100 text-sm">Notificações</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{unreadCount} novas</span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">Nenhuma notificação.</p>
                      ) : (
                        userNotifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              if (!notif.read) markNotificationAsRead(notif.id);
                            }}
                            className={\`p-3 border-b border-gray-100 dark:border-zinc-700/50 cursor-pointer transition \${notif.read ? 'opacity-60 bg-transparent' : 'bg-blue-50/50 dark:bg-blue-900/10'}\`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{notif.title}</h4>
                              <span className="text-[10px] text-gray-400">{new Date(notif.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-zinc-300">{notif.message}</p>
                            <div className="flex justify-end mt-2">
                               <button onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Excluir</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="border-t border-gray-200 dark:border-zinc-800 shadow-xl absolute w-full z-50 bg-white dark:bg-zinc-900">
              <div className="px-2 py-2 flex flex-col space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={\`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all \${
                        isActive 
                          ? "bg-[#FF7852]/10 text-[#FF7852]" 
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      }\`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
          {activeTab === "OVERVIEW" ? (
            <OverviewBarberDashboard />
          ) : activeTab === "AVISOS" ? (
            <BarberAnnouncementsView />
          ) : activeTab === "AUTOGESTAO" ? (
            <BarberSelfManagementView />
          ) : activeTab === "METAS" ? (
            <>
              {/* PROGRESS SECTION */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    Seus Objetivos e Totais
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase font-semibold">
                      Dias Trabalhados
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {stats.daysWorked}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
                    <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase font-semibold">
                      Períodos de Folga
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                      {stats.daysOff}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-purple-100 p-4 col-span-2 md:col-span-1 flex flex-col">
                    <p className="text-xs text-purple-600 uppercase font-semibold mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Atendimentos
                    </p>
                    <p className="text-2xl font-bold text-purple-700">
                      {stats.clientsServedCount}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-orange-100 p-4 col-span-2 md:col-span-1 flex flex-col">
                    <p className="text-xs text-orange-600 uppercase font-semibold mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Clientes Únicos
                    </p>
                    <p className="text-2xl font-bold text-orange-700">
                      {stats.uniqueClientsServedCount}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catalog
                    .filter((c) => c.type === "SERVICE" || c.type === "PRODUCT")
                    .map((item) => {
                      const total = stats.totals[item.id] || 0;
                      const userTarget =
                        targets.find(
                          (t) =>
                            t.userId === currentUser?.id && t.itemId === item.id
                        )?.targetAmount || 0;
                      return (
                        <ProgressCard
                          key={item.id}
                          title={item.name}
                          current={total}
                          target={userTarget}
                          type={item.type as "SERVICE" | "PRODUCT"}
                        />
                      );
                    })}
                </div>
              </section>

              {/* RECORD ENTRY SECTION */}
              <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                    <Check className="w-5 h-5 text-[#FF7852]" />
                    Lançamento Diário
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                    Preencha os valores faturados (não as quantidades). A comissão
                    será calculada automaticamente pela gerência.
                  </p>
                </div>

                <div className="p-6 space-y-8">
                  {errorMessage && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200">
                      {errorMessage}
                    </div>
                  )}
                  {successMessage && (
                    <div className="bg-green-50 text-green-600 p-4 rounded-lg text-sm border border-green-200">
                      {successMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                        Período do Lançamento
                      </label>
                      <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 p-3"
                      >
                        <option value="">Selecione um período</option>
                        {availablePeriods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      {selectedPeriod && (
                        <p className="text-xs text-gray-500 mt-2">
                          Você deve lançar os totais referentes a todo este
                          período.
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex items-center gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isDayOff}
                            onChange={(e) => setIsDayOff(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                            Não trabalhei neste período (Folga/Falta)
                          </span>
                        </label>
                      </div>

                      {!isDayOff && selectedPeriod && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
                            Quais dias você trabalhou neste período?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {getEntryDaysList(selectedPeriod).map((day) => (
                              <button
                                key={day.dateStr}
                                onClick={() => {
                                  setWorkedDays((prev) =>
                                    prev.includes(day.dateStr)
                                      ? prev.filter((d) => d !== day.dateStr)
                                      : [...prev, day.dateStr]
                                  );
                                }}
                                className={\`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors \${
                                  workedDays.includes(day.dateStr)
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                }\`}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                          {workedDays.length === 0 && (
                            <p className="text-xs text-red-500 mt-2">
                              Selecione pelo menos um dia trabalhado.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isDayOff && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                          Número de Atendimentos Totais (Cadeiras sentadas)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={clientsServed || ""}
                          onChange={(e) =>
                            setClientsServed(parseInt(e.target.value) || 0)
                          }
                          className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 p-3"
                          placeholder="Ex: 45"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                          Número de Clientes Únicos (CPFs Distintos)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={uniqueClientsServed || ""}
                          onChange={(e) =>
                            setUniqueClientsServed(
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 p-3"
                          placeholder="Ex: 38"
                        />
                      </div>
                    </div>
                  )}

                  {!isDayOff && categories.map((cat) => {
                    const catSubcategories = subcategories.filter(
                      (s) => s.categoryId === cat.id
                    );

                    return (
                      <div key={cat.id} className="space-y-4">
                        <div className="border-b border-gray-200 dark:border-zinc-700 pb-2">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">
                            {cat.name}
                          </h3>
                        </div>

                        {catSubcategories.map((sub) => {
                          const items = catalog.filter(
                            (c) =>
                              c.categoryId === cat.id && c.subcategoryId === sub.id
                          );
                          if (items.length === 0) return null;

                          return (
                            <div key={sub.id} className="mb-6">
                              <h4 className="text-md font-medium text-gray-600 dark:text-zinc-400 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                {sub.name}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                                  >
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                                      {item.name}
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
                                      {item.type === "CORTESIA"
                                        ? "Quantidade"
                                        : "Valor Faturado (R$)"}
                                    </p>
                                    <div className="relative">
                                      {item.type !== "CORTESIA" && (
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                          <span className="text-gray-500 sm:text-sm">
                                            R$
                                          </span>
                                        </div>
                                      )}
                                      <input
                                        type="number"
                                        min="0"
                                        step={item.type === "CORTESIA" ? "1" : "0.01"}
                                        value={
                                          item.type === "CORTESIA"
                                            ? cortesias[item.id]?.amount || ""
                                            : form[item.id]?.amount || ""
                                        }
                                        onChange={(e) =>
                                          handleInputChange(
                                            item.id,
                                            e.target.value,
                                            item.type
                                          )
                                        }
                                        className={\`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 p-2.5 \${
                                          item.type !== "CORTESIA" ? "pl-9" : ""
                                        }\`}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div className="pt-6 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
                    <button
                      onClick={handleSubmit}
                      className="flex items-center gap-2 bg-[#FF7852] text-white px-8 py-3 rounded-xl hover:bg-[#e05f3a] transition-all font-semibold shadow-sm hover:shadow active:scale-95"
                    >
                      <Save className="w-5 h-5" />
                      Salvar Lançamento
                    </button>
                  </div>
                </div>
              </section>

              {/* HISTORY SECTION */}
              <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    Histórico de Lançamentos
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                    <thead className="bg-gray-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                          Período
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                          Total Faturado
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                          Sua Comissão
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                      {entries
                        .filter((e) => e.userId === currentUser?.id)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((entry) => {
                          const totalFaturado = Object.values(entry.items).reduce(
                            (acc, item) => acc + item.amount,
                            0
                          );
                          const totalComissao = Object.values(entry.items).reduce(
                            (acc, item) => acc + item.commission,
                            0
                          );

                          const isExpanded = expandedEntries[entry.id];

                          return (
                            <React.Fragment key={entry.id}>
                              <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-zinc-100">
                                  {formatEntryDate(entry.date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {entry.isDayOff ? (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300">
                                      Folga/Falta
                                    </span>
                                  ) : (
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      Trabalhado ({entry.workedDays?.length || 0} dias)
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-zinc-400">
                                  {entry.isDayOff
                                    ? "-"
                                    : \`R$ \${totalFaturado.toFixed(2)}\`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600 dark:text-green-400">
                                  {entry.isDayOff
                                    ? "-"
                                    : \`R$ \${totalComissao.toFixed(2)}\`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  {!entry.isDayOff && (
                                    <button
                                      onClick={() => toggleEntryExpanded(entry.id)}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors inline-flex items-center"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-5 h-5" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5" />
                                      )}
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && !entry.isDayOff && (
                                <tr className="bg-gray-50/50 dark:bg-zinc-800/20">
                                  <td colSpan={5} className="px-6 py-4">
                                    <div className="text-sm">
                                      <h4 className="font-semibold text-gray-700 dark:text-zinc-300 mb-3">
                                        Detalhamento do Período
                                      </h4>
                                      
                                      <div className="flex gap-4 mb-4 text-xs">
                                        <div className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700">
                                          <span className="text-gray-500 dark:text-zinc-400">Atendimentos totais:</span>
                                          <span className="ml-2 font-bold text-gray-900 dark:text-zinc-100">{entry.clientsServed || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700">
                                          <span className="text-gray-500 dark:text-zinc-400">Clientes únicos:</span>
                                          <span className="ml-2 font-bold text-gray-900 dark:text-zinc-100">{entry.uniqueClientsServed || entry.clientsServed || 0}</span>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {Object.entries(entry.items).map(
                                          ([itemId, data]) => {
                                            const catalogItem = catalog.find(
                                              (c) => c.id === itemId
                                            );
                                            if (!catalogItem) return null;
                                            return (
                                              <div
                                                key={itemId}
                                                className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-gray-100 dark:border-zinc-700 shadow-sm"
                                              >
                                                <div className="flex justify-between items-start mb-1">
                                                  <span className="font-medium text-gray-800 dark:text-zinc-200">
                                                    {catalogItem.name}
                                                  </span>
                                                  {catalogItem.type === "CORTESIA" && (
                                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                                      Qtd
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-gray-50 dark:border-zinc-800">
                                                  <span className="text-gray-500 dark:text-zinc-400">
                                                    {catalogItem.type === "CORTESIA"
                                                      ? "Quantidade:"
                                                      : "Faturado:"}
                                                  </span>
                                                  <span className="font-medium text-gray-700 dark:text-zinc-300">
                                                    {catalogItem.type === "CORTESIA"
                                                      ? data.amount
                                                      : \`R$ \${data.amount.toFixed(
                                                          2
                                                        )}\`}
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-xs mt-1">
                                                  <span className="text-gray-500 dark:text-zinc-400">
                                                    Sua Comissão:
                                                  </span>
                                                  <span className="font-bold text-green-600 dark:text-green-400">
                                                    R$ {data.commission.toFixed(2)}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      {entries.filter((e) => e.userId === currentUser?.id)
                        .length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-sm text-gray-500 dark:text-zinc-400"
                          >
                            <div className="flex flex-col items-center justify-center">
                              <Calendar className="w-12 h-12 text-gray-300 dark:text-zinc-600 mb-3" />
                              <p>Nenhum lançamento encontrado.</p>
                              <p className="text-xs mt-1">
                                Seus lançamentos aparecerão aqui.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : activeTab === "PAGAMENTOS" ? (
            <BarberPaymentsView />
          ) : activeTab === "RELATORIOS" ? (
            <BarberReportsView />
          ) : activeTab === "RANKINGS" ? (
            <BarberRankingsView />
          ) : activeTab === "CONFIGURACOES" ? (
            <BarberSettingsView />
          ) : activeTab === "ANOTACOES" ? (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Bloco de Notas
              </h2>
              <textarea 
                className="w-full h-64 p-4 rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Use este espaço para anotar lembretes, fórmulas de coloração de clientes, ideias..."
                defaultValue={localStorage.getItem(\`notas_\${currentUser?.id}\`) || ""}
                onChange={(e) => localStorage.setItem(\`notas_\${currentUser?.id}\`, e.target.value)}
              ></textarea>
              <p className="text-xs text-gray-500 mt-2 text-right">As anotações são salvas automaticamente no seu navegador.</p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}`;

content = content.replace(renderRegex, newRender);

fs.writeFileSync('src/components/BarberDashboard.tsx', content, 'utf8');

console.log('Rewrite complete');


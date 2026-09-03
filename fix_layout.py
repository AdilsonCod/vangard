import re

with open('src/components/BarberDashboard.tsx', 'r') as f:
    content = f.read()

# Locate the main return statement of BarberDashboard
match = re.search(r'  return \(\n    <div className="min-h-screen text-gray-600', content)
if not match:
    print("Could not find the return statement!")
    exit(1)

index = match.start()
part1 = content[:index]

new_layout = """  const navItems = [
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
    <div className={`h-[100dvh] overflow-hidden w-full ${themeLightBg || "bg-gray-50"} ${themeDarkBg || "dark:bg-zinc-950"} text-gray-600 dark:text-zinc-300 flex transition-colors`}>
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 transition-all duration-300 ${isSidebarCollapsed ? "w-20" : "w-64"} flex-shrink-0 h-full overflow-y-auto custom-scrollbar`}>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm ${
                  isActive 
                    ? "bg-[#FF7852]/10 text-[#FF7852]" 
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100"
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#FF7852]" : "text-gray-400 dark:text-zinc-500"}`} />
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isSidebarCollapsed ? 'Expandir' : 'Recolher'}</span>}
          </button>

          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 ${isSidebarCollapsed ? 'justify-center' : ''}`}
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
                            className={`p-3 border-b border-gray-100 dark:border-zinc-700/50 cursor-pointer transition ${notif.read ? 'opacity-60 bg-transparent' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}
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
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                        isActive 
                          ? "bg-[#FF7852]/10 text-[#FF7852]" 
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      }`}
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
"""

main_start = re.search(r'      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">', content)
if not main_start:
    print("Could not find main start!")
    exit(1)

main_content_start = main_start.end()

main_end = re.search(r'      </main>\s*</div>\s*</div>\s*\);\s*}', content)
if not main_end:
    # try another format just in case
    main_end = re.search(r'      </main>\s*</div>\s*\);\s*}', content)
    if not main_end:
        print("Could not find main end!")
        exit(1)

main_content = content[main_content_start:main_end.start()]

# We need to remove the SIMULADOR check from the main content if it exists
main_content = main_content.replace(
    """        ) : activeTab === "SIMULADOR" ? (
          <BarberSimulatorView />""",
    ""
)

# And also remove SIMULADOR from activeTab declaration at the top
part1 = part1.replace('"CONFIGURACOES" | "SIMULADOR"', '"CONFIGURACOES"')

# Fix imports in part1
if 'LayoutDashboard' not in part1:
    part1 = part1.replace('import {', 'import { LayoutDashboard, Megaphone, Target, DollarSign, Edit3, PanelLeftClose, PanelLeftOpen, Sun, Moon,')

# Add isSidebarCollapsed and themeLightBg
if 'isSidebarCollapsed' not in part1:
    part1 = part1.replace(
        '  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);',
        '  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);\n  const { isDarkMode, setIsDarkMode, themeLightBg, themeDarkBg } = useStore();'
    )

new_end = """      </main>
      </div>
    </div>
  );
}
"""

with open('src/components/BarberDashboard.tsx', 'w') as f:
    f.write(part1 + new_layout + main_content + new_end)

print("Rewrite successful!")

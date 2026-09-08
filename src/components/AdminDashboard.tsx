import React, { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { ProgressCard } from "./ProgressCard";
import { AdminEntryModal } from "./AdminEntryModal";
import { AppIconButton, AppLoadingState, appControlClass, cn } from "./ui/AppPrimitives";
import {
  getAvailablePeriods,
  formatEntryDate,
  getDaysForPeriod,
  getPeriodDaysInfo,
} from "../utils";
import {
  LogOut,
  MapPin,
  Users,
  TrendingUp,
  Settings,
  ChevronRight,
  Edit3,
  Trash2,
  Plus,
  Grip,
  DollarSign,
  Menu,
  X,
  FileText,
  Check,
  Save,
  ChevronDown,
  ChevronUp,
  Calendar,
  LayoutDashboard,
  PieChart,
  Briefcase,
  Megaphone,
  BookOpen,
  BarChart3,
  Upload,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Search,
  Building2,
  UserCircle2,
  MessagesSquare,
  Link2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { User, CatalogItem, Target, Category, Subcategory, Role } from "../types";
import { AnnouncementWall } from "./AnnouncementWall";
// Logo imported via direct asset path

type AdminNavItem = {
  id: string;
  label: string;
  section: string;
  icon: LucideIcon;
  subItems?: ReadonlyArray<{ id: string; label: string }>;
};

const ConfigEditor = lazy(() => import("./ConfigEditor").then(module => ({ default: module.ConfigEditor })));
const UsersDashboard = lazy(() => import("./UsersDashboard").then(module => ({ default: module.UsersDashboard })));
const PaymentsTab = lazy(() => import("./PaymentsTab").then(module => ({ default: module.PaymentsTab })));
const GDVDashboard = lazy(() => import("./GDVDashboard").then(module => ({ default: module.GDVDashboard })));
const UnitsAnalysisDashboard = lazy(() => import("./UnitsAnalysisDashboard").then(module => ({ default: module.UnitsAnalysisDashboard })));
const BarbersAnalysisDashboard = lazy(() => import("./BarbersAnalysisDashboard").then(module => ({ default: module.BarbersAnalysisDashboard })));
const OverviewDashboard = lazy(() => import("./ExecutiveOverviewDashboard").then(module => ({ default: module.ExecutiveOverviewDashboard })));
const FinancialDashboard = lazy(() => import("./FinancialDashboard").then(module => ({ default: module.FinancialDashboard })));
const MarketingDashboard = lazy(() => import("./MarketingDashboard").then(module => ({ default: module.MarketingDashboard })));
const ReportsTab = lazy(() => import("./ReportsTab").then(module => ({ default: module.ReportsTab })));
const DataImporterView = lazy(() => import("./DataImporterView"));
const MessageDispatchDashboard = lazy(() => import("./MessageDispatchDashboard"));
const SmartLinksDashboard = lazy(() => import("./SmartLinksDashboard"));
const NotificationCenter = lazy(() => import("./NotificationCenter").then(m => ({ default: m.NotificationCenter })));

export default function AdminDashboard() {
  const { currentUser, logout, themeLightBg, themeDarkBg, 
    users,
    entries,
    targets,
    catalog,
    updateCatalog,
    systemUnits,
    monthlyUnitStats,
    notifications,
    markNotificationAsRead,
    deleteNotification,
    isDarkMode,
    setIsDarkMode,
  } = useStore();
  const [activeTab, setActiveTab] = useState<string>(
    currentUser?.role === 'MARKETING' ? "MARKETING" : currentUser?.role === 'FINANCIAL' ? "FINANCE_RESUMO" : currentUser?.role === 'RECEPTION' ? "AVISOS" : "OVERVIEW"
  );
  const [selectedUnit, setSelectedUnit] = useState<string>(() => localStorage.getItem("vans_global_unit") || "ALL");
  const [selectedBarber, setSelectedBarber] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [globalSearch, setGlobalSearch] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const availableUnits = useMemo(() => {
    const list = [...(systemUnits || [])];
    const statUnitIds = new Set(monthlyUnitStats?.map(s => s.unitId).filter(Boolean));
    statUnitIds.forEach(id => {
      if (!list.find(u => u.id === id) && id !== 'ALL') {
        list.push({ id, name: id });
      }
    });
    const userUnitIds = new Set(users?.map(u => u.unit).filter(Boolean));
    userUnitIds.forEach(id => {
      if (!list.find(u => u.id === id) && id !== 'ALL') {
         list.push({ id: id as string, name: id as string });
      }
    });
    return list;
  }, [systemUnits, monthlyUnitStats, users]);

  useEffect(() => {
    localStorage.setItem("vans_global_unit", selectedUnit);
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedUnit !== "ALL" && availableUnits.length > 0 && !availableUnits.some(unit => unit.id === selectedUnit)) {
      setSelectedUnit("ALL");
    }
  }, [availableUnits, selectedUnit]);


  const barbers = users.filter(
    (u) =>
      (u.role === "BARBER" || u.role === "MANICURE") &&
      (selectedUnit === "ALL" || u.unit === selectedUnit),
  );

  // Compute stat function dynamically based on catalog
  const getStatsForBarber = (userId: string) => {
    let totals: Record<string, number> = {};
    catalog.forEach((c) => (totals[c.id] = 0));

    let daysWorked = 0;
    let daysOff = 0;
    let clientsServedCount = 0;
    let uniqueClientsServedCount = 0;

    entries
      .filter((e) => e.userId === userId)
      .forEach((e) => {
        const { workedCount, offCount } = getPeriodDaysInfo(e.date, e.isDayOff, e.workedDays);
        daysWorked += workedCount;
        daysOff += offCount;

        if (!e.isDayOff) {
          clientsServedCount += e.clientsServed || 0;
          uniqueClientsServedCount +=
            e.uniqueClientsServed || e.clientsServed || 0;
          Object.keys(e.items).forEach((k) => {
            if (totals[k] !== undefined && e.items[k]) {
              totals[k] += e.items[k].commission;
            }
          });
        }
      });

    return {
      totals,
      daysWorked,
      daysOff,
      clientsServedCount,
      uniqueClientsServedCount,
    };
  };

  const allNavItems: AdminNavItem[] = [
    { id: "OVERVIEW", label: "Visão Geral", section: "Principal", icon: LayoutDashboard },
    { 
      id: "FINANCE", 
      label: "Financeiro",
      section: "Financeiro",
      icon: PieChart,
      subItems: [
        { id: "FINANCE_RESUMO", label: "Resumo" },
        { id: "FINANCE_CAIXA", label: "Caixa & Contas" },
        { id: "FINANCE_CONCILIACAO_FINTECH", label: "Conciliação" },
        { id: "FINANCE_CONCILIACAO", label: "Conciliação OFX" },
        { id: "FINANCE_RECEBIMENTOS", label: "Baixa de Recebimentos" },
        { id: "FINANCE_DESPESAS", label: "Baixa de Despesas" }
      ]
    },
    { id: "PAYMENTS", label: "Pagamentos", section: "Financeiro", icon: DollarSign },
    { id: "BARBERS", label: "Barbeiros e Metas", section: "Operação", icon: TrendingUp },
    { 
      id: "MANAGEMENT", 
      label: "Análises",
      section: "Operação",
      icon: Briefcase,
      subItems: [
        { id: "MANAGEMENT_SVA", label: "SVA" },
        { id: "MANAGEMENT_UNITS", label: "Análise de Unidades" },
        { id: "MANAGEMENT_BARBERS", label: "Análise de Barbeiros" }
      ]
    },
    { id: "AVISOS", label: "Mural de Avisos", section: "Operação", icon: Megaphone },
    { id: "MESSAGES", label: "Disparo de Mensagens", section: "Operação", icon: MessagesSquare },
    { id: "SMART_LINKS", label: "Links Inteligentes", section: "Operação", icon: Link2 },
    { 
      id: "CATALOG", 
      label: "Catálogo", 
      section: "Cadastros",
      icon: BookOpen,
      subItems: [
        { id: "CATALOG_PRODUCTS", label: "Produtos" },
        { id: "CATALOG_SERVICES", label: "Serviços" },
        { id: "CATALOG_CATEGORIES", label: "Categorias" }
      ]
    },
    { id: "MARKETING", label: "Marketing", section: "Análises", icon: BarChart3 },
    { 
      id: "USERS", 
      label: "Equipe e Unidades",
      section: "Cadastros",
      icon: Users,
      subItems: [
        { id: "USERS_STAFF", label: "Colaboradores" },
        { id: "USERS_RECEPTION", label: "Recepção" },
        { id: "USERS_MANAGEMENT", label: "Gerência" },
        { id: "USERS_UNITS", label: "Unidades" }
      ]
    },
    { id: "REPORTS", label: "Relatórios", section: "Dados", icon: FileText },
    { id: "IMPORT", label: "Importações", section: "Dados", icon: Upload },
    { id: "CONFIG", label: "Configurações", section: "Sistema", icon: Settings },
    { id: "NOTIFICATIONS", label: "Central de Notificações", section: "Sistema", icon: Bell },
  ];

  const navItems = currentUser?.role === 'FINANCIAL' 
    ? allNavItems.filter(item => item.id === "FINANCE" || item.id === "REPORTS" || item.id === "PAYMENTS" || item.id === "CONFIG" || item.id === "NOTIFICATIONS")
    : currentUser?.role === 'MARKETING'
    ? allNavItems.filter(item => item.id === "MARKETING" || item.id === "MESSAGES" || item.id === "SMART_LINKS" || item.id === "CONFIG" || item.id === "NOTIFICATIONS")
    : currentUser?.role === 'RECEPTION'
    ? allNavItems.filter(item => item.id === "AVISOS" || item.id === "MESSAGES" || item.id === "SMART_LINKS" || item.id === "CONFIG" || item.id === "NOTIFICATIONS")
    : allNavItems;

  const navSections = useMemo(
    () => Array.from(new Set(navItems.map(item => item.section))),
    [navItems],
  );

  const searchableNavigation = useMemo(
    () => navItems.flatMap(item => [
      ...(item.subItems || []).map(subItem => ({ id: subItem.id, label: subItem.label, group: item.label })),
      ...(!item.subItems ? [{ id: item.id, label: item.label, group: item.section }] : []),
    ]),
    [navItems],
  );


  const activeNavigation = searchableNavigation.find(item => item.id === activeTab);
  const activeTitle = activeNavigation?.label || "Van's Management";
  const activeGroup = activeNavigation?.group || "Área de trabalho";
  const userNotifications = useMemo(
    () => (notifications || [])
      .filter(notification => notification.userId === currentUser?.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications, currentUser?.id],
  );
  const unreadCount = userNotifications.filter(notification => !notification.read).length;
  const userInitials = (currentUser?.name || "Usuário")
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  const navigateTo = (tabId: string) => {
    setActiveTab(tabId);
    setGlobalSearch("");
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`h-[100dvh] overflow-hidden w-full ${themeLightBg || "bg-gray-50"} ${themeDarkBg || "dark:bg-zinc-950"} text-gray-600 dark:text-zinc-300 flex transition-colors`}>
      
      {/* Desktop Sidebar */}
      <aside className={cn(
        "app-sidebar hidden h-full shrink-0 flex-col overflow-y-auto border-r border-gray-200/80 bg-white transition-[width] duration-300 dark:border-zinc-800 dark:bg-[#061b1b] xl:flex app-scrollbar",
        isSidebarCollapsed ? "w-[76px]" : "w-[248px]",
      )}>
        {/* Sidebar Header */}
        <div className="app-sidebar sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-white/5 dark:bg-[#061b1b]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <img src="/logo-escura.png" alt="Van's Logo" className="block dark:hidden w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
              <img src="/logo-clara.png" alt="Van's Logo" className="hidden dark:block w-8 h-8 object-contain shrink-0" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-gray-950 dark:text-white">Van's Management</span>
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--theme-color)]">Gestão integrada</span>
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
        <nav className="flex-1 px-3 py-4">
          {navSections.map(section => (
            <div key={section} className="mb-5 last:mb-0">
              {!isSidebarCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-600">
                  {section}
                </p>
              )}
              <div className="space-y-1">
          {navItems.filter(item => item.section === section).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.subItems && item.subItems.some((sub: any) => sub.id === activeTab));
            return (
              <div key={item.id} className="w-full">
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setExpandedMenus(prev => {
                        const isCurrentlyActive = item.subItems!.some((sub: any) => sub.id === activeTab);
                        const currentExpanded = prev[item.id] !== undefined ? prev[item.id] : isCurrentlyActive;
                        const nextExpanded = !currentExpanded;
                        
                        if (nextExpanded && !isCurrentlyActive) {
                          setActiveTab(item.subItems![0].id);
                        }
                        
                        return { ...prev, [item.id]: nextExpanded };
                      });
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive && !item.subItems
                      ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)] shadow-sm"
                    : isActive && item.subItems
                      ? "text-gray-950 dark:text-white font-extrabold"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[var(--theme-color)]" : "text-gray-400 transition group-hover:text-gray-700 dark:text-zinc-500 dark:group-hover:text-zinc-200"}`} />
                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>
                  {item.subItems && !isSidebarCollapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${(expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}`} />
                  )}
                </button>
                {item.subItems && (expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) && !isSidebarCollapsed && (
                  <div className="ml-[21px] mt-1 space-y-0.5 border-l border-gray-200 pl-3 dark:border-white/10">
                    {item.subItems.map(subItem => (
                      <button
                        key={subItem.id}
                        onClick={() => navigateTo(subItem.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-[13px] transition-all ${
                          activeTab === subItem.id 
                            ? "bg-[var(--theme-color)]/10 font-extrabold text-[var(--theme-color)]"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-white"
                        }`}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="flex flex-col gap-1 border-t border-gray-200 p-3 dark:border-white/5">
          
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-zinc-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!isSidebarCollapsed && <span>{isSidebarCollapsed ? 'Expandir' : 'Recolher'}</span>}
          </button>

        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-workspace flex-1 flex flex-col min-w-0 h-full overflow-y-auto">

        {/* Desktop Global Header */}
        <header className="app-global-header sticky top-0 z-30 hidden h-[72px] shrink-0 items-center gap-3 border-b border-gray-200/80 bg-white/95 px-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#031818]/95 xl:flex xl:px-6">
          <div className="ml-auto" />

          <div className="relative">
            <AppIconButton
              label="Notificações"
              onClick={() => {
                setIsNotificationsOpen(open => !open);
                setIsProfileOpen(false);
              }}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#041616]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </AppIconButton>
            {isNotificationsOpen && (
              <div className="absolute right-0 top-12 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-black text-gray-950 dark:text-white">Notificações</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{unreadCount} não lidas</p>
                  </div>
                  <Bell className="h-5 w-5 text-[var(--theme-color)]" />
                </div>
                <div className="max-h-80 overflow-y-auto app-scrollbar">
                  {userNotifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Você não possui notificações.</p>
                  ) : userNotifications.slice(0, 12).map(notification => (
                    <button
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) markNotificationAsRead(notification.id);
                        if (notification.actionTab) {
                           setActiveTab(notification.actionTab);
                           setIsNotificationsOpen(false);
                        }
                      }}
                      className={cn(
                        "group w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-0 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800",
                        !notification.read && "bg-[var(--theme-color)]/[0.045]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-color)]/10 text-lg">
                           {notification.icon || "🔔"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-1">
                            <span className="block truncate text-sm font-bold text-gray-900 dark:text-zinc-100">{notification.title}</span>
                            <span className="shrink-0 text-[10px] text-gray-400">{new Date(notification.createdAt).toLocaleDateString('pt-BR')}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{notification.message}</span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={event => {
                            event.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.stopPropagation();
                              deleteNotification(notification.id);
                            }
                          }}
                          className="invisible rounded-md px-1.5 py-0.5 text-[10px] font-bold text-red-500 group-hover:visible focus:visible"
                        >
                          Excluir
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-2 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setActiveTab("NOTIFICATIONS");
                      setIsNotificationsOpen(false);
                    }}
                    className="w-full rounded-xl py-2 text-center text-xs font-bold text-[var(--theme-color)] transition hover:bg-[var(--theme-color)]/10"
                  >
                    Ver todas as notificações
                  </button>
                </div>
              </div>
            )}
          </div>

          <AppIconButton label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"} onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </AppIconButton>

          <div className="relative">
            <button
              onClick={() => {
                setIsProfileOpen(open => !open);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-2.5 rounded-xl p-1.5 pr-2 text-left transition hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--theme-color)]/15 text-xs font-black text-[var(--theme-color)] ring-1 ring-[var(--theme-color)]/20">
                {userInitials}
              </span>
              <span className="hidden max-w-36 2xl:block">
                <span className="block truncate text-xs font-black text-gray-950 dark:text-white">{currentUser?.name}</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{currentUser?.role}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-gray-400 2xl:block" />
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-3 px-3 py-3">
                  <UserCircle2 className="h-8 w-8 text-gray-400 dark:text-zinc-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-gray-950 dark:text-white">{currentUser?.name}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-zinc-500">{currentUser?.email || "Acesso interno"}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  Sair do sistema
                </button>
              </div>
            )}
          </div>
        </header>
        
        {/* Mobile Header */}
        <header className="app-global-header sticky top-0 z-40 border-b border-gray-200 bg-white/95 text-gray-900 backdrop-blur-xl dark:border-zinc-800 dark:bg-[#041616]/95 dark:text-zinc-100 xl:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo-escura.png" alt="Van's Logo" className="block dark:hidden w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <img src="/logo-clara.png" alt="Van's Logo" className="hidden dark:block w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[var(--theme-color)]">{activeGroup}</p>
                <h1 className="truncate text-sm font-black">{activeTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            <div className="relative min-w-0 flex-1">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
              <select
                value={selectedUnit}
                onChange={event => setSelectedUnit(event.target.value)}
                aria-label="Unidade ativa"
                className={cn(appControlClass, "w-full appearance-none pl-9 pr-8")}
              >
                <option value="ALL">Todas as unidades</option>
                {availableUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </div>
            <AppIconButton
              label="Buscar no sistema"
              onClick={() => {
                setIsMobileMenuOpen(true);
                requestAnimationFrame(() => document.getElementById("mobile-navigation-search")?.focus());
              }}
            >
              <Search className="h-[18px] w-[18px]" />
            </AppIconButton>
          </div>
          {isMobileMenuOpen && (
            <div className="app-sidebar absolute z-50 max-h-[calc(100dvh-120px)] w-full overflow-y-auto border-t border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#061b1b] app-scrollbar">
              <div className="flex flex-col space-y-1 px-2 py-2">
                <div className="relative mb-2 px-2 pt-1">
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                  <input
                    id="mobile-navigation-search"
                    value={globalSearch}
                    onChange={event => setGlobalSearch(event.target.value)}
                    placeholder="Buscar páginas..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm font-medium outline-none focus:border-[var(--theme-color)] focus:ring-2 focus:ring-[var(--theme-color)]/10 dark:border-zinc-800 dark:bg-white/[0.04]"
                  />
                </div>
                {navItems.filter(item => {
                  const term = globalSearch.trim().toLocaleLowerCase("pt-BR");
                  if (!term) return true;
                  return `${item.label} ${(item.subItems || []).map(subItem => subItem.label).join(" ")}`
                    .toLocaleLowerCase("pt-BR")
                    .includes(term);
                }).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (item.subItems && item.subItems.some((sub: any) => sub.id === activeTab));
                  return (
                    <div key={item.id} className="w-full">
                      <button
                        onClick={() => {
                          if (item.subItems) {
                            setExpandedMenus(prev => {
                              const isCurrentlyActive = item.subItems!.some((sub: any) => sub.id === activeTab);
                              const currentExpanded = prev[item.id] !== undefined ? prev[item.id] : isCurrentlyActive;
                              const nextExpanded = !currentExpanded;
                              
                              if (nextExpanded && !isCurrentlyActive) {
                                setActiveTab(item.subItems![0].id);
                              }
                              
                              return { ...prev, [item.id]: nextExpanded };
                            });
                          } else {
                            navigateTo(item.id);
                          }
                        }}
                        className={`flex w-full justify-between items-center px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                          isActive && !item.subItems
                            ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)]" 
                            : isActive && item.subItems
                            ? "text-gray-900 dark:text-zinc-100"
                            : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${isActive ? "text-[var(--theme-color)]" : ""}`} />
                          {item.label}
                        </div>
                        {item.subItems && (
                          <ChevronDown className={`w-5 h-5 transition-transform ${(expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) ? 'rotate-180 text-[var(--theme-color)]' : 'text-gray-400'}`} />
                        )}
                      </button>
                      {item.subItems && (expandedMenus[item.id] !== undefined ? expandedMenus[item.id] : isActive) && (
                        <div className="mt-1 ml-4 pl-4 border-l-2 border-gray-100 dark:border-zinc-800 space-y-1">
                          {item.subItems.map(subItem => (
                            <button
                              key={subItem.id}
                              onClick={() => {
                                navigateTo(subItem.id);
                              }}
                              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all ${
                                activeTab === subItem.id 
                                  ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)] font-bold" 
                                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                              }`}
                            >
                              {subItem.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-gray-100 dark:border-zinc-800/50 mt-2 pt-2">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Sair
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="app-main-content mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-6 xl:px-7 xl:py-7">
        <Suspense fallback={<AppLoadingState />}>
        {activeTab === "OVERVIEW" ? (
          <OverviewDashboard selectedUnit={selectedUnit} onNavigate={navigateTo} />
        ) : activeTab.startsWith("FINANCE") ? (
          <FinancialDashboard currentTab={activeTab.replace("FINANCE_", "") as any} />
        ) : activeTab === "MANAGEMENT_SVA" ? (
          <GDVDashboard />
        ) : activeTab === "MANAGEMENT_UNITS" ? (
          <UnitsAnalysisDashboard />
        ) : activeTab === "MANAGEMENT_BARBERS" ? (
          <BarbersAnalysisDashboard />
        ) : activeTab === "AVISOS" ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
              <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                📢 Gestão de Avisos & Mural
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                Publique comunicados, regras corporativas, avisos de conquistas ou alertas urgentes direcionados a unidades específicas ou a toda a equipe de barbeiros.
              </p>
            </div>
            <AnnouncementWall />
          </div>
        ) : activeTab === "USERS_STAFF" ? (
          <UsersDashboard tabView="BARBERS" />
        ) : activeTab === "USERS_RECEPTION" ? (
          <UsersDashboard tabView="RECEPTION" />
        ) : activeTab === "USERS_MANAGEMENT" ? (
          <UsersDashboard tabView="MANAGERS" />
        ) : activeTab === "USERS_UNITS" ? (
          <UsersDashboard tabView="UNITS" />
        ) : activeTab === "CONFIG" ? (
          <ConfigEditor />
        ) : activeTab === "NOTIFICATIONS" ? (
          <NotificationCenter onNavigate={setActiveTab} />
        ) : activeTab === "CATALOG_PRODUCTS" ? (
          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="PRODUCTS" />
        ) : activeTab === "CATALOG_SERVICES" ? (
          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="SERVICES" />
        ) : activeTab === "CATALOG_CATEGORIES" ? (
          <CatalogEditor catalog={catalog} updateCatalog={updateCatalog} tabView="CATEGORIES" />
        ) : activeTab === "PAYMENTS" ? (
          <PaymentsTab />
        ) : activeTab === "MARKETING" ? (
          <MarketingDashboard />
        ) : activeTab === "MESSAGES" ? (
          <MessageDispatchDashboard />
        ) : activeTab === "SMART_LINKS" ? (
          <SmartLinksDashboard />
        ) : activeTab === "REPORTS" ? (
          <ReportsTab />
        ) : activeTab === "IMPORT" ? (
          <DataImporterView />
        ) : (
          <div className="flex flex-col md:flex-row gap-8">
            {/* SIDEBAR: BARBER LIST */}
            <aside className="w-full md:w-80 flex-shrink-0 space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  <button
                    onClick={() => setSelectedUnit("ALL")}
                    className={`whitespace-nowrap px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${selectedUnit === "ALL" ? "bg-white dark:bg-zinc-900 shadow text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400"}`}
                  >
                    Geral
                  </button>
                  {availableUnits.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUnit(u.id)}
                      className={`whitespace-nowrap px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${selectedUnit === u.id ? "bg-white dark:bg-zinc-900 shadow text-gray-900 dark:text-zinc-100" : "text-gray-500 dark:text-zinc-400"}`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarber(b)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                        selectedBarber?.id === b.id
                          ? "border-blue-600 ring-1 ring-blue-600 bg-blue-50/50"
                          : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100">
                          {b.name} {b.isActive === false && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase">Inativo</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{" "}
                          {systemUnits?.find(su => su.id === b.unit)?.name || b.unit}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 ${selectedBarber?.id === b.id ? "text-blue-600" : "text-gray-300"}`}
                      />
                    </button>
                  ))}
                  {barbers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-4">
                      Nenhum barbeiro nesta unidade.
                    </p>
                  )}
                </div>
              </div>
            </aside>

            {/* MAIN AREA: SELECTED BARBER DETAILED VIEW */}
            <div className="flex-1 min-w-0">
              {selectedBarber ? (
                <BarberDetailView
                  key={selectedBarber.id}
                  barber={selectedBarber}
                  stats={getStatsForBarber(selectedBarber.id)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 py-20">
                  <Users className="w-12 h-12 mb-4 text-gray-300" />
                  <p>Selecione um barbeiro ao lado para visualizar os dados</p>
                </div>
              )}
            </div>
          </div>
        )}
        </Suspense>
      </main>
      </div>
    </div>
  );
}


function AvisosManager() {
  const { announcements, addAnnouncement, deleteAnnouncement, systemUnits, currentUser } = useStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<'INFO' | 'IMPORTANT' | 'ALERT' | 'CELEBRATION'>("INFO");
  const [unitId, setUnitId] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsLoading(true);
    try {
      const newAnnouncement = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        type,
        unitId,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || "Admin"
      };
      await addAnnouncement(newAnnouncement);
      setTitle("");
      setContent("");
      setType("INFO");
      setUnitId("ALL");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBadgeColor = (t: string) => {
    switch (t) {
      case 'IMPORTANT': return 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50';
      case 'ALERT': return 'bg-red-100 text-red-850 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50';
      case 'CELEBRATION': return 'bg-emerald-100 text-emerald-850 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50';
      default: return 'bg-blue-100 text-blue-850 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50';
    }
  };

  const getLabel = (t: string) => {
    switch (t) {
      case 'IMPORTANT': return 'Importante';
      case 'ALERT': return 'Urgente ⚠️';
      case 'CELEBRATION': return 'Conquista 🎉';
      default: return 'Geral';
    }
  };

  const sortedAnnouncements = useMemo(() => {
    return [...(announcements || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [announcements]);

  const getUnitName = (uid: string) => {
    if (uid === 'ALL') return 'Geral (Todas)';
    return systemUnits.find(u => u.id === uid)?.name || uid;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
      {/* Form Criar aviso */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-805/80 rounded-2xl p-6 shadow-sm h-fit">
        <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-5 flex items-center gap-2">
          <span>📢</span> Criar Novo Comunicado
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Título do Comunicado</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Novo horário de funcionamento"
              required
              className="w-full h-[40px] px-3 text-xs bg-gray-50/50 dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-105 rounded-xl border border-gray-200 dark:border-zinc-800 focus:border-orange-500 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Nível / Categoria</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full h-[40px] px-2 text-xs bg-gray-50/50 dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-105 rounded-xl border border-gray-200 dark:border-zinc-800 focus:border-orange-500 outline-none transition"
              >
                <option value="INFO">Informativo</option>
                <option value="IMPORTANT">Importante</option>
                <option value="ALERT">Urgente</option>
                <option value="CELEBRATION">Celebração 🎉</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Destino</label>
              <select
                value={unitId}
                onChange={e => setUnitId(e.target.value)}
                className="w-full h-[40px] px-2 text-xs bg-gray-50/50 dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-105 rounded-xl border border-gray-200 dark:border-zinc-800 focus:border-orange-500 outline-none transition"
              >
                <option value="ALL">Todas Unidades</option>
                {systemUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-2xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Conteúdo da Mensagem</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escreva as orientações, regras ou avisos..."
              required
              rows={5}
              className="w-full p-3 text-xs bg-gray-50/50 dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-105 rounded-xl border border-gray-200 dark:border-zinc-800 focus:border-orange-500 outline-none transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[42px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-xs tracking-wider rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            Publicar no Mural de Avisos
          </button>
        </form>
      </div>

      {/* Listar avisos */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <span>📝</span> Avisos Publicados ({sortedAnnouncements.length})
        </h3>
        
        {sortedAnnouncements.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-900/40 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
            <span className="block text-lg mb-2">📭</span>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhum comunicado ativo publicado de momento.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {sortedAnnouncements.map(notice => (
              <div
                key={notice.id}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-805 rounded-2xl p-5 shadow-xs relative hover:border-gray-300 dark:hover:border-zinc-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getBadgeColor(notice.type)}`}>
                      {getLabel(notice.type)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                      Destino: {getUnitName(notice.unitId)}
                    </span>
                  </div>
                  
                  <button
                    onClick={async () => {
                      if (confirm("Tem certeza que deseja apagar este comunicado?")) {
                        await deleteAnnouncement(notice.id);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 dark:hover:bg-red-950/20 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-1">{notice.title}</h4>
                <p className="text-xs text-gray-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed mb-4">{notice.content}</p>
                
                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-zinc-500 border-t border-gray-100 dark:border-zinc-800/60 pt-3">
                  <span>Publicado por: <span className="font-bold">{notice.createdBy}</span></span>
                  <span>{new Date(notice.createdAt).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- CATALOG EDITOR ---

function CatalogEditor({
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
  const activeSubTab = tabView === "CATEGORIES" ? catSubTab : "ITEMS";
  const [items, setItems] = useState<CatalogItem[]>(catalog);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    type: string;
    subcategoryId?: string;
    unit?: string;
    visibleToRoles?: Role[];
    price?: number;
  }>({ name: "", type: "SERVICE", subcategoryId: "", unit: "ALL", visibleToRoles: ["BARBER", "MANICURE"], price: 0 });

  // Custom feedback states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Keep items local state in sync when catalog props change
  useEffect(() => {
    setItems(catalog);
  }, [catalog]);

  const handleSave = () => {
    updateCatalog(items);
    triggerToast("Catálogo de serviços e produtos salvo com sucesso!", "success");
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      type: item.type,
      subcategoryId: item.subcategoryId || "",
      unit: item.unit || "ALL",
      visibleToRoles: item.visibleToRoles || ["BARBER", "MANICURE"],
      price: item.price || 0,
    });
  };

  const saveItem = () => {
    const nextItems = items.map((i) => (i.id === editingId ? { ...i, ...editForm } : i));
    setItems(nextItems);
    updateCatalog(nextItems);
    setEditingId(null);
    triggerToast("Item do catálogo editado com sucesso!", "success");
  };

  const deleteItem = (id: string) => {
    const nextItems = items.filter((i) => i.id !== id);
    setItems(nextItems);
    updateCatalog(nextItems);
    setConfirmDeleteId(null);
    triggerToast("Item excluído do catálogo.", "error");
  };

  const addNew = () => {
    const defaultCat = categories.find(c => tabView === "PRODUCTS" ? c.type === "PRODUCT" : (c.type === "SERVICE" || c.type === "SUBSCRIPTION" || !c.type));
    const newItem: CatalogItem = {
      id: "item_" + Date.now(),
      name: "Novo Item",
      type: defaultCat?.id || (tabView === "PRODUCTS" ? "PRODUCT" : "SERVICE"),
      subcategoryId: "",
      unit: "ALL",
      visibleToRoles: ["BARBER", "MANICURE"],
      price: 0,
    };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    updateCatalog(nextItems);
    startEdit(newItem);
    triggerToast("Novo item inserido. Configure-o abaixo:", "info");
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 animate-in fade-in duration-300 relative">
      {/* Absolute Toast */}
      {toast && (
        <div className="absolute top-4 right-6 z-50 flex items-center gap-2 bg-[var(--theme-color)] text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-bounce transition-all">
          <span>{toast.message}</span>
        </div>
      )}

      {/* Inline Confirm Dialog Card */}
      {confirmDeleteId && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <p className="text-sm text-red-800 dark:text-red-400 font-semibold text-center md:text-left">
            Deseja realmente remover este item? Isso removerá a visualização no controle dos barbeiros e histórico de lançamentos.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="px-3.5 py-1.5 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteItem(confirmDeleteId)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow"
            >
              Confirmar Exclusão
            </button>
          </div>
        </div>
      )}
      {/* Header with Title and Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Configurações de Catálogo e Estrutura
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Adicione ou edite os serviços, produtos, categorias e subcategorias.
          </p>
        </div>
        {activeSubTab === "ITEMS" && (
          <div className="flex gap-4">
            <button
              onClick={addNew}
              className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 px-4 py-2 rounded-lg font-semibold transition"
            >
              <Plus className="w-4 h-4" /> Adicionar Item
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white px-4 py-2 rounded-lg font-semibold shadow transition"
            >
              Salvar Mudanças
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs Selection */}
      {tabView === "CATEGORIES" && (
        <div className="flex gap-4 border-b mb-6 overflow-x-auto">
          <button
            onClick={() => setCatSubTab("CATEGORIES")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === "CATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}`}
          >
            Categorias
          </button>
          <button
            onClick={() => setCatSubTab("SUBCATEGORIES")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeSubTab === "SUBCATEGORIES" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:text-zinc-300"}`}
          >
            Subcategorias
          </button>
        </div>
      )}

      {activeSubTab === "ITEMS" ? (
        <div className="divide-y border rounded-xl overflow-hidden shadow-sm">
          {items.filter((item) => {
             const cat = categories.find(c => c.id === item.type);
             const typeMatch = cat?.type || (item.type === "PRODUCT" ? "PRODUCT" : "SERVICE");
             if (tabView === "PRODUCTS") return typeMatch === "PRODUCT";
             return typeMatch === "SERVICE" || typeMatch === "SUBSCRIPTION";
          }).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 transition group"
            >
              {editingId === item.id ? (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <input
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-full"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      placeholder="Nome do Item"
                    />
                    <input
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 md:w-32"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.price === 0 ? "" : editForm.price}
                      onChange={(e) =>
                        setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="R$ 0,00"
                    />
                    <select
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
                      {categories.filter(c => tabView === "PRODUCTS" ? c.type === "PRODUCT" : (c.type === "SERVICE" || c.type === "SUBSCRIPTION" || !c.type)).map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-full md:w-48"
                      value={editForm.subcategoryId || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          subcategoryId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Sem Subcategoria</option>
                      {subcategories
                        .filter((sub) => sub.categoryId === editForm.type)
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                    </select>

                    <select
                      className="border border-gray-300 dark:border-zinc-700 p-2 rounded-md font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-full md:w-48"
                      value={editForm.unit || "ALL"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          unit: e.target.value,
                        })
                      }
                    >
                      <option value="ALL">Todas as Unidades</option>
                      {availableUnits.map((su) => (
                        <option key={su.id} value={su.id}>
                          {su.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg border border-gray-100 dark:border-zinc-700">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase">
                        Visibilidade por Perfil:
                      </span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.visibleToRoles?.includes("BARBER")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const currentRoles = editForm.visibleToRoles || [];
                              const nextRoles = checked 
                                ? [...currentRoles.filter(r => r !== "BARBER"), "BARBER"] 
                                : currentRoles.filter(r => r !== "BARBER");
                              setEditForm({ ...editForm, visibleToRoles: nextRoles as Role[] });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-[var(--theme-color)] dark:bg-zinc-900 dark:border-zinc-700"
                          />
                          Barbeiro
                        </label>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.visibleToRoles?.includes("MANICURE")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const currentRoles = editForm.visibleToRoles || [];
                              const nextRoles = checked 
                                ? [...currentRoles.filter(r => r !== "MANICURE"), "MANICURE"] 
                                : currentRoles.filter(r => r !== "MANICURE");
                              setEditForm({ ...editForm, visibleToRoles: nextRoles as Role[] });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-[var(--theme-color)] dark:bg-zinc-900 dark:border-zinc-700"
                          />
                          Manicure
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={saveItem}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-1.5 rounded-md font-semibold transition"
                    >
                      OK
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-300">
                      <Grip className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-zinc-100 leading-none">
                        {item.name}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-250 text-gray-500 dark:text-zinc-400 inline-block px-2.5 py-1 rounded-md border border-gray-200 dark:border-zinc-800">
                          {categories.find((c) => c.id === item.type)?.name ||
                            item.type}
                        </span>
                        {item.price !== undefined && item.price > 0 && (
                          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 inline-block px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                            {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        )}
                        {item.subcategoryId && (
                          <span className="text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 inline-block px-2.5 py-1 rounded-md border border-purple-100 dark:border-purple-900/30">
                            {subcategories.find(
                              (s) => s.id === item.subcategoryId,
                            )?.name || item.subcategoryId}
                          </span>
                        )}
                        {item.unit && item.unit !== "ALL" && (
                          <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 inline-block px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/30">
                            {systemUnits?.find(su => su.id === item.unit)?.name || item.unit}
                          </span>
                        )}
                        {item.visibleToRoles && item.visibleToRoles.length > 0 ? (
                          <span className="text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 inline-block px-2.5 py-1 rounded-md border border-amber-100 dark:border-amber-900/30">
                            Perfis: {item.visibleToRoles.map(r => r === 'BARBER' ? 'Barbeiro' : r === 'MANICURE' ? 'Manicure' : r).join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold bg-gray-100 text-gray-550 inline-block px-2.5 py-1 rounded-md border border-gray-200 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-400">
                            Todos os Perfis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 text-gray-400 dark:text-zinc-500 hover:text-[var(--theme-color-strong)] transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-2 text-gray-400 dark:text-zinc-500 hover:text-red-600 transition"
                      title="Excluir item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center p-8 text-gray-500 dark:text-zinc-400">
              Nenhum item cadastrado.
            </p>
          )}
        </div>
      ) : activeSubTab === "CATEGORIES" ? (
        <CategoriesTab />
      ) : (
        <SubcategoriesTab />
      )}
    </div>
  );
}

function CategoriesTab() {
  const { categories, updateCategories, catalog, subcategories } = useStore();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<'SERVICE' | 'PRODUCT' | 'SUBSCRIPTION'>('SERVICE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<'SERVICE' | 'PRODUCT' | 'SUBSCRIPTION'>('SERVICE');

  const [errorText, setErrorText] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newCat = {
      id: "cat_" + Date.now(),
      name: newName.trim(),
      type: newType,
    };
    updateCategories([...categories, newCat]);
    setNewName("");
  };

  const handleStartEdit = (id: string, name: string, type?: 'SERVICE' | 'PRODUCT' | 'SUBSCRIPTION') => {
    setEditingId(id);
    setEditingName(name);
    setEditingType(type || 'SERVICE');
  };

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim()) return;
    updateCategories(
      categories.map((c) =>
        c.id === id ? { ...c, name: editingName.trim(), type: editingType } : c,
      ),
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (["SERVICE", "EXTRA_SERVICE", "PRODUCT"].includes(id)) {
      setErrorText(
        "Esta categoria é do sistema padrão e não pode ser removida para não desestruturar o histórico de objetivos e relatórios.",
      );
      setTimeout(() => setErrorText(null), 6000);
      return;
    }
    const usedInCatalog = catalog.some((item) => item.type === id);
    const hasSubcategories = subcategories.some((sub) => sub.categoryId === id);
    
    let message = "Deseja realmente excluir esta categoria?";
    if (usedInCatalog || hasSubcategories) {
      message = "Esta categoria possui subcategorias ou itens vinculados no catálogo. Se você a excluir, todas as subcategorias vinculadas serão removidas do banco de dados e os itens relacionados serão listados como 'Sem Subcategoria'. Deseja prosseguir?";
    }

    setConfirmDeleteId(id);
    setConfirmDeleteMessage(message);
  };

  return (
    <div className="space-y-6 relative">
      {/* Inline Non-Blocking Error Alert */}
      {errorText && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <p className="text-sm font-semibold">{errorText}</p>
          <button onClick={() => setErrorText(null)} className="text-amber-600 dark:text-amber-500 font-bold hover:text-amber-800 text-xs uppercase p-1">Fechar</button>
        </div>
      )}

      {/* Inline Sliding Confirmation Alert */}
      {confirmDeleteId && (
        <div className="p-4 bg-red-50 dark:bg-red-950/25 border border-red-150 dark:border-red-900/40 text-red-800 dark:text-red-400 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <p className="text-sm font-semibold text-center md:text-left">{confirmDeleteMessage}</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setConfirmDeleteId(null); setConfirmDeleteMessage(null); }} className="px-3 py-1.5 border hover:bg-gray-100 dark:hover:bg-zinc-800 dark:border-zinc-800 rounded-lg text-xs font-bold text-gray-550 dark:text-zinc-400">Cancelar</button>
            <button onClick={() => { updateCategories(categories.filter((c) => c.id !== confirmDeleteId)); setConfirmDeleteId(null); setConfirmDeleteMessage(null); }} className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm">Confirmar</button>
          </div>
        </div>
      )}
      <form
        onSubmit={handleAdd}
        className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row gap-3 items-end"
      >
        <div className="flex-1 min-w-0 w-full">
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">
            Nome da Nova Categoria
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Bebidas, Pomadas, Cursos"
            className="w-full border border-gray-300 dark:border-zinc-700 p-2 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-[var(--theme-color)] font-medium text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">
            Tipo de Categoria
          </label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as any)}
            className="w-full border border-gray-300 dark:border-zinc-700 p-2 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-[var(--theme-color)] font-medium text-sm text-gray-900 dark:text-zinc-100"
          >
            <option value="SERVICE">Serviço</option>
            <option value="PRODUCT">Produto / Bebida</option>
            <option value="SUBSCRIPTION">Assinatura</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white font-semibold py-2.5 px-5 rounded-lg text-sm flex items-center gap-1.5 transition self-stretch md:self-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </form>

      <div className="border rounded-xl divide-y overflow-hidden max-h-96 overflow-y-auto">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between p-4 hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 transition"
          >
            {editingId === cat.id ? (
              <div className="flex-1 flex flex-col md:flex-row gap-2 items-center">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-zinc-700 p-1.5 px-3 rounded text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium"
                />
                <select
                  value={editingType}
                  onChange={(e) => setEditingType(e.target.value as any)}
                  className="w-full md:w-36 border border-gray-300 dark:border-zinc-700 p-1.5 rounded text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                >
                  <option value="SERVICE">Serviço</option>
                  <option value="PRODUCT">Produto</option>
                  <option value="SUBSCRIPTION">Assinatura</option>
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSaveEdit(cat.id)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-bold px-3 py-1.5 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                    {cat.name}
                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      cat.type === 'PRODUCT' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-400' 
                        : cat.type === 'SUBSCRIPTION'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/35 dark:text-blue-400'
                    }`}>
                      {cat.type === 'PRODUCT' ? 'Produto' : cat.type === 'SUBSCRIPTION' ? 'Assinatura' : 'Serviço'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">ID: {cat.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(cat.id, cat.name, cat.type)}
                    className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-[var(--theme-color-strong)] rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {!["SERVICE", "EXTRA_SERVICE", "PRODUCT"].includes(
                    cat.id,
                  ) && (
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubcategoriesTab() {
  const { categories, subcategories, updateSubcategories, catalog } =
    useStore();
  const [newName, setNewName] = useState("");
  const [parentCatId, setParentCatId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingParentId, setEditingParentId] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<string | null>(null);

  // Set default parent category
  useEffect(() => {
    if (categories.length > 0 && !parentCatId) {
      setParentCatId(categories[0].id);
    }
  }, [categories, parentCatId]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !parentCatId) return;
    const newSub = {
      id: "sub_" + Date.now(),
      name: newName.trim(),
      categoryId: parentCatId,
    };
    updateSubcategories([...subcategories, newSub]);
    setNewName("");
  };

  const handleStartEdit = (sub: Subcategory) => {
    setEditingId(sub.id);
    setEditingName(sub.name);
    setEditingParentId(sub.categoryId);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim() || !editingParentId) return;
    updateSubcategories(
      subcategories.map((s) =>
        s.id === id
          ? { ...s, name: editingName.trim(), categoryId: editingParentId }
          : s,
      ),
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const usedInCatalog = catalog.some((item) => item.subcategoryId === id);
    let message = "Deseja realmente excluir esta subcategoria?";
    if (usedInCatalog) {
      message = "Esta subcategoria está associada a itens do catálogo. Se você excluí-la, essa associação de categoria será limpa. Deseja prosseguir?";
    }

    setConfirmDeleteId(id);
    setConfirmDeleteMessage(message);
  };

  return (
    <div className="space-y-6 relative">
      {/* Inline sliding confirmation block */}
      {confirmDeleteId && (
        <div className="p-4 bg-red-50 dark:bg-red-950/25 border border-red-150 dark:border-red-900/40 text-red-800 dark:text-red-400 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
          <p className="text-sm font-semibold text-center md:text-left">{confirmDeleteMessage}</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setConfirmDeleteId(null); setConfirmDeleteMessage(null); }} className="px-3 py-1.5 border hover:bg-gray-100 dark:hover:bg-zinc-800 dark:border-zinc-800 rounded-lg text-xs font-bold text-gray-550 dark:text-zinc-400">Cancelar</button>
            <button onClick={() => { updateSubcategories(subcategories.filter((s) => s.id !== confirmDeleteId)); setConfirmDeleteId(null); setConfirmDeleteMessage(null); }} className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm">Confirmar</button>
          </div>
        </div>
      )}
      <form
        onSubmit={handleAdd}
        className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">
            Categoria Mãe
          </label>
          <select
            value={parentCatId}
            onChange={(e) => setParentCatId(e.target.value)}
            className="w-full border border-gray-300 dark:border-zinc-700 p-2 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[var(--theme-color)] font-semibold text-sm"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-2">
            Nome do Nova Subcategoria
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Degradê, Pigmentação, Importados"
            className="w-full border border-gray-300 dark:border-zinc-700 p-2 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[var(--theme-color)] font-medium text-sm placeholder-gray-400"
          />
        </div>
        <button
          type="submit"
          className="bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white font-semibold py-2.5 px-5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" /> Adicionar Subcategoria
        </button>
      </form>

      <div className="border rounded-xl divide-y overflow-hidden max-h-96 overflow-y-auto">
        {subcategories.map((sub) => {
          const categoryName =
            categories.find((c) => c.id === sub.categoryId)?.name ||
            "Sem Categoria";
          return (
            <div
              key={sub.id}
              className="flex items-center justify-between p-4 hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 transition"
            >
              {editingId === sub.id ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={editingParentId}
                    onChange={(e) => setEditingParentId(e.target.value)}
                    className="border border-gray-300 dark:border-zinc-700 p-1 px-3 rounded text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-semibold"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="border border-gray-300 dark:border-zinc-700 p-1 px-3 rounded text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleSaveEdit(sub.id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1 rounded"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-bold px-3 py-1 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                      {sub.name}
                    </p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                        Categoria: {categoryName}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
                        ID: {sub.id}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartEdit(sub)}
                      className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-[var(--theme-color-strong)] rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- BARBER DETAIL VIEW ---

function BarberDetailView({ barber, stats }: { barber: User; stats: any }) {
  const {
    updateUser,
    targets,
    updateTarget,
    entries,
    deleteEntry,
    updateEntry,
    catalog: rawCatalog,
    categories,
    subcategories,
    systemUnits,
  } = useStore();

  const catalog = useMemo(() => {
    if (!barber) return rawCatalog;
    return rawCatalog.filter((item) => {
      if (item.visibleToRoles && item.visibleToRoles.length > 0) {
        return item.visibleToRoles.includes(barber.role);
      }
      return true;
    });
  }, [rawCatalog, barber]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initialize generic target structure if not present
  const defaultItemsTarget: Record<string, number> = {};
  catalog.forEach((c) => (defaultItemsTarget[c.id] = 0));

  const target: Target = targets[barber.id] || {
    items: defaultItemsTarget,
    clientsServed: 0,
    uniqueClientsServed: 0,
  };

  const barberEntries = entries
    .filter((e) => e.userId === barber.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const {
    totalTargetValue,
    totalAchievedValue,
    totalMissingValue,
    totalPercentage,
  } = React.useMemo(() => {
    const targetItems = target?.items || {};
    let totalTarget = 0;
    let totalAchieved = 0;

    Object.entries(targetItems).forEach(([itemId, val]) => {
      if (itemId === 'meta_extra_geral' || itemId === 'meta_produto_geral') return; // Handled below
      
      const catItem = catalog.find(c => c.id === itemId);
      if (catItem && (catItem.type === 'EXTRA_SERVICE' || catItem.type === 'PRODUCT')) {
        return; // ignore old individual targets
      }

      totalTarget += val || 0;
      totalAchieved += stats.totals[itemId] || 0;
    });
    
    // Always include the new EXTRA_SERVICE logic
    const extrasTarget = targetItems['meta_extra_geral'] || 0;
    const extrasAchieved = catalog.filter(c => c.type === 'EXTRA_SERVICE').reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
    
    // Always include the new PRODUCT logic
    const productTarget = targetItems['meta_produto_geral'] || 0;
    const productAchieved = catalog.filter(c => c.type === 'PRODUCT').reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
    
    totalTarget += extrasTarget + productTarget;
    totalAchieved += extrasAchieved + productAchieved;

    const totalMissing = Math.max(0, totalTarget - totalAchieved);
    const totalPercent =
      totalTarget > 0
        ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100))
        : 0;
    return {
      totalTargetValue: totalTarget,
      totalAchievedValue: totalAchieved,
      totalMissingValue: totalMissing,
      totalPercentage: totalPercent,
    };
  }, [target, stats.totals, catalog]);

  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [editForm, setEditForm] = useState<Target>(target);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    name: barber.name,
    password: barber.password,
    unit: barber.unit,
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [expandedEntries, setExpandedEntries] = useState<
    Record<string, boolean>
  >({});

  const toggleEntryExpanded = (entryId: string) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  const getEntryDaysList = (dateStr: string) => {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(P[1-4])$/);
    if (!match) return [];
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const periodId = match[3];
    return getDaysForPeriod(year, month, periodId);
  };

  const [adminNotes, setAdminNotes] = useState(barber.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  useEffect(() => {
    setEditProfileForm({
      name: barber.name,
      password: barber.password,
      unit: barber.unit,
    });
    setAdminNotes(barber.notes || "");
    setShowSavedFeedback(false);
    setExpandedEntries({});
  }, [barber]);

  const handleSaveTargets = () => {
    updateTarget(barber.id, editForm);
    setIsEditingTargets(false);
  };

  const handleSaveProfile = () => {
    updateUser({ ...barber, ...editProfileForm });
    setIsEditingProfile(false);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300 opacity-100">
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col items-start justify-between gap-4">
        <div className="flex w-full justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{barber.name}</h2>
            <p className="text-gray-500 dark:text-zinc-400 font-medium flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4" /> Unidade{" "}
              {systemUnits?.find(su => su.id === barber.unit)?.name || barber.unit}
            </p>
          </div>

          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <Edit3 className="w-4 h-4" /> Editar Perfil
          </button>
        </div>

        {isEditingProfile && (
          <div className="w-full bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 mt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={editProfileForm.name}
                  onChange={(e) =>
                    setEditProfileForm({
                      ...editProfileForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] outline-none bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                  Senha (Pode Redefinir)
                </label>
                <input
                  type="text"
                  value={editProfileForm.password}
                  onChange={(e) =>
                    setEditProfileForm({
                      ...editProfileForm,
                      password: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] outline-none bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 placeholder-zinc-500"
                  placeholder="Nova senha"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                  Unidade
                </label>
                <select
                  value={editProfileForm.unit}
                  onChange={(e) =>
                    setEditProfileForm({
                      ...editProfileForm,
                      unit: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] outline-none bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                >
                  {(systemUnits || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 font-medium text-gray-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border rounded-lg shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 font-bold text-white bg-[var(--theme-color)] rounded-lg shadow-md hover:bg-[var(--theme-color-strong)]"
              >
                Salvar Perfil
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-center mt-2">
          <div className="bg-blue-50 dark:bg-blue-900/10 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-xs font-semibold text-blue-700 uppercase">
              Dias Tr.
            </p>
            <p className="text-xl font-bold text-blue-900">
              {stats.daysWorked}
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase">
              Períodos Fl.
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{stats.daysOff}</p>
          </div>
          <div className="bg-purple-50 px-4 py-3 rounded-xl border border-purple-100 text-left min-w-[140px]">
            <div className="flex justify-between items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-purple-700 uppercase">
                Distintos
              </p>
              <span className="text-xs font-bold text-purple-700 bg-purple-200 px-1.5 py-0.5 rounded">
                {target.uniqueClientsServed > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (stats.uniqueClientsServedCount /
                          target.uniqueClientsServed) *
                          100,
                      ),
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-xl font-bold text-purple-900 leading-none">
              {stats.uniqueClientsServedCount}{" "}
              <span className="text-sm font-medium">
                / {target.uniqueClientsServed}
              </span>
            </p>
            {target.uniqueClientsServed > stats.uniqueClientsServedCount ? (
              <p className="text-[10px] text-purple-800 mt-1 font-medium">
                Faltam{" "}
                {target.uniqueClientsServed - stats.uniqueClientsServedCount}
              </p>
            ) : (
              <p className="text-[10px] text-purple-600 font-bold mt-1">
                Objetivo atingido!
              </p>
            )}
          </div>

          {/* SOMA TOTAL DE TODOS OS OBJETIVOS (ADMIN VIEW QUICK BADGE) */}
          <div className="bg-orange-50 px-4 py-3 rounded-xl border border-orange-100 text-left min-w-[200px]">
            <div className="flex justify-between items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-[var(--theme-color)] uppercase">
                Soma Geral Objetivos
              </p>
              <span className="text-xs font-bold text-[var(--theme-color)] bg-orange-200 px-1.5 py-0.5 rounded">
                {totalPercentage}%
              </span>
            </div>
            <p className="text-xl font-bold text-gray-950 leading-none">
              R$ {totalAchievedValue.toFixed(2)}{" "}
              <span className="text-sm font-medium">
                / R$ {totalTargetValue.toFixed(2)}
              </span>
            </p>
            {totalMissingValue > 0 ? (
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-1 font-medium">
                Faltam R$ {totalMissingValue.toFixed(2)}
              </p>
            ) : (
              <p className="text-[10px] text-[var(--theme-color)] font-bold mt-1">
                Objetivo atingido!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* BLOCO DE NOTAS / ANOTAÇÕES SOBRE O BARBEIRO */}
      <div className="bg-amber-50/40 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-200/60 dark:border-amber-700/30 shadow-sm space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                Bloco de Notas do Administrador
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Anotações internas, feedbacks e observações privadas sobre{" "}
                {barber.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {showSavedFeedback && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-in fade-in duration-200">
                <Check className="w-3.5 h-3.5" /> Salvo!
              </span>
            )}
            <button
              onClick={async () => {
                setIsSavingNotes(true);
                await updateUser({ ...barber, notes: adminNotes });
                setIsSavingNotes(false);
                setShowSavedFeedback(true);
                setTimeout(() => setShowSavedFeedback(false), 3000);
              }}
              disabled={isSavingNotes}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingNotes ? "Salvando..." : "Salvar Notas"}
            </button>
          </div>
        </div>

        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder={`Escreva observações privadas e notas sobre a performance, acordos ou comportamento de ${barber.name}...`}
          rows={3}
          className="w-full p-4 border border-amber-200 bg-zinc-900/90 rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y leading-relaxed text-gray-700 dark:text-zinc-200 placeholder-amber-900/30"
        />
      </div>

      <div className="flex items-center justify-between mt-8 mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Performance & Objetivos</h3>
        <button
          onClick={() =>
            isEditingTargets ? handleSaveTargets() : setIsEditingTargets(true)
          }
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            isEditingTargets
              ? "bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white shadow"
              : "bg-white dark:bg-zinc-900 hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 text-gray-700 dark:text-zinc-200 border"
          }`}
        >
          <Settings className="w-4 h-4" />
          {isEditingTargets ? "Salvar Objetivos" : "Editar Objetivos"}
        </button>
      </div>

      {isEditingTargets ? (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border-2 border-blue-200 shadow-md">
          <h4 className="font-bold text-gray-700 dark:text-zinc-200 border-b pb-4 mb-4 text-lg">
            Editar Objetivos de {barber.name}
          </h4>

          <div className="mb-6 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-4 rounded-xl border border-gray-200 dark:border-zinc-800">
            <p className="text-sm font-bold text-gray-600 dark:text-zinc-300 uppercase mb-2">
              CLIENTES DISTINTOS
            </p>
            <input
              type="number"
              min="0"
              step="1"
              value={editForm.uniqueClientsServed || 0}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  uniqueClientsServed: parseInt(e.target.value) || 0,
                })
              }
              className="w-full max-w-[200px] px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.map((cat) => {
              const itemsOfCat = catalog.filter((c) => c.type === cat.id);
              if (itemsOfCat.length === 0) return null;
              
                          if (cat.id === 'EXTRA_SERVICE') {
              return (
                <div key={cat.id} className="space-y-3">
                  <p className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase mb-4">
                    Objetivo {cat.name} (R$)
                  </p>
                  <TargetInput
                    label="Objetivo Geral (Serviços Extras)"
                    val={editForm.items['meta_extra_geral'] || 0}
                    setVal={(v) =>
                      setEditForm({
                        ...editForm,
                        items: { ...editForm.items, ['meta_extra_geral']: v },
                      })
                    }
                  />
                </div>
              );
            }
            
            if (cat.id === 'PRODUCT') {
              return (
                <div key={cat.id} className="space-y-3">
                  <p className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase mb-4">
                    Objetivo {cat.name} (R$)
                  </p>
                  <TargetInput
                    label="Objetivo Geral (Produtos)"
                    val={editForm.items['meta_produto_geral'] || 0}
                    setVal={(v) =>
                      setEditForm({
                        ...editForm,
                        items: { ...editForm.items, ['meta_produto_geral']: v },
                      })
                    }
                  />
                </div>
              );
            }

              return (
                <div key={cat.id} className="space-y-3">
                  <p className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase mb-4">
                    Objetivo {cat.name} (R$)
                  </p>
                  {itemsOfCat.map((c) => {
                    const subcat = subcategories.find(
                      (s) => s.id === c.subcategoryId,
                    );
                    const label = subcat
                      ? `${c.name} (${subcat.name})`
                      : c.name;
                    return (
                      <TargetInput
                        key={c.id}
                        label={label}
                        val={editForm.items[c.id] || 0}
                        setVal={(v) =>
                          setEditForm({
                            ...editForm,
                            items: { ...editForm.items, [c.id]: v },
                          })
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setIsEditingTargets(false)}
              className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 font-semibold hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTargets}
              className="bg-[var(--theme-color)] text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-[var(--theme-color-strong)]"
            >
              Salvar Objetivos
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const itemsOfCat = catalog.filter((c) => c.type === cat.id);
            if (itemsOfCat.length === 0) return null;
            
            if (cat.id === 'EXTRA_SERVICE') {
              const totalExtras = itemsOfCat.reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
              return (
                <div key={cat.id} className="space-y-4">
                  <h4 className="font-bold text-gray-600 dark:text-zinc-300 text-sm border-b pb-1 uppercase">
                    {cat.name}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-2">
                     <ProgressCard
                        label="Objetivo Geral (Serviços Extras)"
                        total={totalExtras}
                        target={target.items['meta_extra_geral'] || 0}
                     />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-90">
                    {itemsOfCat.map((c) => {
                      const totalC = stats.totals[c.id] || 0;
                      if (totalC === 0) return null;
                      return (
                        <div key={c.id} className="bg-gray-50 dark:bg-zinc-800/40 p-3 flex flex-col justify-between rounded-xl border border-gray-100 dark:border-zinc-800/80 text-sm">
                           <p className="text-gray-500 dark:text-zinc-400 font-bold mb-1 text-xs truncate" title={c.name}>{c.name}</p>
                           <p className="text-gray-900 dark:text-zinc-100 font-bold">R$ {totalC.toFixed(2)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            }
            
            if (cat.id === 'PRODUCT') {
              const totalProducts = itemsOfCat.reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
              return (
                <div key={cat.id} className="space-y-4">
                  <h4 className="font-bold text-gray-600 dark:text-zinc-300 text-sm border-b pb-1 uppercase">
                    {cat.name}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-2">
                     <ProgressCard
                        label="Objetivo Geral (Produtos)"
                        total={totalProducts}
                        target={target.items['meta_produto_geral'] || 0}
                     />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-90">
                    {itemsOfCat.map((c) => {
                      const totalC = stats.totals[c.id] || 0;
                      if (totalC === 0) return null;
                      return (
                        <div key={c.id} className="bg-gray-50 dark:bg-zinc-800/40 p-3 flex flex-col justify-between rounded-xl border border-gray-100 dark:border-zinc-800/80 text-sm">
                           <p className="text-gray-500 dark:text-zinc-400 font-bold mb-1 text-xs truncate" title={c.name}>{c.name}</p>
                           <p className="text-gray-900 dark:text-zinc-100 font-bold">R$ {totalC.toFixed(2)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={cat.id} className="space-y-3">
                <h4 className="font-bold text-gray-600 dark:text-zinc-300 text-sm border-b pb-1 uppercase">
                  {cat.name}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {itemsOfCat.map((c) => {
                    const subcat = subcategories.find(
                      (s) => s.id === c.subcategoryId,
                    );
                    const label = subcat
                      ? `${c.name} (${subcat.name})`
                      : c.name;
                    return (
                      <ProgressCard
                        key={c.id}
                        label={label}
                        total={stats.totals[c.id] || 0}
                        target={target.items[c.id] || 0}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lançamentos Table */}
      <div className="mt-8 border-t pt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">
          Histórico de Lançamentos
        </h3>

        {/* Custom Confirmation Alert */}
        {deleteConfirmId && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
            <div>
              <p className="text-sm text-red-800 dark:text-red-400 font-bold">Excluir lançamento permanente?</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">Essa alteração alterará os relatórios e comissões do barbeiro.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteEntry(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
          {barberEntries.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-zinc-400 font-medium">
              Nenhum lançamento registrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 text-gray-500 dark:text-zinc-400 border-b">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Data</th>
                    <th className="px-4 py-4 font-semibold">
                      Hora de Lançamento
                    </th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold text-purple-700">
                      Clientes Distintos
                    </th>
                    <th className="px-4 py-4 font-semibold text-right">
                      Total Comissão (R$)
                    </th>
                    <th className="px-4 py-4 font-semibold text-right">
                      Escala de Dias
                    </th>
                    <th className="px-4 py-4 font-semibold text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-600 dark:text-zinc-300">
                  {barberEntries.map((e) => {
                    let total = 0;
                    if (!e.isDayOff) {
                      Object.values(e.items).forEach(
                        (itm) => (total += itm.commission),
                      );
                    }
                    const timeStr = e.createdAt
                      ? new Date(e.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-";
                    const isExpanded = !!expandedEntries[e.id];
                    const entryDays = getEntryDaysList(e.date);
                    return (
                      <React.Fragment key={e.id}>
                        <tr
                          className="hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 transition-colors cursor-pointer"
                          onClick={() => toggleEntryExpanded(e.id)}
                        >
                          <td className="px-4 py-4 font-medium text-gray-900 dark:text-zinc-100">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-[var(--theme-color)]" />
                              <span>{formatEntryDate(e.date)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-500 dark:text-zinc-400">{timeStr}</td>
                          <td className="px-4 py-4">
                            {e.isDayOff ? (
                              <span className="bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                Folga
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {e.workedDays
                                  ? `${e.workedDays.length} Dias Tr.`
                                  : "Trabalho"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-bold text-purple-700">
                            {e.isDayOff
                              ? "-"
                              : e.uniqueClientsServed || e.clientsServed || 0}
                          </td>
                          <td className="px-4 py-4 font-bold text-gray-900 dark:text-zinc-100 text-right">
                            R$ {total.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleEntryExpanded(e.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all border border-gray-200 dark:border-zinc-800/40 cursor-pointer"
                            >
                              {isExpanded ? (
                                <span className="flex items-center gap-1">
                                  Fechar <ChevronUp className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  Ver Dias{" "}
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </button>
                          </td>
                          <td
                            className="px-4 py-4 text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingEntryId(e.id)}
                                className="px-3 py-1 text-sm font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 transition rounded flex items-center gap-1"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" /> Editar
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(e.id)}
                                className="p-2 text-gray-400 dark:text-zinc-500 hover:text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20 dark:hover:bg-red-950/25 rounded"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300/40">
                            <td
                              colSpan={7}
                              className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800"
                            >
                              <div className="space-y-3">
                                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                                  Escala detalhada por dia neste período:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {entryDays.map((day) => {
                                    const didWork =
                                      !e.isDayOff &&
                                      (e.workedDays || []).includes(day.date);
                                    return (
                                      <div
                                        key={day.date}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                                          didWork
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                            : "bg-red-50 border-red-100 text-red-650"
                                        }`}
                                      >
                                        <span className="font-extrabold text-gray-900 dark:text-zinc-100">
                                          Dia {day.date}
                                        </span>
                                        <span className="opacity-75">
                                          ({day.weekday.split("-")[0]})
                                        </span>
                                        <span
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                            didWork
                                              ? "bg-emerald-100/60 border-emerald-200 text-emerald-800"
                                              : "bg-red-100/60 border-red-200 text-red-700"
                                          }`}
                                        >
                                          {didWork
                                            ? "💼 Trabalhou"
                                            : "🏖️ Folgou"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingEntryId && (
        <AdminEntryModal
          entry={entries.find((e) => e.id === editingEntryId)!}
          catalog={catalog}
          categories={categories}
          subcategories={subcategories}
          onClose={() => setEditingEntryId(null)}
          onSave={(e) => {
            updateEntry(e);
            setEditingEntryId(null);
          }}
        />
      )}
    </div>
  );
}

function TargetInput({
  label,
  val,
  setVal,
}: {
  label: string;
  val: number;
  setVal: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-2 rounded-lg border border-gray-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-[var(--theme-color)] focus-within:border-transparent transition-all">
      <span
        className="w-1/3 text-sm font-medium text-gray-600 dark:text-zinc-300 block whitespace-nowrap overflow-hidden text-ellipsis px-2"
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm font-medium">
          R$
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={val}
          onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none font-bold text-gray-900 dark:text-zinc-100 shadow-sm"
        />
      </div>
    </div>
  );
}

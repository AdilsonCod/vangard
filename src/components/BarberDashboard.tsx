import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store";
import { ProgressCard } from "./ProgressCard";
import { DailyEntry, Target } from "../types";
import {
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
  Target as TargetIcon,
  Edit3,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  DollarSign
} from "lucide-react";
import { BarberPaymentsView } from "./BarberPaymentsView";
import { BarberSettingsView } from "./BarberSettingsView";
import { OverviewBarberDashboard } from "./OverviewBarberDashboard";
import { BarberReportsView } from "./BarberReportsView";
import { BarberRankingsView } from "./BarberRankingsView";
import { BarberAnnouncementsView } from "./BarberAnnouncementsView";
import { BarberNotesView } from "./BarberNotesView";
import { BarberSelfManagementView } from "./BarberSelfManagementView";
// Logo imported via direct asset path

import {
  getAvailablePeriods,
  formatEntryDate,
  PERIODS,
  getDaysForPeriod,
  getPeriodDaysInfo,
} from "../utils";

const Row = ({
  label,
  id,
  form,
  setForm,
}: {
  label: string;
  id: string;
  form: Record<string, { amount: number; commission: number }>;
  setForm: React.Dispatch<
    React.SetStateAction<Record<string, { amount: number; commission: number }>>
  >;
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
      <div className="flex-1">
        <label className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-1 block">
          {label}
        </label>
      </div>
      <div className="flex gap-4 w-full sm:w-auto">
        <div className="flex-1 sm:w-32">
          <label className="text-xs text-gray-500 dark:text-zinc-400 font-semibold mb-1 block">
            Faturamento (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form[id]?.amount || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                [id]: { ...prev[id], amount: parseFloat(e.target.value) || 0 },
              }))
            }
            className="w-full border border-gray-300 dark:border-zinc-600 p-2 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium"
            placeholder="0,00"
          />
        </div>
        <div className="flex-1 sm:w-32">
          <label className="text-xs text-gray-500 dark:text-zinc-400 font-semibold mb-1 block">
            Comissão (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form[id]?.commission || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                [id]: {
                  ...prev[id],
                  commission: parseFloat(e.target.value) || 0,
                },
              }))
            }
            className="w-full border border-gray-300 dark:border-zinc-600 p-2 rounded-lg outline-none focus:ring-2 focus:ring-[var(--theme-color)] transition-all bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium"
            placeholder="0,00"
          />
        </div>
      </div>
    </div>
  );
};

export default function BarberDashboard() {
  const { currentUser, logout, themeLightBg, themeDarkBg, 
    entries,
    targets,
    addEntry,
    catalog: rawCatalog,
    categories,
    subcategories,
    systemUnits,
    notifications,
    addNotification,
    markNotificationAsRead,
    deleteNotification,
  } = useStore();

  const catalog = useMemo(() => {
    if (!currentUser) return rawCatalog;
    return rawCatalog.filter((item) => {
      if (item.visibleToRoles && item.visibleToRoles.length > 0) {
        return item.visibleToRoles.includes(currentUser.role);
      }
      return true;
    });
  }, [rawCatalog, currentUser]);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

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

  const availablePeriods = useMemo(
    () => getAvailablePeriods(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  useEffect(() => {
    if (availablePeriods.length > 0) {
      if (!availablePeriods.find((p) => p.id === selectedPeriod)) {
        setSelectedPeriod(availablePeriods[availablePeriods.length - 1].id);
      }
    } else {
      setSelectedPeriod("");
    }
  }, [availablePeriods, selectedPeriod]);

  const date = selectedPeriod
    ? `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}-${selectedPeriod}`
    : "";

  const periodDays = useMemo(
    () => getDaysForPeriod(selectedYear, selectedMonth, selectedPeriod),
    [selectedYear, selectedMonth, selectedPeriod],
  );

  useEffect(() => {
    setWorkedDays([]);
  }, [selectedYear, selectedMonth, selectedPeriod]);

  const [isDayOff, setIsDayOff] = useState(false);
  const [workedDays, setWorkedDays] = useState<number[]>([]);
  const [clientsServed, setClientsServed] = useState(0);
  const [uniqueClientsServed, setUniqueClientsServed] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "AVISOS" | "AUTOGESTAO" | "METAS" | "PAGAMENTOS" | "RELATORIOS" | "RANKINGS" | "ANOTACOES" | "CONFIGURACOES"
  >("OVERVIEW");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { isDarkMode, setIsDarkMode } = useStore();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userNotifications = useMemo(() => {
    return (notifications || []).filter(n => n.userId === currentUser!.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, currentUser]);
  const unreadCount = userNotifications.filter(n => !n.read).length;

  const [form, setForm] = useState<
    Record<string, { amount: number; commission: number }>
  >({});
  const [cortesias, setCortesias] = useState<
    Record<string, { amount: number; commission: number }>
  >({});

  useEffect(() => {
    const initForm: typeof form = {};
    const initCortesias: typeof cortesias = {};
    catalog.forEach((c) => {
      initForm[c.id] = { amount: 0, commission: 0 };
      initCortesias[c.id] = { amount: 0, commission: 0 };
    });
    setForm(initForm);
    setCortesias(initCortesias);
  }, [catalog]);

  const defaultItemsTarget: Record<string, number> = {};
  catalog.forEach((c) => (defaultItemsTarget[c.id] = 0));
  const target = targets[currentUser!.id] || {
    items: defaultItemsTarget,
    clientsServed: 0,
    uniqueClientsServed: 0,
  };

  const userEntries = entries.filter((e) => e.userId === currentUser!.id);

  const stats = useMemo(() => {
    let totals: Record<string, number> = {};
    catalog.forEach((c) => (totals[c.id] = 0));
    let daysWorked = 0;
    let daysOff = 0;
    let clientsServedCount = 0;
    let uniqueClientsServedCount = 0;

    userEntries.forEach((e) => {
      const { workedCount, offCount } = getPeriodDaysInfo(
        e.date,
        e.isDayOff,
        e.workedDays,
      );
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
  }, [userEntries, catalog]);

  const {
    totalTargetValue,
    totalAchievedValue,
    totalMissingValue,
    totalPercentage,
  } = useMemo(() => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!date) {
      setErrorMessage("Selecione um período válido.");
      return;
    }
    const existingEntry = entries.find(
      (e) => e.userId === currentUser!.id && e.date === date,
    );
    if (existingEntry) {
      setErrorMessage(
        "Você já fez o lançamento para este período. Por favor, peça ao admin para editar se for necessário.",
      );
      return;
    }

    if (!isDayOff && workedDays.length === 0) {
      setErrorMessage(
        "Selecione pelo menos um dia trabalhado no período ou marque o período como folga.",
      );
      return;
    }

    const newEntry: DailyEntry = {
      id: crypto.randomUUID(),
      userId: currentUser!.id,
      date,
      createdAt: new Date().toISOString(),
      isDayOff,
      workedDays: isDayOff ? [] : workedDays,
      clientsServed: isDayOff ? 0 : clientsServed,
      uniqueClientsServed: isDayOff ? 0 : uniqueClientsServed,
      items: isDayOff ? {} : { ...form },
      cortesias: isDayOff ? {} : { ...cortesias },
    };
    
    // Check if target reached
    let addedValue = 0;
    if (!isDayOff) {
      Object.entries(form).forEach(([itemId, val]) => {
         addedValue += val.commission || 0;
      });
    }
    
    addEntry(newEntry);
    
    if (totalTargetValue > 0 && totalAchievedValue < totalTargetValue && (totalAchievedValue + addedValue) >= totalTargetValue) {
      addNotification({
        id: crypto.randomUUID(),
        userId: currentUser!.id,
        title: 'Objetivo Alcançado! 🏆',
        message: 'Parabéns! Com este lançamento você atingiu 100% do seu objetivo de faturamento!',
        type: 'success',
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    
    setSuccessMessage("Dados enviados com sucesso!");
    // Reset form values
    const resetForm: typeof form = {};
    const resetCortesias: typeof cortesias = {};
    Object.keys(form).forEach((k) => {
      resetForm[k] = { amount: 0, commission: 0 };
    });
    Object.keys(cortesias).forEach((k) => {
      resetCortesias[k] = { amount: 0, commission: 0 };
    });
    setForm(resetForm);
    setCortesias(resetCortesias);
    setClientsServed(0);
    setUniqueClientsServed(0);
    setIsDayOff(false);
  };

  const navItems = [
    { id: "OVERVIEW", label: "Visão Geral", icon: LayoutDashboard },
    { id: "AVISOS", label: "Quadro de Avisos", icon: Megaphone },
    { id: "AUTOGESTAO", label: "Autogestão / Performance", icon: TrendingUp },
    { id: "METAS", label: "Lançamentos e Objetivos", icon: TargetIcon },
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
                    ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)]" 
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100"
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[var(--theme-color)]" : "text-gray-400 dark:text-zinc-500"}`} />
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
                  className="p-2 text-gray-500 dark:text-zinc-400 hover:text-[var(--theme-color)] transition-colors rounded-full relative"
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
                          ? "bg-[var(--theme-color)]/10 text-[var(--theme-color)]" 
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
                <div className="border-t border-gray-200 dark:border-zinc-800 my-1 pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    Sair do Sistema
                  </button>
                </div>
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
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs text-purple-700 uppercase font-semibold">
                      CLIENTES DISTINTOS
                    </p>
                    <span className="text-xs font-bold px-2 py-1 bg-purple-50 text-purple-700 rounded-lg">
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
                  <div className="flex items-end gap-2 mb-4">
                    <p className="text-2xl font-bold text-purple-600">
                      {stats.uniqueClientsServedCount}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-zinc-500 mb-1">
                      / {target.uniqueClientsServed}
                    </p>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-full h-2 mb-2 overflow-hidden">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${target.uniqueClientsServed > 0 ? Math.min(100, Math.round((stats.uniqueClientsServedCount / target.uniqueClientsServed) * 100)) : 0}%`,
                      }}
                    ></div>
                  </div>
                  {target.uniqueClientsServed >
                  stats.uniqueClientsServedCount ? (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                      Faltam{" "}
                      <span className="text-gray-900 dark:text-zinc-100 font-bold">
                        {target.uniqueClientsServed -
                          stats.uniqueClientsServedCount}
                      </span>{" "}
                      para o objetivo
                    </p>
                  ) : (
                    <p className="text-xs text-purple-600 font-bold gap-1 flex items-center">
                      Objetivo atingido!
                    </p>
                  )}
                </div>

                {/* COMPOSITE GOALS SUM METER (R$) */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-orange-100 p-4 col-span-2 md:col-span-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs text-[var(--theme-color)] uppercase font-semibold">
                      Soma Geral dos Objetivos
                    </p>
                    <span className="text-xs font-bold px-2 py-1 bg-orange-50 text-[var(--theme-color)] rounded-lg">
                      {totalPercentage}%
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mb-4">
                    <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                      R$ {totalAchievedValue.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400 dark:text-zinc-500 mb-1">
                      / R$ {totalTargetValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 rounded-full h-2 mb-2 overflow-hidden">
                    <div
                      className="bg-[var(--theme-color)] h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${totalPercentage}%` }}
                    ></div>
                  </div>
                  {totalMissingValue > 0 ? (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                      Faltam{" "}
                      <span className="text-gray-900 dark:text-zinc-100 font-bold">
                        R$ {totalMissingValue.toFixed(2)}
                      </span>{" "}
                      para o objetivo
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--theme-color)] font-bold gap-1 flex items-center">
                      Objetivo atingido!
                    </p>
                  )}
                </div>
              </div>

              {categories.map((cat) => {
                const itemsOfCat = catalog.filter((c) => c.type === cat.id);
                if (itemsOfCat.length === 0) return null;
                
                if (cat.id === 'EXTRA_SERVICE') {
                  const totalExtras = itemsOfCat.reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
                  
                  return (
                    <React.Fragment key={cat.id}>
                      <h3 className="font-semibold text-gray-600 dark:text-zinc-300 mt-6 mb-3 flex items-center gap-2">
                        <Scissors className="w-4 h-4" /> {cat.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <ProgressCard
                          label="Objetivo Geral (Serviços Extras)"
                          total={totalExtras}
                          target={target.items['meta_extra_geral'] || 0}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-90">
                        {itemsOfCat.map((c) => {
                          const totalC = stats.totals[c.id] || 0;
                          return (
                            <div key={c.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-3 rounded-xl shadow-sm text-sm flex flex-col justify-between">
                               <p className="text-gray-500 dark:text-zinc-400 font-bold mb-1 text-xs">{c.name}</p>
                               <p className="text-gray-900 dark:text-zinc-100 font-bold text-base">R$ {totalC.toFixed(2)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </React.Fragment>
                  );
                }
                
                if (cat.id === 'PRODUCT') {
                  const totalProducts = itemsOfCat.reduce((sum, c) => sum + (stats.totals[c.id] || 0), 0);
                  
                  return (
                    <React.Fragment key={cat.id}>
                      <h3 className="font-semibold text-gray-600 dark:text-zinc-300 mt-6 mb-3 flex items-center gap-2">
                        <Scissors className="w-4 h-4" /> {cat.name}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <ProgressCard
                          label="Objetivo Geral (Produtos)"
                          total={totalProducts}
                          target={target.items['meta_produto_geral'] || 0}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-90">
                        {itemsOfCat.map((c) => {
                          const totalC = stats.totals[c.id] || 0;
                          return (
                            <div key={c.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-3 rounded-xl shadow-sm text-sm flex flex-col justify-between">
                               <p className="text-gray-500 dark:text-zinc-400 font-bold mb-1 text-xs">{c.name}</p>
                               <p className="text-gray-900 dark:text-zinc-100 font-bold text-base">R$ {totalC.toFixed(2)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={cat.id}>
                    <h3 className="font-semibold text-gray-600 dark:text-zinc-300 mt-6 mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4" /> {cat.name}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  </React.Fragment>
                );
              })}
            </section>

            {/* INPUT SECTION */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
              <div className="bg-brand-licorice p-4 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="font-bold">Lançamento por Período</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-zinc-900/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 outline-none hover:bg-zinc-900/15 transition-colors focus:ring-1 focus:ring-white/30"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1} className="bg-brand-licorice text-white">
                        {new Date(2000, i, 1).toLocaleString("pt-BR", {
                          month: "long",
                        })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-zinc-900/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 outline-none hover:bg-zinc-900/15 transition-colors focus:ring-1 focus:ring-white/30"
                  >
                    {[
                      now.getFullYear() - 1,
                      now.getFullYear(),
                      now.getFullYear() + 1,
                    ].map((y) => (
                      <option key={y} value={y} className="bg-brand-licorice text-white">
                        {y}
                      </option>
                    ))}
                  </select>
                  {availablePeriods.length > 0 ? (
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="bg-zinc-900/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 outline-none font-bold hover:bg-zinc-900/15 transition-colors focus:ring-1 focus:ring-white/30"
                    >
                      {availablePeriods.map((p) => (
                        <option key={p.id} value={p.id} className="bg-brand-licorice text-white">
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded font-bold border border-red-500/20">
                      Nenhum período disponível
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {errorMessage && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-250 dark:border-amber-900/30 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                    <p className="text-sm font-semibold">{errorMessage}</p>
                    <button type="button" onClick={() => setErrorMessage(null)} className="text-amber-600 dark:text-amber-500 font-bold hover:text-amber-880 text-xs uppercase p-1">Fechar</button>
                  </div>
                )}

                {successMessage && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-950/30 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                    <p className="text-sm font-semibold">{successMessage}</p>
                    <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-600 dark:text-emerald-500 font-bold hover:text-emerald-800 text-xs uppercase p-1">Ok</button>
                  </div>
                )}
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 p-4 rounded-xl border border-gray-200 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    id="folga"
                    checked={isDayOff}
                    onChange={(e) => setIsDayOff(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                  <label
                    htmlFor="folga"
                    className="font-medium text-gray-600 dark:text-zinc-300 cursor-pointer select-none"
                  >
                    Marcar o período inteiro como folga
                  </label>
                </div>

                {!isDayOff && periodDays.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800">
                    <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-4 uppercase">
                      Dias Trabalhados no Período
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {periodDays.map((day) => (
                        <label
                          key={day.date}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${workedDays.includes(day.date) ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200"}`}
                        >
                          <input
                            type="checkbox"
                            checked={workedDays.includes(day.date)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setWorkedDays((prev) => [...prev, day.date]);
                              else
                                setWorkedDays((prev) =>
                                  prev.filter((d) => d !== day.date),
                                );
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">
                              Dia {day.date}
                            </span>
                            <span className="text-xs opacity-75">
                              {day.weekday}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!isDayOff && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {categories.map((cat) => {
                        const itemsOfCat = catalog.filter(
                          (c) => c.type === cat.id,
                        );
                        if (itemsOfCat.length === 0) return null;
                        return (
                          <div key={cat.id} className="space-y-4">
                            <h3 className="font-bold text-gray-900 dark:text-zinc-100 border-b pb-2">
                              {cat.name}
                            </h3>
                            {itemsOfCat.map((c) => {
                              const subcat = subcategories.find(
                                (s) => s.id === c.subcategoryId,
                              );
                              const label = subcat
                                ? `${c.name} (${subcat.name})`
                                : c.name;
                              return (
                                <Row
                                  key={c.id}
                                  label={label}
                                  id={c.id}
                                  form={form}
                                  setForm={setForm}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        className="bg-[var(--theme-color)] hover:bg-[#e05f3a] text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" /> Submeter Dados
                      </button>
                    </div>
                  </>
                )}

                {isDayOff && (
                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      className="bg-[var(--theme-color)] hover:bg-[#e05f3a] text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-colors"
                    >
                      Salvar Folga
                    </button>
                  </div>
                )}
              </form>
            </section>

            {/* RECENT ENTRIES SECTION */}
            <section className="mt-8 border-t pt-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4 font-sans">
                Meus Lançamentos
              </h3>
              {userEntries.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 text-center text-gray-500 dark:text-zinc-400 font-sans">
                  Você ainda não registrou nenhum dia.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Desktop view: Table */}
                  <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 text-gray-500 dark:text-zinc-400 border-b font-sans">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">
                            Hora de Lançamento
                          </th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-purple-700">
                            Clientes Distintos
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            Total Comissão (R$)
                          </th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Escala Detalhada
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-gray-600 dark:text-zinc-300 font-sans">
                        {userEntries
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((e) => {
                            let total = 0;
                            if (!e.isDayOff) {
                              Object.values(e.items).forEach(
                                (itm: any) => (total += itm.commission),
                              );
                            }
                            const timeStr = e.createdAt
                              ? new Date(e.createdAt).toLocaleTimeString(
                                  "pt-BR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "-";
                            const isExpanded = !!expandedEntries[e.id];
                            const entryDays = getEntryDaysList(e.date);
                            return (
                              <React.Fragment key={e.id}>
                                <tr
                                  className="hover:bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300/70 transition-colors cursor-pointer"
                                  onClick={() => toggleEntryExpanded(e.id)}
                                >
                                  <td className="px-4 py-3 font-medium">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-[var(--theme-color)]" />
                                      <span>{formatEntryDate(e.date)}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                                    {timeStr}
                                  </td>
                                  <td className="px-4 py-3">
                                    {e.isDayOff ? (
                                      <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-gray-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                        Folga
                                      </span>
                                    ) : (
                                      <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                        {e.workedDays
                                          ? `${e.workedDays.length} Dias Tr.`
                                          : "Trabalho"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-purple-700">
                                    {e.isDayOff
                                      ? "-"
                                      : e.uniqueClientsServed ||
                                        e.clientsServed ||
                                        0}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-zinc-100">
                                    R$ {total.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleEntryExpanded(e.id);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 text-gray-600 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all border border-gray-200 dark:border-zinc-800/40"
                                    >
                                      {isExpanded ? (
                                        <span className="flex items-center gap-1">
                                          Fechar{" "}
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1">
                                          Ver Dias{" "}
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </span>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300/40">
                                    <td
                                      colSpan={6}
                                      className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800"
                                    >
                                      <div className="space-y-3">
                                        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                                          Escala detalhada por dia neste
                                          período:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {entryDays.map((day) => {
                                            const didWork =
                                              !e.isDayOff &&
                                              (e.workedDays || []).includes(
                                                day.date,
                                              );
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
                                                  className={`inline-flex items-center gap-1 px-1.5 py-0.3 rounded-md text-[10px] font-bold uppercase border ${
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

                  {/* Mobile view: Adaptive Card List (No scrollbar, highly responsive) */}
                  <div className="block md:hidden space-y-3">
                    {userEntries
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((e) => {
                        let total = 0;
                        if (!e.isDayOff) {
                          Object.values(e.items).forEach(
                            (itm: any) => (total += itm.commission),
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
                          <div
                            key={e.id}
                            className="flex flex-col cursor-pointer bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4 space-y-3 border-l-4 border-l-[var(--theme-color)] hover:border-l-[#e05f3a] transition-all font-sans"
                            onClick={() => toggleEntryExpanded(e.id)}
                          >
                            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-zinc-800">
                              <span className="font-bold text-gray-900 dark:text-zinc-100 font-sans">
                                {formatEntryDate(e.date)}
                              </span>
                              {e.isDayOff ? (
                                <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-gray-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full text-xs font-bold font-sans">
                                  Folga
                                </span>
                              ) : (
                                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold font-sans">
                                  {e.workedDays
                                    ? `${e.workedDays.length} Dias Tr.`
                                    : "Trabalho"}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                              <div>
                                <span className="block text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                                  Lançado às
                                </span>
                                <span className="text-gray-600 dark:text-zinc-300 font-medium">
                                  {timeStr}
                                </span>
                              </div>
                              <div>
                                <span className="block text-purple-400 font-semibold uppercase tracking-wider text-[10px]">
                                  Cli. Distintos
                                </span>
                                <span className="text-purple-700 font-bold">
                                  {e.isDayOff
                                    ? "-"
                                    : e.uniqueClientsServed ||
                                      e.clientsServed ||
                                      0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 rounded-lg p-2.5 flex justify-between items-center border border-gray-200 dark:border-zinc-800 font-sans">
                              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                                Comissão Total
                              </span>
                              <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                                R$ {total.toFixed(2)}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleEntryExpanded(e.id);
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    Ocular Detalhes{" "}
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Ver Escala de Datas{" "}
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </div>

                            {isExpanded && (
                              <div
                                className="pt-2 border-t border-gray-200 dark:border-zinc-800 space-y-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                                  Duração e escala do período:
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {entryDays.map((day) => {
                                    const didWork =
                                      !e.isDayOff &&
                                      (e.workedDays || []).includes(day.date);
                                    return (
                                      <div
                                        key={day.date}
                                        className={`flex flex-col p-2.5 rounded-lg border text-[11px] font-semibold ${
                                          didWork
                                            ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                                            : "bg-red-50 border-red-100 text-red-900"
                                        }`}
                                      >
                                        <span className="font-bold text-gray-900 dark:text-zinc-100">
                                          Dia {day.date} (
                                          {day.weekday.split("-")[0]})
                                        </span>
                                        <span
                                          className={`inline-block mt-1 self-start px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${
                                            didWork
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-250"
                                              : "bg-red-100 text-red-800 border border-red-150"
                                          }`}
                                        >
                                          {didWork ? "Trabalhou" : "Folgou"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          </>
        ) : activeTab === "PAGAMENTOS" ? (
          <BarberPaymentsView />
        ) : activeTab === "RELATORIOS" ? (
          <BarberReportsView />
        ) : activeTab === "RANKINGS" ? (
          <BarberRankingsView />
        ) : activeTab === "ANOTACOES" ? (
          <BarberNotesView />

        ) : (
          <BarberSettingsView />
        )}
      </main>
      </div>
    </div>
  );
}

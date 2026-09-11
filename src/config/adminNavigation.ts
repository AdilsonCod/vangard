import { BarChart3, BookOpen, Briefcase, Calculator, ClipboardList, DollarSign, FileText, Gift, LayoutDashboard, Link2, Megaphone, MessagesSquare, PieChart, Settings, ShoppingBag, TrendingUp, Upload, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '../types';

export type AdminNavItem = {
  id: string;
  label: string;
  section: string;
  icon: LucideIcon;
  subItems?: ReadonlyArray<{ id: string; label: string }>;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'OVERVIEW', label: 'Visão Geral', section: 'Principal', icon: LayoutDashboard },
  { id: 'FINANCE', label: 'Financeiro', section: 'Financeiro', icon: PieChart, subItems: [
    { id: 'FINANCE_RESUMO', label: 'Resumo' }, { id: 'FINANCE_CAIXA', label: 'Caixa & Contas' },
    { id: 'FINANCE_CONCILIACAO_FINTECH', label: 'Conciliação' }, { id: 'FINANCE_CONCILIACAO', label: 'Conciliação OFX' },
    { id: 'FINANCE_RECEBIMENTOS', label: 'Baixa de Recebimentos' }, { id: 'FINANCE_DESPESAS', label: 'Baixa de Despesas' },
  ] },
  { id: 'PAYMENTS', label: 'Pagamentos', section: 'Financeiro', icon: DollarSign },
  { id: 'COMMISSION_CALCULATION', label: 'Cálculo de Comissão', section: 'Financeiro', icon: Calculator },
  { id: 'FINANCIAL_AUDIT', label: 'Auditoria Financeira', section: 'Financeiro', icon: ClipboardList },
  { id: 'BARBERS', label: 'Barbeiros e Metas', section: 'Operação', icon: TrendingUp },
  { id: 'MANAGEMENT', label: 'Análises', section: 'Operação', icon: Briefcase, subItems: [
    { id: 'MANAGEMENT_SVA', label: 'SVA' }, { id: 'MANAGEMENT_UNITS', label: 'Análise de Unidades' }, { id: 'MANAGEMENT_BARBERS', label: 'Análise de Barbeiros' },
  ] },
  { id: 'AVISOS', label: 'Mural de Avisos', section: 'Operação', icon: Megaphone },
  { id: 'COURTESY_CONTROL', label: 'Controle de Cortesias', section: 'Financeiro', icon: Gift },
  { id: 'INTERNAL_SALES', label: 'Vendas Internas', section: 'Financeiro', icon: ShoppingBag },
  { id: 'MESSAGES', label: 'Disparo de Mensagens', section: 'Operação', icon: MessagesSquare },
  { id: 'SMART_LINKS', label: 'Links Inteligentes', section: 'Operação', icon: Link2 },
  { id: 'CATALOG', label: 'Catálogo', section: 'Cadastros', icon: BookOpen, subItems: [
    { id: 'CATALOG_PRODUCTS', label: 'Produtos' }, { id: 'CATALOG_SERVICES', label: 'Serviços' }, { id: 'CATALOG_CATEGORIES', label: 'Categorias' },
  ] },
  { id: 'MARKETING', label: 'Marketing', section: 'Análises', icon: BarChart3 },
  { id: 'USERS', label: 'Equipe e Unidades', section: 'Cadastros', icon: Users, subItems: [
    { id: 'USERS_STAFF', label: 'Colaboradores' }, { id: 'USERS_RECEPTION', label: 'Recepção' },
    { id: 'USERS_MANAGEMENT', label: 'Gerência' }, { id: 'USERS_UNITS', label: 'Unidades' },
  ] },
  { id: 'REPORTS', label: 'Relatórios', section: 'Dados', icon: FileText },
  { id: 'IMPORT', label: 'Importações', section: 'Dados', icon: Upload },
  { id: 'CONFIG', label: 'Configurações', section: 'Sistema', icon: Settings },
];

const ROLE_NAV_IDS: Partial<Record<Role, ReadonlySet<string>>> = {
  FINANCIAL: new Set(['FINANCE', 'REPORTS', 'PAYMENTS', 'COMMISSION_CALCULATION', 'COURTESY_CONTROL', 'INTERNAL_SALES', 'CONFIG']),
  MARKETING: new Set(['MARKETING', 'MESSAGES', 'SMART_LINKS', 'CONFIG']),
  RECEPTION: new Set(['OVERVIEW', 'AVISOS', 'COURTESY_CONTROL', 'INTERNAL_SALES', 'MESSAGES', 'SMART_LINKS', 'CONFIG']),
};

export function getAdminNavigation(role?: Role): AdminNavItem[] {
  const allowed = role ? ROLE_NAV_IDS[role] : undefined;
  return allowed ? ADMIN_NAV_ITEMS.filter(item => allowed.has(item.id)) : ADMIN_NAV_ITEMS;
}

export function canAccessAdminTab(role: Role | undefined, tabId: string): boolean {
  return getAdminNavigation(role).some(item => item.id === tabId || item.subItems?.some(subItem => subItem.id === tabId));
}

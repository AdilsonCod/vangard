import type { Role } from '../types';

export const RESPONSIVE_VIEWPORTS = [
  { id: 'phone', width: 390, height: 844, description: 'Telefone em orientação vertical' },
  { id: 'tablet', width: 768, height: 1024, description: 'Tablet em orientação vertical' },
  { id: 'desktop', width: 1440, height: 900, description: 'Desktop padrão' },
] as const;

export const PROFILE_EXPECTATIONS: Record<Role, { shell: 'management' | 'professional'; requiredModules: string[] }> = {
  ADMIN: { shell: 'management', requiredModules: ['OVERVIEW', 'FINANCE', 'PAYMENTS', 'BARBERS', 'MANAGEMENT', 'MARKETING', 'REPORTS', 'IMPORT', 'CONFIG'] },
  FINANCIAL: { shell: 'management', requiredModules: ['FINANCE', 'PAYMENTS', 'COMMISSION_CALCULATION', 'REPORTS', 'CONFIG'] },
  MARKETING: { shell: 'management', requiredModules: ['MARKETING', 'MESSAGES', 'SMART_LINKS', 'CONFIG'] },
  RECEPTION: { shell: 'management', requiredModules: ['OVERVIEW', 'AVISOS', 'COURTESY_CONTROL', 'INTERNAL_SALES', 'MESSAGES', 'SMART_LINKS', 'CONFIG'] },
  BARBER: { shell: 'professional', requiredModules: ['OVERVIEW', 'AVISOS', 'AUTOGESTAO', 'METAS', 'PAGAMENTOS', 'RELATORIOS', 'RANKINGS', 'CONFIGURACOES'] },
  MANICURE: { shell: 'professional', requiredModules: ['OVERVIEW', 'AVISOS', 'AUTOGESTAO', 'METAS', 'PAGAMENTOS', 'RELATORIOS', 'RANKINGS', 'CONFIGURACOES'] },
};

import React from 'react';
import { AlertTriangle, Calendar, CreditCard, Layers, ShieldCheck, Sparkles } from 'lucide-react';

export type ReconciliationWorkspaceTab =
  | 'RESUMO'
  | 'FECHAMENTO'
  | 'REGRA_1'
  | 'REGRA_2'
  | 'REGRA_3'
  | 'DIVERGENCIAS'
  | 'PROJECAO'
  | 'CODIGO_BACKEND';

type ReconciliationWorkspaceTabsProps = {
  activeTab: ReconciliationWorkspaceTab;
  dailyClosingCount: number;
  divergenceCount: number;
  onChange: (tab: ReconciliationWorkspaceTab) => void;
};

type TabDefinition = {
  id: ReconciliationWorkspaceTab;
  label: string;
  icon: typeof ShieldCheck;
  active: string;
  badge?: 'daily' | 'divergence';
};

const tabs: TabDefinition[] = [
  { id: 'RESUMO', label: 'Visão objetiva', icon: ShieldCheck, active: 'border-[var(--theme-color)] text-[var(--theme-color)]' },
  { id: 'FECHAMENTO', label: 'Fechamento diário', icon: Calendar, active: 'border-blue-600 text-blue-600 dark:text-blue-400', badge: 'daily' },
  { id: 'REGRA_1', label: 'Regra 1 · Clube × D+31', icon: Layers, active: 'border-indigo-600 text-indigo-600 dark:text-indigo-400' },
  { id: 'REGRA_2', label: 'Regra 2 · PDV × Adquirente', icon: CreditCard, active: 'border-emerald-600 text-emerald-600 dark:text-emerald-400' },
  { id: 'REGRA_3', label: 'Regra 3 · Assinaturas', icon: Sparkles, active: 'border-indigo-600 text-indigo-600 dark:text-indigo-400' },
  { id: 'DIVERGENCIAS', label: 'Auditoria', icon: AlertTriangle, active: 'border-red-600 text-red-600 dark:text-red-400', badge: 'divergence' },
];

export function ReconciliationWorkspaceTabs({ activeTab, dailyClosingCount, divergenceCount, onChange }: ReconciliationWorkspaceTabsProps) {
  return (
    <div className="border-b border-gray-200 px-4 pt-3 dark:border-zinc-800 sm:px-6">
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Áreas da conciliação">
        {tabs.map(({ id, label, icon: Icon, active, badge }) => {
          const count = badge === 'daily' ? dailyClosingCount : badge === 'divergence' ? divergenceCount : 0;
          const badgeClass = badge === 'divergence'
            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => onChange(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-sm font-extrabold transition-all ${
                activeTab === id
                  ? active
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { RefreshCcw, Save, ShieldCheck } from 'lucide-react';

type ImportPreviewHeaderProps = {
  description: string;
  summary: { read: number; valid: number; ignored: number };
  isSaving: boolean;
  onSave: () => void;
};

export function ImportPreviewHeader({ description, summary, isSaving, onSave }: ImportPreviewHeaderProps) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 md:flex-row">
      <div>
        <h3 className="font-bold text-gray-900 dark:text-zinc-100">Pré-visualização da Importação</h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{summary.read} linhas lidas</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{summary.valid} válidas</span>
          {summary.ignored > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{summary.ignored} ignoradas</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300"><ShieldCheck className="h-3.5 w-3.5" /> duplicidade protegida</span>
        </div>
      </div>
      <button type="button" onClick={onSave} disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--theme-color)] px-6 py-2.5 font-bold text-white shadow-lg transition-colors hover:bg-[var(--theme-color-strong)] disabled:opacity-60 md:w-auto">
        {isSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Confirmar e Salvar
      </button>
    </div>
  );
}

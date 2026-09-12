import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { AppButton } from './AppPrimitives';

type ConfirmationOptions = {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'warning';
};

type ConfirmationContextValue = (options: ConfirmationOptions) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [closing, setClosing] = useState(false);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmationOptions) => {
    resolver.current?.(false);
    setOptions(nextOptions);
    setClosing(false);
    return new Promise<boolean>(resolve => { resolver.current = resolve; });
  }, []);

  const finish = (confirmed: boolean) => {
    if (closing) return;
    setClosing(true);
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
    setClosing(false);
  };

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) finish(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="global-confirm-title" aria-describedby="global-confirm-description" className="w-full rounded-t-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${options.tone === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}><AlertTriangle className="h-6 w-6" /></span>
              <button type="button" onClick={() => finish(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <h2 id="global-confirm-title" className="mt-4 text-xl font-black text-gray-950 dark:text-white">{options.title || 'Confirmar exclusão'}</h2>
            <p id="global-confirm-description" className="mt-2 text-sm leading-6 text-gray-600 dark:text-zinc-400">{options.description}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppButton onClick={() => finish(false)}>{options.cancelText || 'Cancelar'}</AppButton>
              <AppButton variant="danger" onClick={() => finish(true)}>{closing && <Loader2 className="h-4 w-4 animate-spin" />}{options.confirmText || 'Excluir'}</AppButton>
            </div>
          </section>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error('useConfirmation deve ser usado dentro de ConfirmationProvider.');
  return context;
}

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorName?: string;
  errorMessage?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      errorName: error.name,
      errorMessage: error.message
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    
    // Auto-recover from specific known DOM mutation errors (translation errors, DOM node mismatches, etc.)
    const isDOMError = 
      error.name === 'NotFoundError' || 
      error.message?.includes('can not be found here') || 
      error.message?.includes('removeChild') ||
      error.message?.includes('insertBefore');

    if (isDOMError) {
      console.warn("DOM exception detected. Auto-recovering standard React layout...");
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50/40 via-gray-50 to-orange-50/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200/60 bg-white p-5 text-center shadow-xl dark:bg-zinc-900 sm:rounded-3xl sm:p-8">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 font-sans">Ops! Algo deu errado</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium font-sans">
              Detectamos uma instabilidade temporária na renderização dos elementos. Recomenda-se atualizar a página.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-98 font-sans text-sm cursor-pointer"
            >
              Recarregar Painel
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

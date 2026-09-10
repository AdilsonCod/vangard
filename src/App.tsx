import React, { Suspense, useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import Login from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import PublicLinkRedirect from './components/PublicLinkRedirect';

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const BarberDashboard = React.lazy(() => import('./components/BarberDashboard'));

const THEME_COLORS: Record<string, { main: string; strong: string; soft: string }> = {
  green: { main: '#22c55e', strong: '#16a34a', soft: '#dcfce7' },
  red: { main: '#ef4444', strong: '#dc2626', soft: '#fee2e2' },
  blue: { main: '#3b82f6', strong: '#2563eb', soft: '#dbeafe' },
  orange: { main: '#f97316', strong: '#ea580c', soft: '#ffedd5' },
  purple: { main: '#a855f7', strong: '#9333ea', soft: '#f3e8ff' },
};

function LoadingFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-gray-300 border-t-[var(--theme-color)] dark:border-zinc-700 dark:border-t-[var(--theme-color)]" />
        <p className="text-sm text-gray-500 dark:text-zinc-400 font-sans">Carregando...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser, isDarkMode, themeColor, themeLightBg, themeDarkBg } = useStore();
  const redirectMatch = window.location.pathname.match(/^\/r\/([^/]+)\/?$/i);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Light themes
    document.body.classList.remove('theme-light-pure', 'theme-light-cool');
    if (themeLightBg === 'bg-white') {
      document.body.classList.add('theme-light-pure');
    } else if (themeLightBg === 'bg-gray-50') {
      // default is cool/warm depending on setup, but let's keep it simple
    } else if (themeLightBg === 'bg-zinc-50') {
      document.body.classList.add('theme-light-cool');
    }

    // Dark themes
    document.body.classList.remove('theme-dark-warm', 'theme-dark-pure');
    if (themeDarkBg === 'dark:bg-gray-950') {
      document.body.classList.add('theme-dark-warm');
    } else if (themeDarkBg === 'dark:bg-black') {
      document.body.classList.add('theme-dark-pure');
    }
  }, [themeLightBg, themeDarkBg]);

  useEffect(() => {
    const palette = THEME_COLORS[themeColor] || THEME_COLORS.orange;
    document.documentElement.style.setProperty('--theme-color', palette.main);
    document.documentElement.style.setProperty('--theme-color-strong', palette.strong);
    document.documentElement.style.setProperty('--theme-color-soft', palette.soft);
  }, [themeColor]);

  if (redirectMatch) return <PublicLinkRedirect code={decodeURIComponent(redirectMatch[1])} />;

  if (!currentUser) return <Login />;
  
  if (currentUser.role === 'ADMIN' || currentUser.role === 'FINANCIAL' || currentUser.role === 'MARKETING' || currentUser.role === 'RECEPTION') {
    return <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>;
  }
  
  return <Suspense fallback={<LoadingFallback />}><BarberDashboard /></Suspense>;
}

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </StoreProvider>
  );
}

import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import BarberDashboard from './components/BarberDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

const THEME_COLORS: Record<string, { main: string; strong: string; soft: string }> = {
  green: { main: '#22c55e', strong: '#16a34a', soft: '#dcfce7' },
  red: { main: '#ef4444', strong: '#dc2626', soft: '#fee2e2' },
  blue: { main: '#3b82f6', strong: '#2563eb', soft: '#dbeafe' },
  orange: { main: '#f97316', strong: '#ea580c', soft: '#ffedd5' },
  purple: { main: '#a855f7', strong: '#9333ea', soft: '#f3e8ff' },
};

function AppContent() {
  const { currentUser, isDarkMode, themeColor, themeLightBg, themeDarkBg } = useStore();

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

  if (!currentUser) return <Login />;
  
  if (currentUser.role === 'ADMIN' || currentUser.role === 'FINANCIAL' || currentUser.role === 'MARKETING') return <AdminDashboard />;
  
  return <BarberDashboard />;
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

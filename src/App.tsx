import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './store';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import BarberDashboard from './components/BarberDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

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
    document.documentElement.style.setProperty('--theme-color', themeColor || '#0ea5e9'); // Default or fallback
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

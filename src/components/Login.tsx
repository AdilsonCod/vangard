import React, { useState } from "react";
import { useStore } from "../store";
import VansLogo from "./VansLogo";
import { Sun, Moon } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { login, isDarkMode, setIsDarkMode } = useStore();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(email, password)) {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4 relative overflow-hidden transition-all duration-500">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[var(--theme-color)]/10 dark:bg-[var(--theme-color)]/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-45 -right-45 w-96 h-96 rounded-full bg-gray-600/20 dark:bg-gray-800/20 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white dark:bg-zinc-900 backdrop-blur-md p-8 rounded-3xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-zinc-800 relative z-10 transition-all duration-300">
        <div className="absolute top-6 right-6">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-sm"
            aria-label="Alternar tema"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-purple-700" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-48 h-48 mb-4 flex items-center justify-center filter drop-shadow-lg transition-transform hover:scale-105 duration-350">
            <img
              src="/logo-escura.png"
              alt="Logo Van's Management"
              className="w-full h-full object-contain block dark:hidden"
              referrerPolicy="no-referrer"
            />
            <img
              src="/logo-clara.png"
              alt="Logo Van's Management"
              className="w-full h-full object-contain hidden dark:block"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 font-sans text-center">
            Van's Management
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1 text-center font-sans">
            Bem-vindo(a) à nossa plataforma corporativa
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm rounded-xl text-center font-semibold font-sans border border-red-200/50 dark:border-red-900/30">
              Credenciais inválidas
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-zinc-400 mb-2 font-sans">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none transition-all font-sans text-sm shadow-sm"
              placeholder="Digite seu email (ex: joao@vans.com)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-zinc-400 mb-2 font-sans">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-[var(--theme-color)] focus:border-transparent outline-none transition-all font-sans text-sm shadow-sm"
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[var(--theme-color)] hover:bg-[var(--theme-color)] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[var(--theme-color)]/20 active:scale-[0.98] transform font-sans cursor-pointer flex items-center justify-center text-sm"
          >
            Entrar no Painel
          </button>
        </form>

      </div>
    </div>
  );
}

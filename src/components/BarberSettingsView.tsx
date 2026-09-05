import React, { useState } from 'react';
import { useStore } from '../store';
import { Settings, Save, Palette, User } from 'lucide-react';

export function BarberSettingsView() {
  const { currentUser, updateUser, themeColor, setThemeColor, themeLightBg, setThemeLightBg, themeDarkBg, setThemeDarkBg } = useStore();
  
  const [name, setName] = useState(currentUser?.name || '');
  const [saved, setSaved] = useState(false);

  if (!currentUser) return null;

  const handleSaveContactInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      ...currentUser,
      name
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const themeColors = [
    { id: 'green', label: 'Verde', bg: '#22c55e' },
    { id: 'red', label: 'Vermelho', bg: '#ef4444' },
    { id: 'blue', label: 'Azul', bg: '#3b82f6' },
    { id: 'orange', label: 'Laranja', bg: '#f97316' },
    { id: 'purple', label: 'Roxo', bg: '#a855f7' }
  ];

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6 text-gray-900 dark:text-white" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurações</h2>
      </div>

      <div className="app-themed-panel bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
          <User className="w-4 h-4" /> Perfil
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveContactInfo} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
            <div className="pt-2">
              <button 
                type="submit" 
                className={`w-full py-2 px-4 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <Save className="w-4 h-4" />
                {saved ? 'Salvo com sucesso!' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="app-themed-panel bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
          <Palette className="w-4 h-4" /> Personalização
        </div>
        
        <div className="p-6 space-y-6">
          

          <div>
            <label className="block text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3">Cor de Destaque Primária</label>
            <div className="flex flex-wrap gap-3">
              {themeColors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setThemeColor(c.id)}
                  style={{backgroundColor: c.bg}} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${themeColor === c.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'}`}
                  title={c.label}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 font-medium">
              Esta cor altera o estilo de botões e destaques na sua visão. Ela só afeta você.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-zinc-800">
            <label className="block text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3">Fundo (Modo Claro)</label>
            <div className="flex flex-wrap gap-3">
               {[
                 { id: 'bg-white', label: 'Branco Puro' },
                 { id: 'bg-gray-50', label: 'Cinza Quente' },
                 { id: 'bg-zinc-50', label: 'Verde Frio (Zinc)' }
               ].map(bg => (
                 <button
                   key={bg.id}
                   onClick={() => setThemeLightBg(bg.id)}
                   className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${themeLightBg === bg.id ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                 >
                   {bg.label}
                 </button>
               ))}
            </div>
         </div>

         <div className="pt-6 border-t border-gray-200 dark:border-zinc-800">
            <label className="block text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3">Fundo (Modo Escuro)</label>
            <div className="flex flex-wrap gap-3">
               {[
                 { id: 'dark:bg-zinc-950', label: 'Verde Frio (Zinc)' },
                 { id: 'dark:bg-gray-950', label: 'Marrom Quente (Gray)' },
                 { id: 'dark:bg-black', label: 'Preto Puro' }
               ].map(bg => (
                 <button
                   key={bg.id}
                   onClick={() => setThemeDarkBg(bg.id)}
                   className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${themeDarkBg === bg.id ? 'border-white text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                 >
                   {bg.label}
                 </button>
               ))}
            </div>
         </div>

        </div>
      </div>
    </div>
  );
}

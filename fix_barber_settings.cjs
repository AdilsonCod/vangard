const fs = require('fs');
let content = fs.readFileSync('src/components/BarberSettingsView.tsx', 'utf8');

// Ensure we get setThemeLightBg, setThemeDarkBg etc.
content = content.replace(
  /const \{ currentUser, updateUser, themeColor, setThemeColor, isDarkMode, setIsDarkMode \} = useStore\(\);/,
  `const { currentUser, updateUser, themeColor, setThemeColor, isDarkMode, setIsDarkMode, themeLightBg, setThemeLightBg, themeDarkBg, setThemeDarkBg } = useStore();`
);

const newPersonalization = `
          {/* Light/Dark Mode */}
          <div>
             <label className="block text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3">Modo Escuro (Dark Mode)</label>
             <div className="flex bg-gray-100 dark:bg-zinc-900 p-1 rounded-xl border border-gray-200/50 dark:border-zinc-800">
               <button
                  onClick={() => setIsDarkMode(false)}
                  className={\`flex-1 py-2 px-4 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all \${!isDarkMode ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"}\`}
               >
                 <Sun className="w-4 h-4" /> Claro
               </button>
               <button
                  onClick={() => setIsDarkMode(true)}
                  className={\`flex-1 py-2 px-4 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all \${isDarkMode ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm" : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"}\`}
               >
                 <Moon className="w-4 h-4" /> Escuro
               </button>
             </div>
          </div>

          <div className="border-t border-gray-200 dark:border-zinc-800 pt-6">
            <label className="block text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3">Cor de Destaque Primária</label>
            <div className="flex flex-wrap gap-3">
              {themeColors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setThemeColor(c.id)}
                  style={{backgroundColor: c.bg}} className={\`w-10 h-10 rounded-full flex items-center justify-center transition-all \${themeColor === c.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'}\`}
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
                   className={\`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium \${themeLightBg === bg.id ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}\`}
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
                   className={\`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium \${themeDarkBg === bg.id ? 'border-white text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}\`}
                 >
                   {bg.label}
                 </button>
               ))}
            </div>
         </div>
`;

content = content.replace(/\{\/\* Light\/Dark Mode \*\/\}[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\);)/, newPersonalization);

fs.writeFileSync('src/components/BarberSettingsView.tsx', content, 'utf8');

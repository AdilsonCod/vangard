import React, { useRef, useState } from "react";
import { useStore } from "../store";
import { ImagePlus, Palette, RotateCcw, Upload } from "lucide-react";
import { AppPageHeader } from "./ui/AppPrimitives";
import { DEFAULT_DARK_LOGO, DEFAULT_LIGHT_LOGO, prepareLogoImage } from '../services/logoCustomization';

export function ConfigEditor() {
  const { 
    isDarkMode, 
    setIsDarkMode,
    themeColor,
    setThemeColor, themeLightBg, setThemeLightBg, themeDarkBg, setThemeDarkBg,
    lightLogo, setLightLogo, darkLogo, setDarkLogo,
  } = useStore();
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');
  const [loadingLogo, setLoadingLogo] = useState<'light' | 'dark' | null>(null);

  const uploadLogo = async (mode: 'light' | 'dark', file?: File) => {
    if (!file) return;
    setLogoError('');
    setLoadingLogo(mode);
    try {
      const logo = await prepareLogoImage(file);
      if (mode === 'light') setLightLogo(logo);
      else setDarkLogo(logo);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Não foi possível carregar a imagem.');
    } finally {
      setLoadingLogo(null);
      if (mode === 'light' && lightInputRef.current) lightInputRef.current.value = '';
      if (mode === 'dark' && darkInputRef.current) darkInputRef.current.value = '';
    }
  };

  const lightBgOptions = [
    { id: 'bg-white', label: 'Branco Puro', bg: '#ffffff' },
    { id: 'bg-gray-50', label: 'Cinza Quente', bg: '#fcfaf8' },
    { id: 'bg-zinc-50', label: 'Verde Frio (Zinc)', bg: '#eef3f3' }
  ];

  const darkBgOptions = [
    { id: 'dark:bg-zinc-950', label: 'Verde Frio (Zinc)', bg: '#001414' },
    { id: 'dark:bg-gray-950', label: 'Marrom Quente (Gray)', bg: '#2E1A11' },
    { id: 'dark:bg-black', label: 'Preto Puro', bg: '#000000' }
  ];

  const themeColors = [
    { id: 'green', label: 'Verde', bg: '#22c55e' },
    { id: 'red', label: 'Vermelho', bg: '#ef4444' },
    { id: 'blue', label: 'Azul', bg: '#3b82f6' },
    { id: 'orange', label: 'Laranja', bg: '#f97316' },
    { id: 'purple', label: 'Roxo', bg: '#a855f7' }
  ];

  return (
    <div className="relative space-y-6 sm:space-y-8">
      <AppPageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Personalize a aparência e os padrões visuais utilizados em todas as áreas do aplicativo."
        icon={<Palette className="h-5 w-5" />}
      />
      <section className="rounded-2xl border border-gray-150 bg-white p-4 shadow-xs transition-colors dark:border-zinc-800/80 dark:bg-zinc-900 sm:p-6">
          <div className="flex items-center gap-2 border-b dark:border-zinc-800/80 pb-4 mb-6">
             <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
               <Palette className="w-5 h-5" />
             </div>
             <div>
               <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 leading-tight">Personalização de Tema</h2>
               <p className="text-xs text-gray-500 dark:text-zinc-400">Gerencie as cores do sistema</p>
             </div>
          </div>
          
          <div className="space-y-6">
             <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Cor de Destaque Primária</label>
                <div className="flex flex-wrap gap-3">
                   {themeColors.map(color => (
                     <button
                       key={color.id}
                       onClick={() => setThemeColor(color.id)}
                       className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${themeColor === color.id ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-gray-900 dark:ring-white scale-110' : 'hover:scale-105'}`}
                       style={{ backgroundColor: color.bg }}
                       title={color.label}
                     />
                   ))}
                </div>
             </div>

             <div className="pt-6 border-t dark:border-zinc-800/80">
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Fundo (Modo Claro)</label>
                <div className="flex flex-wrap gap-3">
                   {lightBgOptions.map(bg => (
                     <button
                       key={bg.id}
                       onClick={() => setThemeLightBg(bg.id)}
                       className={`w-full rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all sm:w-auto ${themeLightBg === bg.id ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                     >
                       {bg.label}
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-6 border-t dark:border-zinc-800/80">
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Fundo (Modo Escuro)</label>
                <div className="flex flex-wrap gap-3">
                   {darkBgOptions.map(bg => (
                     <button
                       key={bg.id}
                       onClick={() => setThemeDarkBg(bg.id)}
                       className={`w-full rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all sm:w-auto ${themeDarkBg === bg.id ? 'border-white text-white bg-zinc-800' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                     >
                       {bg.label}
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-6 border-t dark:border-zinc-800/80">
               <div className="mb-4 flex items-center gap-2">
                 <ImagePlus className="h-5 w-5 text-[var(--theme-color)]" />
                 <div>
                   <h3 className="text-sm font-bold text-gray-900 dark:text-white">Logos do sistema</h3>
                   <p className="text-xs text-gray-500 dark:text-zinc-400">PNG, JPG ou WebP de até 3 MB. A imagem é ajustada e salva neste navegador.</p>
                 </div>
               </div>
               <div className="grid gap-4 lg:grid-cols-2">
                 {([
                   { mode: 'light' as const, label: 'Logo — Fundo (Modo Claro)', logo: lightLogo, fallback: DEFAULT_LIGHT_LOGO, inputRef: lightInputRef },
                   { mode: 'dark' as const, label: 'Logo — Fundo (Modo Escuro)', logo: darkLogo, fallback: DEFAULT_DARK_LOGO, inputRef: darkInputRef },
                 ]).map(option => (
                   <div key={option.mode} className={`rounded-xl border p-4 ${option.mode === 'dark' ? 'border-zinc-700 bg-[#061b1b]' : 'border-gray-200 bg-white'}`}>
                     <p className={`mb-3 text-sm font-semibold ${option.mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>{option.label}</p>
                     <div className="mb-4 flex h-28 items-center justify-center rounded-lg border border-dashed border-gray-300/70 bg-black/[.03] p-3 dark:bg-white/[.04]">
                       <img src={option.logo} alt={`Pré-visualização: ${option.label}`} className="h-full max-w-full object-contain" />
                     </div>
                     <input ref={option.inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={option.label} onChange={event => void uploadLogo(option.mode, event.target.files?.[0])} />
                     <div className="flex flex-wrap gap-2">
                       <button type="button" disabled={loadingLogo !== null} onClick={() => option.inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--theme-color)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                         <Upload className="h-4 w-4" />{loadingLogo === option.mode ? 'Processando...' : 'Carregar imagem'}
                       </button>
                       <button type="button" disabled={option.logo === option.fallback} onClick={() => option.mode === 'light' ? setLightLogo(option.fallback) : setDarkLogo(option.fallback)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${option.mode === 'dark' ? 'border-zinc-600 text-zinc-200' : 'border-gray-300 text-gray-700'}`}>
                         <RotateCcw className="h-4 w-4" />Restaurar padrão
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
               {logoError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{logoError}</p>}
             </div>

          </div>
      </section>
    </div>
  );
}

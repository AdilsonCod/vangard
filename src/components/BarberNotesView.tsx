import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Edit3, Save, Check } from "lucide-react";

export function BarberNotesView() {
  const { currentUser, updateUser } = useStore();
  const [notes, setNotes] = useState(currentUser?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setNotes(currentUser.notes || "");
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await updateUser({ ...currentUser, notes });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar anotações:", error);
      alert("Erro ao salvar anotações");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-themed-panel flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--theme-color)]/10 rounded-xl flex items-center justify-center">
            <Edit3 className="w-6 h-6 text-[var(--theme-color)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
              Meu Bloco de Notas
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Espaço livre para suas anotações pessoais, lembretes e rascunhos.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--theme-color)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? (
            "Salvando..."
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4" /> Salvo
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Salvar Notas
            </>
          )}
        </button>
      </div>

      <div className="app-themed-panel bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4 sm:p-6">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escreva suas anotações aqui..."
          className="w-full h-[500px] p-4 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]/50 transition-all text-gray-700 dark:text-zinc-300 placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}

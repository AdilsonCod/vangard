import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "../store";
import {
  Megaphone,
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  AlertTriangle,
  Flame,
} from "lucide-react";

export function BarberAnnouncementsView() {
  const { currentUser, announcements, systemUnits } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);

  // Load read announcements from localStorage for the current barber
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`read_announcements_${currentUser.id}`);
      if (saved) {
        try {
          setReadAnnouncements(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [currentUser]);

  // Handle marking an announcement as read/unread
  const toggleReadStatus = (id: string) => {
    if (!currentUser) return;
    const isCurrentlyRead = readAnnouncements.includes(id);
    let updated: string[];
    if (isCurrentlyRead) {
      updated = readAnnouncements.filter((annId) => annId !== id);
    } else {
      updated = [...readAnnouncements, id];
    }
    setReadAnnouncements(updated);
    localStorage.setItem(
      `read_announcements_${currentUser.id}`,
      JSON.stringify(updated),
    );
  };

  const toggleAllAsRead = () => {
    if (!currentUser || !filteredAnnouncements.length) return;
    const allIds = filteredAnnouncements.map((a) => a.id);
    const updated = Array.from(new Set([...readAnnouncements, ...allIds]));
    setReadAnnouncements(updated);
    localStorage.setItem(
      `read_announcements_${currentUser.id}`,
      JSON.stringify(updated),
    );
  };

  // Filter announcements relevant to the barber
  const relevantAnnouncements = useMemo(() => {
    return (announcements || [])
      .filter(
        (a) =>
          a.unitId === "ALL" ||
          (currentUser?.unit && a.unitId === currentUser.unit),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [announcements, currentUser]);

  // Apply search term and tag filters
  const filteredAnnouncements = useMemo(() => {
    return relevantAnnouncements.filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "ALL" || a.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [relevantAnnouncements, searchTerm, filterType]);

  const getUnitName = (uid: string) => {
    if (uid === "ALL") return "Todas Unidades";
    return systemUnits.find((u) => u.id === uid)?.name || uid;
  };

  const getAnnouncementBadge = (type: string) => {
    switch (type) {
      case "IMPORTANT":
        return {
          bg: "bg-orange-50 border-orange-200 text-orange-850 dark:bg-orange-950/20 dark:border-orange-900/40 dark:text-orange-400",
          icon: <AlertTriangle className="w-4 h-4 text-orange-550" />,
          label: "Importante",
        };
      case "ALERT":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-850 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-450",
          icon: <Flame className="w-4 h-4 text-rose-550 animate-pulse" />,
          label: "Urgente",
        };
      case "CELEBRATION":
        return {
          bg: "bg-emerald-50 border-emerald-255 text-emerald-850 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-450",
          icon: <Sparkles className="w-4 h-4 text-emerald-550" />,
          label: "Conquista 🎉",
        };
      default:
        return {
          bg: "bg-blue-50 border-blue-200 text-blue-850 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-450",
          icon: <Info className="w-4 h-4 text-blue-550" />,
          label: "Informativo",
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-305">
      {/* HEADER SECTION */}
      <div className="app-themed-panel flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <Megaphone className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              Quadro de Avisos & Mural
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Fique sempre informado sobre as notícias e regras corporativas.
            </p>
          </div>
        </div>

        {filteredAnnouncements.some((a) => !readAnnouncements.includes(a.id)) && (
          <button
            onClick={toggleAllAsRead}
            className="self-start md:self-auto px-4 py-2 bg-gray-105 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-gray-200 dark:border-zinc-700"
          >
            <CheckCircle className="w-4 h-4 text-emerald-550" />
            Marcar Todos como Lidos
          </button>
        )}
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="app-themed-panel bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar aviso..."
            className="w-full h-[40px] pl-10 pr-3 text-xs bg-gray-50/55 dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-100 rounded-xl border border-gray-200 dark:border-zinc-805 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto py-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0 hidden sm:block" />
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer border ${
              filterType === "ALL"
                ? "bg-amber-600 border-amber-653 text-white shadow-xs"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-350 border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType("IMPORTANT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer border ${
              filterType === "IMPORTANT"
                ? "bg-orange-500 border-orange-553 text-white shadow-xs"
                : "bg-gray-50 dark:bg-zinc-805 text-orange-655 dark:text-orange-400 border-transparent hover:border-orange-100 dark:hover:border-orange-950/30"
            }`}
          >
            Importantes
          </button>
          <button
            onClick={() => setFilterType("ALERT")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer border ${
              filterType === "ALERT"
                ? "bg-rose-650 border-rose-700 text-white shadow-xs"
                : "bg-gray-50 dark:bg-zinc-805 text-rose-655 dark:text-rose-400 border-transparent hover:border-rose-100 dark:hover:border-rose-950/30"
            }`}
          >
            Urgentes
          </button>
          <button
            onClick={() => setFilterType("CELEBRATION")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer border ${
              filterType === "CELEBRATION"
                ? "bg-emerald-600 border-emerald-653 text-white shadow-xs"
                : "bg-gray-50 dark:bg-zinc-805 text-emerald-655 dark:text-emerald-400 border-transparent hover:border-emerald-100 dark:hover:border-emerald-950/30"
            }`}
          >
            Conquistas
          </button>
          <button
            onClick={() => setFilterType("INFO")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer border ${
              filterType === "INFO"
                ? "bg-blue-600 border-blue-653 text-white shadow-xs"
                : "bg-gray-50 dark:bg-zinc-805 text-blue-655 dark:text-blue-400 border-transparent hover:border-blue-105 dark:hover:border-blue-950/30"
            }`}
          >
            Informativos
          </button>
        </div>
      </div>

      {/* ANNOUNCEMENTS CONTAINER */}
      {filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-gray-55 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-zinc-550">
            <Megaphone className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-905 dark:text-zinc-100 mb-1">
            Nenhum aviso encontrado
          </h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-md mx-auto">
            {searchTerm || filterType !== "ALL"
              ? "Experimente mudar seu termo de pesquisa ou limpar os filtros para visualizar outros canais."
              : "Excelente trabalho! Não há avisos ou notificações de gestão no seu mural até o momento."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAnnouncements.map((announcement) => {
            const isRead = readAnnouncements.includes(announcement.id);
            const badge = getAnnouncementBadge(announcement.type);

            return (
              <div
                key={announcement.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-300 p-5 shadow-xs flex flex-col justify-between ${
                  isRead
                    ? "border-gray-200 dark:border-zinc-800/60 opacity-80 hover:opacity-100"
                    : "border-amber-400/80 dark:border-amber-900/60 shadow-amber-50/10 dark:shadow-none hover:border-amber-500"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3.5">
                    {/* Badge */}
                    <span
                      className={`px-2.5 py-1 border rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${badge.bg}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>

                    {/* Mark as read checkbox button */}
                    <button
                      onClick={() => toggleReadStatus(announcement.id)}
                      className={`text-2xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        isRead
                          ? "bg-gray-50 border-gray-150 text-gray-400 dark:bg-zinc-800/40 dark:border-zinc-700/60 dark:text-zinc-500 hover:text-amber-550"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      }`}
                      title={isRead ? "Marcar como não lido" : "Confirmar leitura"}
                    >
                      <CheckCircle
                        className={`w-3.5 h-3.5 ${
                          isRead ? "text-emerald-500" : "text-gray-405"
                        }`}
                      />
                      <span>{isRead ? "Lido" : "Marcar Lido"}</span>
                    </button>
                  </div>

                  {/* Title & Content */}
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-zinc-100 mb-2.5 uppercase tracking-tight leading-snug">
                    {announcement.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-zinc-350 leading-relaxed whitespace-pre-wrap mb-4 font-normal">
                    {announcement.content}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="pt-3.5 border-t border-gray-101 dark:border-zinc-800/70 flex items-center justify-between gap-1 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                  <div className="flex items-center gap-1 shrink-0 truncate max-w-[50%]">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-550 shrink-0" />
                    <span className="truncate">Por {announcement.createdBy || "Admin"}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-550" />
                    <span>
                      {new Date(announcement.createdAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

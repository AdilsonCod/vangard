import { useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Filter, Megaphone, DollarSign, BarChart3, Trophy, Trash2, ExternalLink } from 'lucide-react';
import { useStore } from '../store';
import type { SystemNotification, NotificationEventType } from '../types';

type FilterTab = 'ALL' | 'UNREAD' | 'mural' | 'financial' | 'analysis' | 'ranking';

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Bell }[] = [
  { id: 'ALL', label: 'Todas', icon: Bell },
  { id: 'UNREAD', label: 'Não lidas', icon: Bell },
  { id: 'mural', label: 'Mural', icon: Megaphone },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'analysis', label: 'Análises', icon: BarChart3 },
  { id: 'ranking', label: 'Rankings', icon: Trophy },
];

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  urgent: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-l-red-500', label: 'Urgente' },
  high: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-500', label: 'Alta' },
  normal: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-500', label: 'Normal' },
  informational: { bg: 'bg-gray-500/10', text: 'text-gray-500 dark:text-gray-400', border: 'border-l-gray-400', label: 'Info' },
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, informational: 3 };

function matchesFilter(n: SystemNotification, filter: FilterTab): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'UNREAD') return !n.read;
  if (filter === 'mural') return n.eventType === 'mural';
  if (filter === 'financial') return n.eventType === 'payment_scheduled' || n.eventType === 'payment_completed';
  if (filter === 'analysis') return n.eventType === 'analysis_ready';
  if (filter === 'ranking') return n.eventType === 'ranking_changed';
  return true;
}

function eventTypeIcon(eventType?: NotificationEventType): string {
  switch (eventType) {
    case 'mural': return '🔔';
    case 'payment_scheduled': return '💰';
    case 'payment_completed': return '✅';
    case 'analysis_ready': return '📊';
    case 'ranking_changed': return '🏆';
    default: return '🔔';
  }
}

interface NotificationCenterProps {
  onNavigate?: (tabId: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { currentUser, notifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } = useStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications
      .filter(n => n.userId === currentUser.id)
      .filter(n => matchesFilter(n, activeFilter))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority || 'informational'] ?? 3;
        const pb = PRIORITY_ORDER[b.priority || 'informational'] ?? 3;
        if (pa !== pb) return pa - pb;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [currentUser, notifications, activeFilter]);

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return notifications.filter(n => n.userId === currentUser.id && !n.read).length;
  }, [currentUser, notifications]);

  const filterCounts = useMemo(() => {
    if (!currentUser) return {} as Record<FilterTab, number>;
    const all = notifications.filter(n => n.userId === currentUser.id);
    return {
      ALL: all.length,
      UNREAD: all.filter(n => !n.read).length,
      mural: all.filter(n => n.eventType === 'mural').length,
      financial: all.filter(n => n.eventType === 'payment_scheduled' || n.eventType === 'payment_completed').length,
      analysis: all.filter(n => n.eventType === 'analysis_ready').length,
      ranking: all.filter(n => n.eventType === 'ranking_changed').length,
    };
  }, [currentUser, notifications]);

  const handleAction = (n: SystemNotification) => {
    if (!n.read) markNotificationAsRead(n.id);
    if (n.actionTab && onNavigate) onNavigate(n.actionTab);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="app-themed-panel flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--theme-color)]/10 text-[var(--theme-color)]">
            <Bell className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Notificações</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="flex items-center gap-2 rounded-xl bg-[var(--theme-color)]/10 px-4 py-2.5 text-sm font-bold text-[var(--theme-color)] transition hover:bg-[var(--theme-color)]/20"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
        {FILTER_TABS.map(tab => {
          const count = filterCounts[tab.id] || 0;
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                isActive
                  ? 'bg-[var(--theme-color)] text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              } border ${isActive ? 'border-transparent' : 'border-gray-200 dark:border-zinc-800'}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {userNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 dark:border-zinc-700">
            <Filter className="mb-3 h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-gray-400 dark:text-zinc-500">
              {activeFilter === 'ALL' ? 'Nenhuma notificação ainda.' : 'Nenhuma notificação nesta categoria.'}
            </p>
          </div>
        ) : (
          userNotifications.map(notification => {
            const pStyle = PRIORITY_STYLES[notification.priority || 'informational'] || PRIORITY_STYLES.informational;
            const icon = notification.icon || eventTypeIcon(notification.eventType);

            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleAction(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAction(notification);
                  }
                }}
                className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:border-[var(--theme-color)]/30 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-color)] ${
                  notification.read
                    ? 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    : `border-gray-200 bg-gradient-to-r from-[var(--theme-color)]/[0.03] to-white dark:border-zinc-800 dark:from-[var(--theme-color)]/[0.05] dark:to-zinc-900`
                } border-l-[3px] ${pStyle.border}`}
              >
                <div className="flex items-start gap-4 p-4 sm:p-5">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                    notification.read ? 'bg-gray-100 dark:bg-zinc-800' : `${pStyle.bg}`
                  }`}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`text-sm font-black ${notification.read ? 'text-gray-600 dark:text-zinc-400' : 'text-gray-900 dark:text-white'}`}>
                            {notification.title}
                          </h3>
                          {notification.priority && notification.priority !== 'informational' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${pStyle.bg} ${pStyle.text}`}>
                              {pStyle.label}
                            </span>
                          )}
                          {notification.groupCount && notification.groupCount > 1 && (
                            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-black text-purple-600 dark:text-purple-400">
                              {notification.groupCount} itens
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 whitespace-pre-line text-xs leading-relaxed ${
                          notification.read ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-600 dark:text-zinc-300'
                        }`}>
                          {notification.message}
                        </p>
                      </div>

                      {/* Date & Delete */}
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-[10px] font-medium text-gray-400 dark:text-zinc-500">
                          {new Date(notification.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {' '}
                          {new Date(notification.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="invisible rounded-lg p-1 text-gray-400 transition hover:bg-red-500/10 hover:text-red-500 group-hover:visible"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-3">
                      {notification.actionLabel && notification.actionTab && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(notification);
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--theme-color)]/10 px-3 py-1.5 text-xs font-bold text-[var(--theme-color)] transition hover:bg-[var(--theme-color)]/20"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {notification.actionLabel}
                        </button>
                      )}
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markNotificationAsRead(notification.id);
                          }}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-500 transition hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          <Check className="h-3 w-3" />
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.read && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--theme-color)] shadow-sm shadow-[var(--theme-color)]/50" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

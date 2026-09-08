import { SystemNotification, SystemAnnouncement, FinancialTransaction, User, NotificationPriority } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── A. Notificações de Mural ───────────────────────────────────────────

function announcementPriority(type: SystemAnnouncement['type']): NotificationPriority {
  switch (type) {
    case 'ALERT': return 'urgent';
    case 'IMPORTANT': return 'high';
    case 'CELEBRATION': return 'normal';
    default: return 'informational';
  }
}

function announcementIcon(type: SystemAnnouncement['type']): string {
  switch (type) {
    case 'ALERT': return '🚨';
    case 'IMPORTANT': return '⚠️';
    case 'CELEBRATION': return '🎉';
    default: return '🔔';
  }
}

export function createAnnouncementNotifications(
  announcement: SystemAnnouncement,
  allUsers: User[],
  creatorId: string,
): SystemNotification[] {
  const eligible = allUsers.filter(u => {
    if (u.id === creatorId) return false;
    if (!u.isActive && u.isActive !== undefined) return false;
    const unitMatch = announcement.unitId === 'ALL' || u.unit === announcement.unitId;
    const roleMatch = !announcement.targetRoles?.length || announcement.targetRoles.includes(u.role);
    return unitMatch && roleMatch;
  });

  const priority = announcementPriority(announcement.type);
  const icon = announcementIcon(announcement.type);
  const priorityLabel = announcement.type === 'ALERT' ? 'Urgente' : announcement.type === 'IMPORTANT' ? 'Alta' : '';
  const titleSuffix = priorityLabel ? ` • ${priorityLabel}` : '';

  return eligible.map(user => ({
    id: uid(),
    userId: user.id,
    title: `${icon} Novo recado no mural${titleSuffix}`,
    message: `"${announcement.title}"\nPublicado por: ${announcement.createdBy}`,
    type: 'info' as const,
    createdAt: now(),
    read: false,
    eventType: 'mural' as const,
    priority,
    icon,
    actionLabel: 'Ver recado',
    actionTab: 'AVISOS',
    data: { announcementId: announcement.id, announcementTitle: announcement.title },
    groupId: `mural_${announcement.id}`,
  }));
}

// ─── B. Pagamento Agendado ──────────────────────────────────────────────

export function createPaymentScheduledNotifications(
  transaction: FinancialTransaction,
  allUsers: User[],
): SystemNotification[] {
  const recipients = allUsers.filter(u =>
    (u.role === 'ADMIN' || u.role === 'FINANCIAL') && (u.isActive !== false)
  );

  const isOverdue = transaction.dueDate && new Date(transaction.dueDate) < new Date();
  const icon = isOverdue ? '⚠️' : '💰';
  const priority: NotificationPriority = isOverdue ? 'high' : 'normal';
  const statusLabel = isOverdue ? 'VENCIDO' : 'Agendado';

  const lines = [
    transaction.supplier ? `Fornecedor: ${transaction.supplier}` : `Descrição: ${transaction.description}`,
    `Valor: ${formatCurrency(transaction.amount)}`,
    transaction.dueDate ? `Vencimento: ${formatDate(transaction.dueDate)}` : null,
    transaction.category ? `Categoria: ${transaction.category}` : null,
    isOverdue ? `⚠️ Status: ${statusLabel}` : null,
  ].filter(Boolean).join('\n');

  return recipients.map(user => ({
    id: uid(),
    userId: user.id,
    title: `${icon} Pagamento agendado`,
    message: lines,
    type: (isOverdue ? 'warning' : 'info') as 'warning' | 'info',
    createdAt: now(),
    read: false,
    eventType: 'payment_scheduled' as const,
    priority,
    icon,
    actionLabel: 'Ver pagamento',
    actionTab: 'FINANCE',
    data: {
      transactionId: transaction.id,
      amount: transaction.amount,
      dueDate: transaction.dueDate,
      supplier: transaction.supplier,
    },
    groupId: `payment_scheduled_${transaction.id}`,
  }));
}

// ─── C. Pagamento Realizado ─────────────────────────────────────────────

export function createPaymentCompletedNotifications(
  transaction: FinancialTransaction,
  allUsers: User[],
): SystemNotification[] {
  const recipients = allUsers.filter(u =>
    (u.role === 'ADMIN' || u.role === 'FINANCIAL') && (u.isActive !== false)
  );

  const lines = [
    transaction.supplier ? `Fornecedor: ${transaction.supplier}` : `Descrição: ${transaction.description}`,
    `Valor: ${formatCurrency(transaction.amount)}`,
    `Pago em: ${formatDate(transaction.date)}`,
  ].join('\n');

  return recipients.map(user => ({
    id: uid(),
    userId: user.id,
    title: '✅ Pagamento realizado',
    message: lines,
    type: 'success' as const,
    createdAt: now(),
    read: false,
    eventType: 'payment_completed' as const,
    priority: 'informational' as const,
    icon: '✅',
    actionLabel: 'Ver pagamento',
    actionTab: 'FINANCE',
    data: {
      transactionId: transaction.id,
      amount: transaction.amount,
      date: transaction.date,
      supplier: transaction.supplier,
    },
    groupId: `payment_completed_${transaction.id}`,
  }));
}

// ─── D. Análise Pronta ──────────────────────────────────────────────────

export function createAnalysisReadyNotifications(
  analysisType: string,
  period: string,
  summary: string,
  allUsers: User[],
  actionTab: string = 'REPORTS',
): SystemNotification[] {
  const recipients = allUsers.filter(u =>
    (u.role === 'ADMIN' || u.role === 'FINANCIAL') && (u.isActive !== false)
  );

  return recipients.map(user => ({
    id: uid(),
    userId: user.id,
    title: '📊 Nova análise disponível',
    message: `${analysisType} de ${period} está pronta.\n${summary}`,
    type: 'info' as const,
    createdAt: now(),
    read: false,
    eventType: 'analysis_ready' as const,
    priority: 'normal' as const,
    icon: '📊',
    actionLabel: 'Acessar análise',
    actionTab,
    data: { analysisType, period, summary },
    groupId: `analysis_${analysisType}_${period}`,
  }));
}

// ─── E. Alteração no Ranking ────────────────────────────────────────────

export interface RankingChange {
  userId: string;
  rankingName: string;
  previousPosition: number | null;
  newPosition: number;
  direction: 'up' | 'down' | 'entered' | 'exited';
}

export function createRankingChangedNotifications(
  changes: RankingChange[],
): SystemNotification[] {
  return changes.map(change => {
    let icon: string;
    let title: string;
    let message: string;
    let priority: NotificationPriority = 'informational';

    switch (change.direction) {
      case 'up':
        icon = '🏆';
        title = '🏆 Você subiu no ranking!';
        message = `Ranking: ${change.rankingName}\nPosição anterior: ${change.previousPosition}º\nNova posição: ${change.newPosition}º`;
        priority = change.newPosition <= 3 ? 'high' : 'normal';
        break;
      case 'down':
        icon = '📉';
        title = '📉 Alteração no ranking';
        message = `Ranking: ${change.rankingName}\nSua posição caiu de ${change.previousPosition}º para ${change.newPosition}º.`;
        priority = 'informational';
        break;
      case 'entered':
        icon = '🎯';
        title = '🎯 Novo destaque no ranking';
        message = `Você entrou no Top 5 de ${change.rankingName}.`;
        priority = 'normal';
        break;
      case 'exited':
        icon = '📉';
        title = '📉 Alteração no ranking';
        message = `Você saiu do Top 5 de ${change.rankingName}.`;
        priority = 'informational';
        break;
    }

    return {
      id: uid(),
      userId: change.userId,
      title,
      message,
      type: change.direction === 'up' || change.direction === 'entered' ? 'success' as const : 'info' as const,
      createdAt: now(),
      read: false,
      eventType: 'ranking_changed' as const,
      priority,
      icon,
      actionLabel: 'Ver ranking',
      actionTab: 'RANKINGS',
      data: {
        rankingName: change.rankingName,
        previousPosition: change.previousPosition,
        newPosition: change.newPosition,
        direction: change.direction,
      },
      groupId: `ranking_${change.rankingName}_${change.userId}`,
    };
  });
}

// ─── Agrupamento ────────────────────────────────────────────────────────

export function groupNotifications(
  notifications: SystemNotification[],
  existingNotifications: SystemNotification[],
): SystemNotification[] {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Check deduplication against existing
  const recentGroupIds = new Set(
    existingNotifications
      .filter(n => n.createdAt > fiveMinAgo && n.groupId)
      .map(n => n.groupId)
  );

  const deduped = notifications.filter(n => !n.groupId || !recentGroupIds.has(n.groupId));

  // Group same-type notifications for same user created in this batch
  const groups = new Map<string, SystemNotification[]>();

  for (const notif of deduped) {
    const key = `${notif.userId}_${notif.eventType}_${notif.priority}`;
    const group = groups.get(key) || [];
    group.push(notif);
    groups.set(key, group);
  }

  const result: SystemNotification[] = [];

  for (const [, group] of groups) {
    if (group.length <= 1 || group[0].eventType === 'mural') {
      result.push(...group);
      continue;
    }

    // Group payment notifications
    if (group[0].eventType === 'payment_scheduled' && group.length > 1) {
      const totalAmount = group.reduce((sum, n) => sum + ((n.data?.amount as number) || 0), 0);
      const earliest = group.reduce((e, n) => {
        const d = n.data?.dueDate as string | undefined;
        return d && (!e || d < e) ? d : e;
      }, '' as string);

      result.push({
        ...group[0],
        id: uid(),
        title: `💰 ${group.length} pagamentos foram agendados`,
        message: `Total: ${formatCurrency(totalAmount)}${earliest ? `\nPróximo vencimento: ${formatDate(earliest)}` : ''}`,
        groupCount: group.length,
        groupId: `batch_payment_${uid()}`,
      });
      continue;
    }

    if (group[0].eventType === 'payment_completed' && group.length > 1) {
      const totalAmount = group.reduce((sum, n) => sum + ((n.data?.amount as number) || 0), 0);
      result.push({
        ...group[0],
        id: uid(),
        title: `✅ ${group.length} pagamentos realizados`,
        message: `Total: ${formatCurrency(totalAmount)}`,
        groupCount: group.length,
        groupId: `batch_completed_${uid()}`,
      });
      continue;
    }

    // Default: no grouping
    result.push(...group);
  }

  return result;
}

// ─── Notification for barber payment (enriched version) ──────────────

export function createBarberPaymentNotification(
  barberId: string,
  amount: number,
  date: string,
  status: string,
): SystemNotification {
  return {
    id: uid(),
    userId: barberId,
    title: '💰 Novo Pagamento Registrado',
    message: `Um pagamento no valor de ${formatCurrency(amount)} referente a ${formatDate(date)} foi registrado com status: ${status}.`,
    type: 'success',
    createdAt: now(),
    read: false,
    eventType: 'payment_scheduled',
    priority: 'normal',
    icon: '💰',
    actionLabel: 'Ver pagamento',
    actionTab: 'PAGAMENTOS',
    data: { amount, date, status },
    groupId: `barber_payment_${barberId}_${date}`,
  };
}

// ─── Enriched goal-reached notification ─────────────────────────────────

export function createGoalReachedNotification(userId: string): SystemNotification {
  return {
    id: uid(),
    userId,
    title: '🏆 Objetivo Alcançado!',
    message: 'Parabéns! Com este lançamento você atingiu 100% do seu objetivo de faturamento!',
    type: 'success',
    createdAt: now(),
    read: false,
    eventType: 'ranking_changed',
    priority: 'high',
    icon: '🏆',
    actionLabel: 'Ver desempenho',
    actionTab: 'OVERVIEW',
    data: {},
    groupId: `goal_reached_${userId}_${new Date().toISOString().slice(0, 7)}`,
  };
}

import { maskMessagePhone, type MessageCampaignDocument, type MessageCampaignRecipientDocument } from './src/services/messageCampaignSchema';

export type CampaignPerformance = {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  delivered: number;
  read: number;
  responded: number;
  failed: number;
  averageProcessingMs: number;
  estimatedRemainingMs: number | null;
  failureReasons: Record<string, number>;
};

const timestamp = (value?: string | null) => value ? Date.parse(value) : Number.NaN;
const failureReason = (value?: string) => (value || 'Motivo não informado').trim().slice(0, 160);

export function buildCampaignPerformance(
  campaign: MessageCampaignDocument,
  recipients: MessageCampaignRecipientDocument[],
  respondedRecipientIds: Set<string> = new Set(),
  now = new Date(),
): CampaignPerformance {
  const scoped = recipients.filter(item => item.campaignId === campaign.id && item.unitId === campaign.unitId);
  const sent = scoped.filter(item => ['ENVIADO', 'ENTREGUE', 'LIDO'].includes(item.status)).length;
  const delivered = scoped.filter(item => ['ENTREGUE', 'LIDO'].includes(item.status)).length;
  const read = scoped.filter(item => item.status === 'LIDO').length;
  const failedItems = scoped.filter(item => item.status === 'FALHOU');
  const durations = scoped.map(item => timestamp(item.processedAt) - timestamp(item.createdAt)).filter(value => Number.isFinite(value) && value >= 0);
  const averageProcessingMs = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
  const remaining = scoped.filter(item => ['PENDENTE', 'PROCESSANDO'].includes(item.status)).length;
  const elapsed = Math.max(0, now.getTime() - timestamp(campaign.firstSentAt || campaign.createdAt));
  const measured = sent + failedItems.length;
  const estimatedRemainingMs = remaining && measured ? Math.round((elapsed / measured) * remaining) : remaining ? null : 0;
  const failureReasons: Record<string, number> = {};
  failedItems.forEach(item => { const reason = failureReason(item.lastError); failureReasons[reason] = (failureReasons[reason] || 0) + 1; });
  return { id: campaign.id, name: campaign.name, status: campaign.status, total: scoped.length || campaign.totalRecipients, sent, delivered, read, responded: scoped.filter(item => respondedRecipientIds.has(item.id)).length, failed: failedItems.length, averageProcessingMs, estimatedRemainingMs, failureReasons };
}

export function summarizeCampaignPerformance(items: CampaignPerformance[]) {
  const totals = items.reduce((sum, item) => ({ total: sum.total + item.total, sent: sum.sent + item.sent, delivered: sum.delivered + item.delivered, read: sum.read + item.read, responded: sum.responded + item.responded, failed: sum.failed + item.failed }), { total: 0, sent: 0, delivered: 0, read: 0, responded: 0, failed: 0 });
  const weighted = items.reduce((sum, item) => sum + item.averageProcessingMs * Math.max(1, item.sent + item.failed), 0);
  const measured = items.reduce((sum, item) => sum + Math.max(1, item.sent + item.failed), 0);
  const failureReasons: Record<string, number> = {};
  items.forEach(item => Object.entries(item.failureReasons).forEach(([reason, count]) => { failureReasons[reason] = (failureReasons[reason] || 0) + count; }));
  return { ...totals, campaigns: items.length, averageProcessingMs: items.length ? Math.round(weighted / measured) : 0, failureReasons };
}

export function safeCampaignRecipientExport(recipient: MessageCampaignRecipientDocument) {
  return { campaignId: recipient.campaignId, contact: maskMessagePhone(recipient.normalizedPhone), status: recipient.status, processedAt: recipient.processedAt || '', attempts: recipient.attemptCount, error: recipient.lastError || '' };
}

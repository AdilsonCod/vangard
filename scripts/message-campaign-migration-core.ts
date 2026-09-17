import { createHash } from 'node:crypto';
import { MESSAGE_CAMPAIGN_SCHEMA_VERSION, maskMessagePhone, type MessageCampaignDocument, type MessageCampaignRecipientDocument, type MessageCampaignStatus, type MessageRecipientStatus } from '../src/services/messageCampaignSchema';

export type LegacyDispatchHistory = {
  id: string;
  name?: string;
  unitId?: string;
  status?: string;
  message?: string;
  total?: number;
  successCount?: number;
  errorCount?: number;
  createdAt?: string;
  finishedAt?: string;
  createdBy?: string;
  createdByEmail?: string;
  contacts?: string[];
  deliveryDetails?: Array<{ contact?: string; status?: string; processedAt?: string; error?: string }>;
};

export type MessageCampaignMigrationPlan = {
  campaign: MessageCampaignDocument;
  recipients: MessageCampaignRecipientDocument[];
};

const normalizedPhone = (value: unknown) => String(value || '').replace(/\D/g, '');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function campaignStatus(value: unknown): MessageCampaignStatus {
  const status = String(value || '').toUpperCase();
  if (status.includes('CONCL')) return 'CONCLUIDA';
  if (status.includes('INTERROMP') || status.includes('CANCEL')) return 'CANCELADA';
  if (status.includes('FALHA')) return 'FALHOU';
  if (status.includes('ANDAMENTO') || status.includes('PROCESS')) return 'PAUSADA';
  return 'CONCLUIDA';
}

function recipientStatus(value: unknown): MessageRecipientStatus {
  const status = String(value || '').toUpperCase();
  if (status.includes('ENVI')) return 'ENVIADO';
  if (status.includes('ENTREG')) return 'ENTREGUE';
  if (status.includes('LIDO')) return 'LIDO';
  if (status.includes('FALHA')) return 'FALHOU';
  if (status.includes('CANCEL')) return 'CANCELADO';
  return 'PENDENTE';
}

export function planLegacyDispatchMigration(history: LegacyDispatchHistory): MessageCampaignMigrationPlan {
  const now = history.finishedAt || history.createdAt || new Date(0).toISOString();
  const campaignId = `legacy_${history.id}`;
  const detailed = history.deliveryDetails?.length
    ? history.deliveryDetails
    : (history.contacts || []).map(contact => ({ contact, status: 'PENDENTE' }));
  const unique = new Map<string, NonNullable<LegacyDispatchHistory['deliveryDetails']>[number]>();
  for (const detail of detailed) {
    const phone = normalizedPhone(detail.contact);
    if (phone && !unique.has(phone)) unique.set(phone, detail);
  }
  const recipients = [...unique.entries()].map(([phone, detail]) => {
    const idempotencyKey = digest(`${campaignId}:${phone}`);
    const status = recipientStatus(detail.status);
    return {
      schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION,
      id: `legacy_recipient_${idempotencyKey.slice(0, 32)}`,
      campaignId,
      unitId: history.unitId || 'ALL',
      normalizedPhone: phone,
      maskedPhone: maskMessagePhone(phone),
      status,
      idempotencyKey,
      attemptCount: status === 'PENDENTE' ? 0 : 1,
      maxAttempts: 3,
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      personalizedMessage: history.message || '',
      variables: {},
      createdAt: history.createdAt || now,
      updatedAt: detail.processedAt || now,
      ...(detail.processedAt ? { processedAt: detail.processedAt } : {}),
      ...(detail.error ? { lastError: detail.error } : {}),
    } satisfies MessageCampaignRecipientDocument;
  });
  const count = (status: MessageRecipientStatus) => recipients.filter(item => item.status === status).length;
  const total = Math.max(Number(history.total) || 0, recipients.length);
  const sent = count('ENVIADO');
  const delivered = count('ENTREGUE');
  const read = count('LIDO');
  const failed = recipients.length ? count('FALHOU') : Number(history.errorCount) || 0;
  const cancelled = count('CANCELADO');
  const summarizedWithoutRecipients = recipients.length === 0
    ? Math.max(0, total - (Number(history.successCount) || 0) - (Number(history.errorCount) || 0))
    : 0;
  const pending = recipients.length
    ? count('PENDENTE') + Math.max(0, total - recipients.length)
    : summarizedWithoutRecipients;
  const campaign: MessageCampaignDocument = {
    schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION,
    id: campaignId,
    unitId: history.unitId || 'ALL',
    name: history.name || 'Campanha legada',
    status: campaignStatus(history.status),
    message: history.message || '',
    totalRecipients: total,
    pendingCount: pending,
    processingCount: 0,
    sentCount: recipients.length ? sent : Number(history.successCount) || 0,
    deliveredCount: delivered,
    readCount: read,
    failedCount: failed,
    cancelledCount: cancelled,
    scheduledAt: null,
    createdAt: history.createdAt || now,
    createdBy: history.createdBy || 'MIGRATION',
    ...(history.createdByEmail ? { createdByEmail: history.createdByEmail } : {}),
    updatedAt: now,
    ...(history.finishedAt ? { finishedAt: history.finishedAt } : {}),
    legacyHistoryId: history.id,
  };
  return { campaign, recipients };
}

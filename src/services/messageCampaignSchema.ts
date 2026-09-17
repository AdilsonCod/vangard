export const MESSAGE_CAMPAIGN_SCHEMA_VERSION = 1 as const;

export type MessageCampaignStatus = 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'AGENDADA' | 'NA_FILA' | 'EM_PROCESSAMENTO' | 'PAUSADA' | 'CONCLUIDA' | 'FALHOU' | 'CANCELADA';
export type MessageRecipientStatus = 'PENDENTE' | 'PROCESSANDO' | 'ENVIADO' | 'ENTREGUE' | 'LIDO' | 'FALHOU' | 'CANCELADO';

export interface MessageCampaignDocument {
  schemaVersion: typeof MESSAGE_CAMPAIGN_SCHEMA_VERSION;
  id: string;
  unitId: string;
  name: string;
  status: MessageCampaignStatus;
  message: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  simulateTyping?: boolean;
  confirmedOptIn?: boolean;
  totalRecipients: number;
  pendingCount: number;
  processingCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  cancelledCount: number;
  scheduledAt: string | null;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
  updatedAt: string;
  requestIdempotencyKey?: string;
  payloadHash?: string;
  finishedAt?: string;
  legacyHistoryId?: string;
  autoPaused?: boolean;
  autoPauseReason?: string;
  autoPausedAt?: string;
  resumeAllowedAt?: string;
  resumedAt?: string;
  resumedBy?: string;
}

export interface MessageCampaignRecipientDocument {
  schemaVersion: typeof MESSAGE_CAMPAIGN_SCHEMA_VERSION;
  id: string;
  campaignId: string;
  unitId: string;
  normalizedPhone: string;
  maskedPhone: string;
  status: MessageRecipientStatus;
  idempotencyKey: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  personalizedMessage: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  lastError?: string;
  policyReservedAt?: string;
  contactNextAllowedAt?: string;
}

export interface MessageDeliveryAttemptDocument {
  schemaVersion: typeof MESSAGE_CAMPAIGN_SCHEMA_VERSION;
  id: string;
  campaignId: string;
  recipientId: string;
  unitId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt?: string;
  result: 'PROCESSANDO' | 'SUCESSO' | 'FALHA_TRANSITORIA' | 'FALHA_DEFINITIVA';
  errorCode?: string;
  errorMessage?: string;
}

export interface MessageCampaignMediaDocument {
  schemaVersion: typeof MESSAGE_CAMPAIGN_SCHEMA_VERSION;
  id: string;
  campaignId: string;
  unitId: string;
  type: 'IMAGE' | 'VIDEO';
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  order: number;
  createdAt: string;
}

export interface MessageDeadLetterDocument {
  schemaVersion: typeof MESSAGE_CAMPAIGN_SCHEMA_VERSION;
  id: string;
  campaignId: string;
  recipientId: string;
  unitId: string;
  maskedPhone: string;
  reason: string;
  attemptCount: number;
  createdAt: string;
  reprocessedAt?: string;
  reprocessedBy?: string;
}

export const MESSAGE_CAMPAIGN_COLLECTIONS = {
  campaigns: 'message_campaigns',
  recipients: 'message_campaign_recipients',
  attempts: 'message_delivery_attempts',
  media: 'message_campaign_media',
  deadLetters: 'message_dead_letters',
} as const;

export function maskMessagePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 4)}*****${digits.slice(-4)}`;
}

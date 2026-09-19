import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  MESSAGE_CAMPAIGN_COLLECTIONS,
  MESSAGE_CAMPAIGN_SCHEMA_VERSION,
  maskMessagePhone,
  type MessageCampaignDocument,
  type MessageCampaignRecipientDocument,
} from './src/services/messageCampaignSchema';
import { MESSAGE_BLOCKLIST_COLLECTION, messageBlocklistId, normalizeMessageContact, type MessageBlocklistDocument } from './message-blocklist';
import { MESSAGE_CONSENT_COLLECTION, messageConsentId, type MessageConsentDocument } from './message-consent';
import { materializeMessage } from './message-personalization';
import { normalizeCampaignSchedule } from './message-campaign-scheduling';

export { normalizeMessageContact } from './message-blocklist';

export type CreateMessageCampaignInput = {
  requestIdempotencyKey: string;
  unitId: string;
  name: string;
  message: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  simulateTyping?: boolean;
  confirmedOptIn?: boolean;
  contacts: unknown[];
  recipientData?: { phone: unknown; name?: string; variables?: Record<string, string> }[];
  mediaIds?: string[];
  scheduledAt?: string | null;
  timeZone?: string;
  recurrence?: 'NONE'|'DAILY'|'WEEKLY'|'MONTHLY';
  recurrenceEndsAt?: string | null;
  approvalRequired?: boolean;
  createdBy: string;
  createdByEmail?: string;
  createdAt?: string;
};

export type MessageCampaignCreationPlan = {
  campaign: MessageCampaignDocument;
  recipients: MessageCampaignRecipientDocument[];
};

type TransactionLike = {
  get(reference: unknown): Promise<{ exists: boolean; data(): unknown }>;
  create(reference: unknown, data: unknown): unknown;
  update(reference: unknown, data: unknown): unknown;
};

type FirestoreLike = {
  collection(name: string): { doc(id: string): unknown };
  runTransaction<T>(handler: (transaction: TransactionLike) => Promise<T>): Promise<T>;
};

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export function planMessageCampaignCreation(input: CreateMessageCampaignInput): MessageCampaignCreationPlan {
  const requestKey = input.requestIdempotencyKey.trim();
  if (!requestKey || requestKey.length > 200) throw new Error('Chave de idempotência inválida.');
  if (!input.unitId.trim()) throw new Error('A unidade da campanha é obrigatória.');
  if (!input.message.trim() || input.message.trim().length > 4096) throw new Error('A mensagem deve ter entre 1 e 4.096 caracteres.');

  const contacts = [...new Set(input.contacts.map(normalizeMessageContact).filter(Boolean))];
  if (!contacts.length) throw new Error('Inclua ao menos um contato válido.');
  const createdAt = input.createdAt || new Date().toISOString();
  const campaignId = `campaign_${digest(`${input.unitId}:${input.createdBy}:${requestKey}`).slice(0, 40)}`;
  const mediaIds = [...new Set((input.mediaIds || []).map(value => String(value).trim()).filter(Boolean))];
  if (mediaIds.length > 5) throw new Error('É permitido anexar no máximo 5 arquivos por campanha.');
  const schedule=normalizeCampaignSchedule(input,new Date(createdAt));
  const payloadHash = digest(JSON.stringify({ unitId: input.unitId, name: input.name.trim(), message: input.message.trim(), contacts, recipientData: input.recipientData || [], mediaIds, schedule, minDelaySeconds: input.minDelaySeconds, maxDelaySeconds: input.maxDelaySeconds, simulateTyping: input.simulateTyping }));
  const recipientData = new Map((input.recipientData || []).map(item => [normalizeMessageContact(item.phone), item]));
  const recipients = contacts.map(phone => {
    const idempotencyKey = digest(`${campaignId}:${phone}`);
    const personalization = recipientData.get(phone);
    const variables = { ...(personalization?.variables || {}), nome: personalization?.name || '' };
    return {
      schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION,
      id: `recipient_${idempotencyKey.slice(0, 40)}`,
      campaignId,
      unitId: input.unitId,
      normalizedPhone: phone,
      maskedPhone: maskMessagePhone(phone),
      status: 'PENDENTE',
      idempotencyKey,
      attemptCount: 0,
      maxAttempts: 3,
      nextAttemptAt: createdAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      personalizedMessage: materializeMessage(input.message.trim(), { name: personalization?.name, variables: personalization?.variables }),
      variables,
      createdAt,
      updatedAt: createdAt,
    } satisfies MessageCampaignRecipientDocument;
  });
  return {
    campaign: {
      schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION,
      id: campaignId,
      unitId: input.unitId,
      name: input.name.trim().slice(0, 120) || 'Disparo sem título',
      status: schedule.status,
      message: input.message.trim(),
      ...(mediaIds.length ? { mediaIds } : {}),
      ...(input.minDelaySeconds !== undefined ? { minDelaySeconds: input.minDelaySeconds } : {}),
      ...(input.maxDelaySeconds !== undefined ? { maxDelaySeconds: input.maxDelaySeconds } : {}),
      ...(input.simulateTyping !== undefined ? { simulateTyping: input.simulateTyping } : {}),
      ...(input.confirmedOptIn !== undefined ? { confirmedOptIn: input.confirmedOptIn } : {}),
      totalRecipients: recipients.length,
      pendingCount: recipients.length,
      processingCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      scheduledAt: schedule.scheduledAt,
      timeZone: schedule.timeZone,
      recurrence: schedule.recurrence,
      recurrenceEndsAt: schedule.recurrenceEndsAt,
      approvalRequired: schedule.approvalRequired,
      createdAt,
      createdBy: input.createdBy,
      ...(input.createdByEmail ? { createdByEmail: input.createdByEmail } : {}),
      updatedAt: createdAt,
      requestIdempotencyKey: requestKey,
      payloadHash,
    },
    recipients,
  };
}

export async function findMessageCampaignByRequest(db: FirestoreLike, input: CreateMessageCampaignInput) {
  const plan = planMessageCampaignCreation(input);
  const reference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(plan.campaign.id);
  let existing: unknown;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    existing = snapshot.exists ? snapshot.data() : undefined;
  });
  return existing ? { plan, existing: existing as MessageCampaignDocument } : { plan, existing: null };
}

export async function createMessageCampaignAtomically(db: FirestoreLike, input: CreateMessageCampaignInput) {
  const plan = planMessageCampaignCreation(input);
  const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(plan.campaign.id);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(campaignReference);
    if (existing.exists) {
      const data = existing.data() as MessageCampaignDocument;
      if (data.payloadHash !== plan.campaign.payloadHash) {
        throw new Error('A chave de idempotência já foi usada com dados diferentes.');
      }
      return { campaign: data, recipientsCreated: 0, reused: true };
    }
    const eligibleRecipients: MessageCampaignRecipientDocument[] = [];
    const mediaReferences: unknown[] = [];
    for (const mediaId of plan.campaign.mediaIds || []) {
      const mediaReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.media).doc(mediaId);
      const mediaSnapshot = await transaction.get(mediaReference);
      const media = mediaSnapshot.data() as { unitId?: string; campaignId?: string } | undefined;
      if (!mediaSnapshot.exists || media?.unitId !== input.unitId || (media.campaignId && media.campaignId !== plan.campaign.id)) {
        throw new Error('Um dos anexos não existe ou pertence a outra unidade.');
      }
      mediaReferences.push(mediaReference);
    }
    for (const recipient of plan.recipients) {
      const blockReference = db.collection(MESSAGE_BLOCKLIST_COLLECTION).doc(messageBlocklistId(recipient.normalizedPhone));
      const blocked = await transaction.get(blockReference);
      if (blocked.exists && (blocked.data() as MessageBlocklistDocument).status === 'BLOCKED') continue;
      const consentReference = db.collection(MESSAGE_CONSENT_COLLECTION).doc(messageConsentId(input.unitId, recipient.normalizedPhone));
      const consentSnapshot = await transaction.get(consentReference);
      if (!consentSnapshot.exists) throw new Error(`Consentimento válido ausente para ${recipient.maskedPhone}.`);
      const consent = consentSnapshot.data() as MessageConsentDocument;
      if (consent.status !== 'GRANTED' || !consent.origin || !consent.evidence || !Number.isFinite(Date.parse(consent.consentAt)) || Date.parse(consent.consentAt) > Date.parse(plan.campaign.createdAt)) throw new Error(`Consentimento válido ausente para ${recipient.maskedPhone}.`);
      eligibleRecipients.push(recipient);
    }
    if (!eligibleRecipients.length) throw new Error('Todos os contatos informados estão na lista global não enviar.');
    const campaign = { ...plan.campaign, totalRecipients: eligibleRecipients.length, pendingCount: eligibleRecipients.length };
    transaction.create(campaignReference, campaign);
    for (const mediaReference of mediaReferences) transaction.update(mediaReference, { campaignId: campaign.id, updatedAt: campaign.updatedAt });
    for (const recipient of eligibleRecipients) {
      const reference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).doc(recipient.id);
      transaction.create(reference, recipient);
    }
    return { campaign, recipientsCreated: eligibleRecipients.length, reused: false };
  });
}

export const createMessageCampaign = (db: Firestore, input: CreateMessageCampaignInput) =>
  createMessageCampaignAtomically(db as unknown as FirestoreLike, input);

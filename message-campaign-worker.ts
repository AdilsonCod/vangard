import type { Firestore } from 'firebase-admin/firestore';
import { MESSAGE_CAMPAIGN_COLLECTIONS, type MessageCampaignDocument, type MessageCampaignRecipientDocument, type MessageRecipientStatus } from './src/services/messageCampaignSchema';
import { MESSAGE_BLOCKLIST_COLLECTION, messageBlocklistId, type MessageBlocklistDocument } from './message-blocklist';
import { reserveMessageDispatchSlot } from './message-dispatch-limits';

const ACTIVE_CAMPAIGN_STATUSES = new Set<MessageCampaignDocument['status']>(['NA_FILA', 'EM_PROCESSAMENTO']);
const FINAL_RECIPIENT_STATUSES = new Set<MessageRecipientStatus>(['ENVIADO', 'ENTREGUE', 'LIDO', 'FALHOU', 'CANCELADO']);

export type ClaimRecipientOptions = {
  workerId: string;
  campaignId: string;
  unitId: string;
  now?: Date;
  leaseMs?: number;
  accountId?: string;
};

export type ClaimedMessageRecipient = MessageCampaignRecipientDocument & {
  leaseOwner: string;
  leaseExpiresAt: string;
};

const timestamp = (value: string | null | undefined) => value ? new Date(value).getTime() : 0;

export function recipientCanBeClaimed(recipient: MessageCampaignRecipientDocument, campaign: MessageCampaignDocument, now = new Date()) {
  if (recipient.campaignId !== campaign.id || recipient.unitId !== campaign.unitId) return false;
  if (!ACTIVE_CAMPAIGN_STATUSES.has(campaign.status) || FINAL_RECIPIENT_STATUSES.has(recipient.status)) return false;
  const nowMs = now.getTime();
  if (recipient.status === 'PENDENTE') return !recipient.nextAttemptAt || timestamp(recipient.nextAttemptAt) <= nowMs;
  return recipient.status === 'PROCESSANDO' && timestamp(recipient.leaseExpiresAt) <= nowMs;
}

async function candidateReferences(db: Firestore, options: ClaimRecipientOptions) {
  const recipients = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients);
  const base = (status: 'PENDENTE' | 'PROCESSANDO') => recipients
    .where('campaignId', '==', options.campaignId)
    .where('unitId', '==', options.unitId)
    .where('status', '==', status)
    .limit(20);
  const [pending, processing] = await Promise.all([base('PENDENTE').get(), base('PROCESSANDO').get()]);
  return [...pending.docs, ...processing.docs].map(document => document.ref);
}

export async function claimNextMessageRecipient(db: Firestore, options: ClaimRecipientOptions): Promise<ClaimedMessageRecipient | null> {
  const now = options.now || new Date();
  const leaseMs = Math.max(10_000, options.leaseMs || 90_000);
  const references = await candidateReferences(db, options);
  for (const reference of references) {
    const claimed = await db.runTransaction(async transaction => {
      const recipientSnapshot = await transaction.get(reference);
      if (!recipientSnapshot.exists) return null;
      const recipient = recipientSnapshot.data() as MessageCampaignRecipientDocument;
      const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(recipient.campaignId);
      const campaignSnapshot = await transaction.get(campaignReference);
      if (!campaignSnapshot.exists) return null;
      const campaign = campaignSnapshot.data() as MessageCampaignDocument;
      if (!recipientCanBeClaimed(recipient, campaign, now)) return null;
      const blockReference = db.collection(MESSAGE_BLOCKLIST_COLLECTION).doc(messageBlocklistId(recipient.normalizedPhone));
      const blockSnapshot = await transaction.get(blockReference);
      if (blockSnapshot.exists && (blockSnapshot.data() as MessageBlocklistDocument).status === 'BLOCKED') {
        transaction.update(reference, { status: 'CANCELADO', leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, processedAt: now.toISOString(), updatedAt: now.toISOString(), lastError: 'Contato incluído na lista global não enviar.' });
        return null;
      }
      const reservation = await reserveMessageDispatchSlot({ db, transaction, unitId: recipient.unitId, accountId: options.accountId || recipient.unitId, campaignId: recipient.campaignId, phone: recipient.normalizedPhone, now, alreadyReserved: Boolean(recipient.policyReservedAt) });
      const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();
      const updated: ClaimedMessageRecipient = {
        ...recipient,
        status: 'PROCESSANDO',
        leaseOwner: options.workerId,
        leaseExpiresAt,
        attemptCount: recipient.attemptCount + 1,
        updatedAt: now.toISOString(),
        ...(reservation ? { policyReservedAt: reservation.reservedAt, contactNextAllowedAt: reservation.nextAllowedAt } : {}),
      };
      transaction.update(reference, {
        status: updated.status,
        leaseOwner: updated.leaseOwner,
        leaseExpiresAt: updated.leaseExpiresAt,
        attemptCount: updated.attemptCount,
        updatedAt: updated.updatedAt,
        ...(reservation ? { policyReservedAt: reservation.reservedAt, contactNextAllowedAt: reservation.nextAllowedAt } : {}),
      });
      if (campaign.status === 'NA_FILA') transaction.update(campaignReference, { status: 'EM_PROCESSAMENTO', updatedAt: now.toISOString() });
      return updated;
    });
    if (claimed) return claimed;
  }
  return null;
}

export async function renewMessageRecipientLease(db: Firestore, recipientId: string, workerId: string, now = new Date(), leaseMs = 90_000) {
  const reference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).doc(recipientId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    const recipient = snapshot.data() as MessageCampaignRecipientDocument;
    if (recipient.status !== 'PROCESSANDO' || recipient.leaseOwner !== workerId) return false;
    transaction.update(reference, { leaseExpiresAt: new Date(now.getTime() + Math.max(10_000, leaseMs)).toISOString(), updatedAt: now.toISOString() });
    return true;
  });
}

export async function finalizeMessageRecipient(db: Firestore, recipientId: string, workerId: string, status: 'ENVIADO' | 'FALHOU' | 'CANCELADO', details: { error?: string; now?: Date } = {}) {
  const now = details.now || new Date();
  const reference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).doc(recipientId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    const recipient = snapshot.data() as MessageCampaignRecipientDocument;
    if (recipient.status !== 'PROCESSANDO' || recipient.leaseOwner !== workerId) return false;
    transaction.update(reference, {
      status,
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      processedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...(details.error ? { lastError: details.error } : {}),
    });
    return true;
  });
}

export async function withMessageLeaseRenewal<T>(options: { renew: () => Promise<boolean>; work: () => Promise<T>; intervalMs?: number }) {
  const interval = setInterval(() => { void options.renew(); }, Math.max(1_000, options.intervalMs || 30_000));
  interval.unref?.();
  try { return await options.work(); }
  finally { clearInterval(interval); }
}

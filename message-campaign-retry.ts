import type { Firestore } from 'firebase-admin/firestore';
import { MESSAGE_CAMPAIGN_COLLECTIONS, MESSAGE_CAMPAIGN_SCHEMA_VERSION, type MessageCampaignRecipientDocument, type MessageDeadLetterDocument, type MessageDeliveryAttemptDocument } from './src/services/messageCampaignSchema';

export type MessageFailureKind = 'TRANSIENT' | 'PERMANENT';
export type MessageRetryDecision = { kind: MessageFailureKind; retry: boolean; retryAt: string | null; delayMs: number };

export function classifyMessageFailure(error: unknown): MessageFailureKind {
  const text = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  if (/não encontrado|nao encontrado|inválid|invalid|not registered|blocked|bloquead|unauthorized|forbidden|\b401\b|\b403\b/.test(text)) return 'PERMANENT';
  return 'TRANSIENT';
}

export function messageRetryDecision(recipient: Pick<MessageCampaignRecipientDocument, 'attemptCount' | 'maxAttempts'>, error: unknown, now = new Date(), baseDelayMs = 30_000): MessageRetryDecision {
  const kind = classifyMessageFailure(error);
  const retry = kind === 'TRANSIENT' && recipient.attemptCount < recipient.maxAttempts;
  const delayMs = retry ? Math.max(1_000, baseDelayMs) * 2 ** Math.max(0, recipient.attemptCount - 1) : 0;
  return { kind, retry, delayMs, retryAt: retry ? new Date(now.getTime() + delayMs).toISOString() : null };
}

export async function handleMessageRecipientFailure(db: Firestore, options: { recipientId: string; workerId: string; error: unknown; now?: Date; baseDelayMs?: number }) {
  const now = options.now || new Date();
  const recipientReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).doc(options.recipientId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(recipientReference);
    if (!snapshot.exists) return null;
    const recipient = snapshot.data() as MessageCampaignRecipientDocument;
    if (recipient.status !== 'PROCESSANDO' || recipient.leaseOwner !== options.workerId) return null;
    const reason = options.error instanceof Error ? options.error.message : String(options.error || 'Falha desconhecida');
    const decision = messageRetryDecision(recipient, options.error, now, options.baseDelayMs);
    const attempt: MessageDeliveryAttemptDocument = { schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION, id: `${recipient.id}_attempt_${recipient.attemptCount}`, campaignId: recipient.campaignId, recipientId: recipient.id, unitId: recipient.unitId, attemptNumber: recipient.attemptCount, startedAt: recipient.updatedAt, finishedAt: now.toISOString(), result: decision.retry ? 'FALHA_TRANSITORIA' : 'FALHA_DEFINITIVA', errorMessage: reason };
    transaction.create(db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.attempts).doc(attempt.id), attempt);
    if (decision.retry) {
      transaction.update(recipientReference, { status: 'PENDENTE', leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: decision.retryAt, updatedAt: now.toISOString(), lastError: reason });
    } else {
      transaction.update(recipientReference, { status: 'FALHOU', leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, processedAt: now.toISOString(), updatedAt: now.toISOString(), lastError: reason });
      const deadLetter: MessageDeadLetterDocument = { schemaVersion: MESSAGE_CAMPAIGN_SCHEMA_VERSION, id: `dead_${recipient.id}`, campaignId: recipient.campaignId, recipientId: recipient.id, unitId: recipient.unitId, maskedPhone: recipient.maskedPhone, reason, attemptCount: recipient.attemptCount, createdAt: now.toISOString() };
      transaction.set(db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.deadLetters).doc(deadLetter.id), deadLetter, { merge: true });
    }
    return { recipient, decision, attempt };
  });
}

export async function requeueMessageDeadLetter(db: Firestore, options: { deadLetterId: string; actorId: string; now?: Date }) {
  const now = options.now || new Date();
  const deadReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.deadLetters).doc(options.deadLetterId);
  return db.runTransaction(async transaction => {
    const deadSnapshot = await transaction.get(deadReference);
    if (!deadSnapshot.exists) return false;
    const dead = deadSnapshot.data() as MessageDeadLetterDocument;
    const recipientReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).doc(dead.recipientId);
    const recipientSnapshot = await transaction.get(recipientReference);
    if (!recipientSnapshot.exists || (recipientSnapshot.data() as MessageCampaignRecipientDocument).status !== 'FALHOU') return false;
    const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(dead.campaignId);
    const campaignSnapshot = await transaction.get(campaignReference);
    if (!campaignSnapshot.exists) return false;
    transaction.update(recipientReference, { status: 'PENDENTE', attemptCount: 0, nextAttemptAt: now.toISOString(), leaseOwner: null, leaseExpiresAt: null, updatedAt: now.toISOString() });
    transaction.update(campaignReference, { status: 'NA_FILA', pendingCount: 1, updatedAt: now.toISOString(), finishedAt: null });
    transaction.update(deadReference, { reprocessedAt: now.toISOString(), reprocessedBy: options.actorId });
    const auditReference = db.collection('dispatch_audit').doc();
    transaction.create(auditReference, { action: 'DEAD_LETTER_REQUEUED', unitId: dead.unitId, campaignId: dead.campaignId, recipientId: dead.recipientId, maskedPhone: dead.maskedPhone, userId: options.actorId, timestamp: now.toISOString() });
    return true;
  });
}

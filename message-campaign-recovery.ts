import type { Firestore } from 'firebase-admin/firestore';
import { MESSAGE_CAMPAIGN_COLLECTIONS, type MessageCampaignDocument, type MessageCampaignRecipientDocument, type MessageRecipientStatus } from './src/services/messageCampaignSchema';

export type RecoveredMessageCampaign = { campaign: MessageCampaignDocument; recipients: MessageCampaignRecipientDocument[]; recoveredLeases: number };
const count = (items: MessageCampaignRecipientDocument[], status: MessageRecipientStatus) => items.filter(item => item.status === status).length;

export function rebuildMessageCampaign(campaign: MessageCampaignDocument, recipients: MessageCampaignRecipientDocument[], now = new Date()): RecoveredMessageCampaign {
  let recoveredLeases = 0;
  const normalized = recipients.map(recipient => {
    if (recipient.status !== 'PROCESSANDO') return recipient;
    const expiresAt = recipient.leaseExpiresAt ? new Date(recipient.leaseExpiresAt).getTime() : 0;
    if (expiresAt > now.getTime()) return recipient;
    recoveredLeases += 1;
    return { ...recipient, status: 'PENDENTE' as const, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: now.toISOString(), updatedAt: now.toISOString() };
  });
  const pendingCount = count(normalized, 'PENDENTE');
  const processingCount = count(normalized, 'PROCESSANDO');
  const sentCount = count(normalized, 'ENVIADO');
  const deliveredCount = count(normalized, 'ENTREGUE');
  const readCount = count(normalized, 'LIDO');
  const failedCount = count(normalized, 'FALHOU');
  const cancelledCount = count(normalized, 'CANCELADO');
  const remaining = pendingCount + processingCount;
  const status: MessageCampaignDocument['status'] = remaining > 0 ? 'NA_FILA' : failedCount === normalized.length && normalized.length > 0 ? 'FALHOU' : campaign.status === 'CANCELADA' ? 'CANCELADA' : 'CONCLUIDA';
  return { campaign: { ...campaign, status, totalRecipients: normalized.length, pendingCount, processingCount, sentCount, deliveredCount, readCount, failedCount, cancelledCount, updatedAt: now.toISOString(), ...(remaining === 0 ? { finishedAt: campaign.finishedAt || now.toISOString() } : {}) }, recipients: normalized, recoveredLeases };
}

export async function recoverMessageCampaign(db: Firestore, campaignId: string, now = new Date()) {
  const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(campaignId);
  const recipientsQuery = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.recipients).where('campaignId', '==', campaignId);
  return db.runTransaction(async transaction => {
    const campaignSnapshot = await transaction.get(campaignReference);
    if (!campaignSnapshot.exists) return null;
    const campaign = campaignSnapshot.data() as MessageCampaignDocument;
    if (!['NA_FILA', 'EM_PROCESSAMENTO'].includes(campaign.status)) return null;
    const recipientsSnapshot = await transaction.get(recipientsQuery);
    const recipients = recipientsSnapshot.docs.map(document => ({ id: document.id, ...document.data() } as MessageCampaignRecipientDocument));
    const rebuilt = rebuildMessageCampaign(campaign, recipients, now);
    recipientsSnapshot.docs.forEach((document, index) => {
      if (recipients[index].status === 'PROCESSANDO' && rebuilt.recipients[index].status === 'PENDENTE') transaction.update(document.ref, { status: 'PENDENTE', leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: rebuilt.recipients[index].nextAttemptAt, updatedAt: rebuilt.recipients[index].updatedAt });
    });
    transaction.set(campaignReference, rebuilt.campaign, { merge: true });
    return rebuilt;
  });
}

export async function recoverActiveMessageCampaigns(db: Firestore, options: { unitId?: string; now?: Date } = {}) {
  const snapshot = await db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).where('status', 'in', ['NA_FILA', 'EM_PROCESSAMENTO']).get();
  const campaigns = snapshot.docs
    .map(document => ({ id: document.id, ...document.data() } as MessageCampaignDocument))
    .filter(campaign => !options.unitId || options.unitId === 'ALL' || campaign.unitId === options.unitId);
  const recovered: RecoveredMessageCampaign[] = [];
  for (const campaign of campaigns) { const result = await recoverMessageCampaign(db, campaign.id, options.now); if (result) recovered.push(result); }
  return recovered;
}

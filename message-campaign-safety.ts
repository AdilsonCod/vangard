import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { MESSAGE_ACCOUNT_SAFETY_COLLECTION, MESSAGE_POLICY_COLLECTION, normalizeMessageDispatchPolicy } from './message-dispatch-limits';
import { MESSAGE_CAMPAIGN_COLLECTIONS, type MessageCampaignDocument } from './src/services/messageCampaignSchema';

export type DeliverySafetyOutcome = { at: string; campaignId: string; result: 'SUCCESS' | 'FAILURE' };
export type CampaignSafetyEvaluation = { shouldPause: boolean; sampleSize: number; failures: number; failureRate: number; threshold: number; resumeAllowedAt: string | null };

const accountSafetyId = (accountId: string) => createHash('sha256').update(accountId).digest('hex').slice(0, 32);

export function evaluateCampaignFailureWindow(outcomes: DeliverySafetyOutcome[], options: { windowSize: number; minimumSample: number; thresholdPercent: number; now: Date; cooldownMinutes: number }): CampaignSafetyEvaluation {
  const window = outcomes.slice(-options.windowSize);
  const failures = window.filter(item => item.result === 'FAILURE').length;
  const failureRate = window.length ? (failures / window.length) * 100 : 0;
  const shouldPause = window.length >= options.minimumSample && failureRate >= options.thresholdPercent;
  return { shouldPause, sampleSize: window.length, failures, failureRate, threshold: options.thresholdPercent, resumeAllowedAt: shouldPause ? new Date(options.now.getTime() + options.cooldownMinutes * 60_000).toISOString() : null };
}

export async function recordMessageDeliverySafety(db: Firestore, options: { unitId: string; accountId: string; campaignId: string; success: boolean; now?: Date }) {
  const now = options.now || new Date();
  const safetyReference = db.collection(MESSAGE_ACCOUNT_SAFETY_COLLECTION).doc(accountSafetyId(options.accountId || options.unitId));
  const policyReference = db.collection(MESSAGE_POLICY_COLLECTION).doc(options.unitId);
  const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(options.campaignId);
  return db.runTransaction(async transaction => {
    const [safetySnapshot, policySnapshot, campaignSnapshot] = await Promise.all([transaction.get(safetyReference), transaction.get(policyReference), transaction.get(campaignReference)]);
    const policy = normalizeMessageDispatchPolicy(policySnapshot.exists ? policySnapshot.data() : {});
    const previous = (safetySnapshot.data()?.recentOutcomes || []) as DeliverySafetyOutcome[];
    const recentOutcomes = [...previous, { at: now.toISOString(), campaignId: options.campaignId, result: options.success ? 'SUCCESS' as const : 'FAILURE' as const }].slice(-policy.failureWindowSize);
    const evaluation = evaluateCampaignFailureWindow(recentOutcomes, { windowSize: policy.failureWindowSize, minimumSample: Math.min(policy.failureMinimumSample, policy.failureWindowSize), thresholdPercent: policy.failureThresholdPercent, now, cooldownMinutes: policy.autoPauseCooldownMinutes });
    transaction.set(safetyReference, { unitId: options.unitId, accountId: options.accountId, recentOutcomes, lastOutcomeAt: now.toISOString(), ...(evaluation.shouldPause ? { autoPausedCampaignId: options.campaignId, autoPausedAt: now.toISOString(), resumeAllowedAt: evaluation.resumeAllowedAt, pauseReason: `Taxa de falhas de ${evaluation.failureRate.toFixed(1)}% em ${evaluation.sampleSize} envios.` } : {}), updatedAt: now.toISOString() }, { merge: true });
    if (evaluation.shouldPause && campaignSnapshot.exists) transaction.set(campaignReference, { status: 'PAUSADA', autoPaused: true, autoPauseReason: `Taxa de falhas de ${evaluation.failureRate.toFixed(1)}% em ${evaluation.sampleSize} envios.`, autoPausedAt: now.toISOString(), resumeAllowedAt: evaluation.resumeAllowedAt, updatedAt: now.toISOString() }, { merge: true });
    return evaluation;
  });
}

export async function validateAutomaticPauseResume(db: Firestore, options: { campaignId: string; unitId: string; accountId: string; actorId: string; now?: Date }) {
  const now = options.now || new Date();
  const campaignReference = db.collection(MESSAGE_CAMPAIGN_COLLECTIONS.campaigns).doc(options.campaignId);
  const safetyReference = db.collection(MESSAGE_ACCOUNT_SAFETY_COLLECTION).doc(accountSafetyId(options.accountId || options.unitId));
  return db.runTransaction(async transaction => {
    const [campaignSnapshot, safetySnapshot] = await Promise.all([transaction.get(campaignReference), transaction.get(safetyReference)]);
    if (!campaignSnapshot.exists) throw new Error('Campanha não encontrada.');
    const campaign = campaignSnapshot.data() as MessageCampaignDocument & { autoPaused?: boolean; resumeAllowedAt?: string };
    if (!campaign.autoPaused) return true;
    const resumeAllowedAt = String(campaign.resumeAllowedAt || safetySnapshot.data()?.resumeAllowedAt || '');
    if (!resumeAllowedAt || Date.parse(resumeAllowedAt) > now.getTime()) throw new Error(`Retomada protegida até ${new Date(resumeAllowedAt).toLocaleString('pt-BR')}. Aguarde a janela de segurança.`);
    transaction.set(campaignReference, { status: 'EM_PROCESSAMENTO', autoPaused: false, resumedAt: now.toISOString(), resumedBy: options.actorId, updatedAt: now.toISOString() }, { merge: true });
    transaction.set(safetyReference, { autoPausedCampaignId: null, resumeAllowedAt: null, resumedAt: now.toISOString(), resumedBy: options.actorId, updatedAt: now.toISOString() }, { merge: true });
    transaction.create(db.collection('dispatch_audit').doc(), { action: 'CAMPAIGN_AUTO_PAUSE_RESUMED', unitId: options.unitId, campaignId: options.campaignId, accountId: options.accountId, userId: options.actorId, timestamp: now.toISOString() });
    return true;
  });
}

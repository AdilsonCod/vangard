import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export const MESSAGE_CAMPAIGN_CONFIRMATION_COLLECTION = 'message_campaign_confirmations';
export const MESSAGE_CAMPAIGN_TEST_COLLECTION = 'message_campaign_test_sends';
export const DEFAULT_HIGH_VOLUME_THRESHOLD = 50;
export const HIGH_VOLUME_CHALLENGE_TTL_MS = 10 * 60_000;

export type HighVolumeChallengeDocument = {
  id: string;
  campaignId: string;
  payloadHash: string;
  unitId: string;
  createdBy: string;
  recipientCount: number;
  phraseHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type CampaignTestSendDocument = {
  id: string;
  campaignId: string;
  unitId: string;
  normalizedPhoneHash: string;
  maskedPhone: string;
  status: 'PROCESSANDO' | 'ENVIADO' | 'FALHOU';
  message: string;
  createdAt: string;
  createdBy: string;
  sentAt?: string;
  failedAt?: string;
  error?: string;
};

export function buildCampaignTestSend(options: { id: string; campaignId: string; unitId: string; normalizedPhoneHash: string; maskedPhone: string; message: string; createdAt: string; createdBy: string; error?: string }): CampaignTestSendDocument {
  if (!options.campaignId || !options.message.trim()) throw new Error('O teste deve estar vinculado a uma campanha com conteúdo válido.');
  if (options.error) return { ...options, message: options.message.trim(), status: 'FALHOU', failedAt: options.createdAt, error: options.error };
  return { ...options, message: options.message.trim(), status: 'PROCESSANDO' };
}

const hashPhrase = (value: string) => createHash('sha256').update(value.trim()).digest('hex');

export function highVolumeChallengePhrase(recipientCount: number) {
  return `ENVIAR ${recipientCount} MENSAGENS`;
}

export function validateHighVolumeChallenge(
  challenge: HighVolumeChallengeDocument,
  options: { campaignId: string; payloadHash?: string; unitId: string; actorId: string; recipientCount: number; answer: string; now: Date },
) {
  if (challenge.usedAt) throw new Error('Esta confirmação já foi utilizada. Gere uma nova confirmação.');
  if (Date.parse(challenge.expiresAt) <= options.now.getTime()) throw new Error('A confirmação de alto volume expirou. Gere uma nova confirmação.');
  if (challenge.campaignId !== options.campaignId || (options.payloadHash && challenge.payloadHash !== options.payloadHash) || challenge.unitId !== options.unitId || challenge.createdBy !== options.actorId || challenge.recipientCount !== options.recipientCount) {
    throw new Error('A confirmação não corresponde a esta campanha. Gere uma nova confirmação.');
  }
  if (challenge.phraseHash !== hashPhrase(options.answer)) throw new Error('O texto de confirmação está incorreto. Digite exatamente o texto exibido.');
  return true;
}

export async function issueHighVolumeChallenge(db: Firestore, options: { campaignId: string; payloadHash: string; unitId: string; actorId: string; recipientCount: number; now?: Date }) {
  const now = options.now || new Date();
  const id = randomUUID();
  const phrase = highVolumeChallengePhrase(options.recipientCount);
  const document: HighVolumeChallengeDocument = {
    id,
    campaignId: options.campaignId,
    payloadHash: options.payloadHash,
    unitId: options.unitId,
    createdBy: options.actorId,
    recipientCount: options.recipientCount,
    phraseHash: hashPhrase(phrase),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + HIGH_VOLUME_CHALLENGE_TTL_MS).toISOString(),
    usedAt: null,
  };
  await db.collection(MESSAGE_CAMPAIGN_CONFIRMATION_COLLECTION).doc(id).create(document);
  return { id, phrase, expiresAt: document.expiresAt, recipientCount: document.recipientCount };
}

export async function consumeHighVolumeChallenge(db: Firestore, options: { challengeId: string; campaignId: string; payloadHash?: string; unitId: string; actorId: string; recipientCount: number; answer: string; now?: Date }) {
  const now = options.now || new Date();
  const reference = db.collection(MESSAGE_CAMPAIGN_CONFIRMATION_COLLECTION).doc(options.challengeId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error('Confirmação de alto volume não encontrada. Gere uma nova confirmação.');
    validateHighVolumeChallenge(snapshot.data() as HighVolumeChallengeDocument, { ...options, now });
    transaction.update(reference, { usedAt: now.toISOString() });
    return true;
  });
}

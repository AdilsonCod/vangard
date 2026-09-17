import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { maskMessagePhone } from './src/services/messageCampaignSchema';

export const MESSAGE_BLOCKLIST_COLLECTION = 'message_global_blocklist';
export const MESSAGE_CONSENT_EVENTS_COLLECTION = 'message_consent_events';
const ACTIVE_RECIPIENT_STATUSES = new Set(['PENDENTE', 'PROCESSANDO']);

export type MessageBlocklistDocument = {
  id: string;
  normalizedPhone: string;
  maskedPhone: string;
  status: 'BLOCKED' | 'ACTIVE';
  reason: string;
  source: 'MANUAL' | 'WHATSAPP_OPT_OUT';
  blockedAt: string;
  blockedBy: string;
  blockedByEmail?: string;
  updatedAt: string;
  unblockedAt?: string;
  unblockedBy?: string;
  unblockReason?: string;
};

export function normalizeMessageContact(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return withCountry.length >= 12 && withCountry.length <= 13 ? withCountry : '';
}

export const messageBlocklistId = (phone: string) => createHash('sha256').update(normalizeMessageContact(phone)).digest('hex');

export function isMessageOptOut(value: unknown) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  return normalized === 'SAIR' || normalized === 'PARAR' || normalized === 'CANCELAR';
}

export const canUnblockMessageContact = (role: unknown) => String(role || '').toUpperCase() === 'ADMIN';

export function incomingWhatsAppText(message: Record<string, unknown> | null | undefined) {
  if (!message) return '';
  const extended = message.extendedTextMessage as { text?: unknown } | undefined;
  const image = message.imageMessage as { caption?: unknown } | undefined;
  const video = message.videoMessage as { caption?: unknown } | undefined;
  return String(message.conversation || extended?.text || image?.caption || video?.caption || '');
}

export async function isMessageContactBlocked(db: Firestore, phone: string) {
  const normalizedPhone = normalizeMessageContact(phone);
  if (!normalizedPhone) return true;
  const snapshot = await db.collection(MESSAGE_BLOCKLIST_COLLECTION).doc(messageBlocklistId(normalizedPhone)).get();
  return snapshot.exists && (snapshot.data() as MessageBlocklistDocument).status === 'BLOCKED';
}

export async function blockMessageContact(db: Firestore, input: {
  phone: string;
  reason: string;
  source: MessageBlocklistDocument['source'];
  actorId: string;
  actorEmail?: string;
  now?: Date;
}) {
  const normalizedPhone = normalizeMessageContact(input.phone);
  if (!normalizedPhone) throw new Error('Número de telefone inválido.');
  const reason = input.reason.trim();
  if (!reason) throw new Error('Informe o motivo do bloqueio.');
  const now = (input.now || new Date()).toISOString();
  const id = messageBlocklistId(normalizedPhone);
  const reference = db.collection(MESSAGE_BLOCKLIST_COLLECTION).doc(id);
  const eventReference = db.collection(MESSAGE_CONSENT_EVENTS_COLLECTION).doc();
  await db.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    const prior = current.exists ? current.data() as MessageBlocklistDocument : null;
    transaction.set(reference, {
      id, normalizedPhone, maskedPhone: maskMessagePhone(normalizedPhone), status: 'BLOCKED', reason,
      source: input.source, blockedAt: prior?.status === 'BLOCKED' ? prior.blockedAt : now,
      blockedBy: input.actorId, ...(input.actorEmail ? { blockedByEmail: input.actorEmail } : {}), updatedAt: now,
    } satisfies MessageBlocklistDocument);
    transaction.create(eventReference, { unitId: 'ALL', phoneHash: id, maskedPhone: maskMessagePhone(normalizedPhone), action: 'OPT_OUT', source: input.source, reason, actorId: input.actorId, timestamp: now });
  });
  const consents = await db.collection('message_contact_consents').where('normalizedPhone', '==', normalizedPhone).get();
  for (let offset = 0; offset < consents.size; offset += 200) {
    const batch = db.batch();
    consents.docs.slice(offset, offset + 200).forEach(document => {
      const consent = document.data();
      batch.update(document.ref, { status: 'REVOKED', updatedAt: now, updatedBy: input.actorId });
      batch.create(db.collection(MESSAGE_CONSENT_EVENTS_COLLECTION).doc(), { unitId: consent.unitId, phoneHash: document.id, maskedPhone: maskMessagePhone(normalizedPhone), action: 'OPT_OUT', source: input.source, reason, actorId: input.actorId, timestamp: now });
    });
    await batch.commit();
  }
  const recipients = await db.collection('message_campaign_recipients').where('normalizedPhone', '==', normalizedPhone).get();
  const eligible = recipients.docs.filter(document => ACTIVE_RECIPIENT_STATUSES.has(String(document.data().status)));
  for (let offset = 0; offset < eligible.length; offset += 400) {
    const batch = db.batch();
    eligible.slice(offset, offset + 400).forEach(document => batch.update(document.ref, { status: 'CANCELADO', leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, processedAt: now, updatedAt: now, lastError: 'Contato incluído na lista global não enviar.' }));
    await batch.commit();
  }
  return { id, normalizedPhone, cancelledRecipients: eligible.length };
}

export async function unblockMessageContact(db: Firestore, input: { id: string; justification: string; actorId: string; now?: Date }) {
  const justification = input.justification.trim();
  if (justification.length < 10) throw new Error('Informe uma justificativa com pelo menos 10 caracteres.');
  const reference = db.collection(MESSAGE_BLOCKLIST_COLLECTION).doc(input.id);
  const eventReference = db.collection(MESSAGE_CONSENT_EVENTS_COLLECTION).doc();
  const now = (input.now || new Date()).toISOString();
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error('Contato não encontrado na lista de bloqueio.');
    const current = snapshot.data() as MessageBlocklistDocument;
    transaction.update(reference, { status: 'ACTIVE', unblockedAt: now, unblockedBy: input.actorId, unblockReason: justification, updatedAt: now });
    transaction.create(eventReference, { unitId: 'ALL', phoneHash: input.id, maskedPhone: current.maskedPhone, action: 'BLOCKLIST_REMOVED', source: 'MANUAL', reason: justification, actorId: input.actorId, timestamp: now });
    return { ...current, status: 'ACTIVE' as const, unblockedAt: now, unblockedBy: input.actorId, unblockReason: justification, updatedAt: now };
  });
}

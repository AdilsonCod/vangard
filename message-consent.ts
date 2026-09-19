import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { maskMessagePhone } from './src/services/messageCampaignSchema';
import { normalizeMessageContact } from './message-blocklist';

export const MESSAGE_CONSENT_COLLECTION = 'message_contact_consents';
export const MESSAGE_CONSENT_EVENTS_COLLECTION = 'message_consent_events';
export type MessageLegalBasis = 'CONSENT' | 'CONTRACT' | 'LEGAL_OBLIGATION' | 'LEGITIMATE_INTEREST';

export type ContactConsentInput = {
  phone: string;
  origin: string;
  consentAt: string;
  evidence: string;
  legalBasis?: MessageLegalBasis;
};

export type MessageConsentDocument = {
  id: string;
  unitId: string;
  normalizedPhone: string;
  maskedPhone: string;
  status: 'GRANTED' | 'REVOKED';
  origin: string;
  consentAt: string;
  evidence: string;
  legalBasis: MessageLegalBasis;
  updatedAt: string;
  updatedBy: string;
};

export type MessageConsentEvent = {
  action: 'OPT_IN' | 'OPT_OUT' | 'OPT_IN_RESTORED' | 'BLOCKLIST_REMOVED';
  unitId: string;
  phoneHash: string;
  timestamp: string;
  actorId: string;
  origin?: string;
  consentAt?: string;
  evidence?: string;
  legalBasis?: MessageLegalBasis;
};

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const messageConsentId = (unitId: string, phone: string) => digest(`${unitId}:${normalizeMessageContact(phone)}`);

export function validateContactConsent(input: ContactConsentInput, now = new Date()) {
  const phone = normalizeMessageContact(input.phone);
  if (!phone) return { valid: false as const, error: 'Número de telefone inválido.' };
  const legalBasis = input.legalBasis || 'CONSENT';
  const origin = input.origin.trim(), evidence = input.evidence.trim();
  const consentTime = Date.parse(input.consentAt);
  if (!origin) return { valid: false as const, error: 'Informe a origem do consentimento.' };
  if (!evidence) return { valid: false as const, error: 'Informe a evidência ou justificativa da base legal.' };
  if (!Number.isFinite(consentTime) || consentTime > now.getTime()) return { valid: false as const, error: 'A data do consentimento é inválida ou está no futuro.' };
  return { valid: true as const, normalizedPhone: phone, legalBasis, origin, evidence, consentAt: new Date(consentTime).toISOString() };
}

export function mapImportedConsentRows(rows: Record<string, unknown>[], mapping: { phone: string; origin: string; consentAt: string; evidence: string; legalBasis?: string }) {
  return rows.map(row => ({
    phone: String(row[mapping.phone] || ''), origin: String(row[mapping.origin] || ''),
    consentAt: String(row[mapping.consentAt] || ''), evidence: String(row[mapping.evidence] || ''),
    legalBasis: (mapping.legalBasis ? String(row[mapping.legalBasis] || 'CONSENT').toUpperCase() : 'CONSENT') as MessageLegalBasis,
  }));
}

export function reconstructConsentAt(events: MessageConsentEvent[], at: Date) {
  const eligible = events.filter(event => Date.parse(event.timestamp) <= at.getTime()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latest = eligible.at(-1);
  return { granted: latest?.action === 'OPT_IN' || latest?.action === 'OPT_IN_RESTORED', latest: latest || null };
}

export async function registerMessageConsents(db: Firestore, input: { unitId: string; contacts: ContactConsentInput[]; actorId: string; now?: Date }) {
  const now = input.now || new Date();
  const validated = input.contacts.map(contact => validateContactConsent(contact, now));
  const invalid = validated.find(result => !result.valid);
  if (invalid && !invalid.valid) throw new Error(invalid.error);
  const unique = new Map(validated.filter(result => result.valid).map(result => [result.normalizedPhone, result]));
  if (!unique.size) throw new Error('Nenhum consentimento válido foi informado.');
  const batch = db.batch();
  unique.forEach(consent => {
    const id = messageConsentId(input.unitId, consent.normalizedPhone);
    const document: MessageConsentDocument = { id, unitId: input.unitId, normalizedPhone: consent.normalizedPhone, maskedPhone: maskMessagePhone(consent.normalizedPhone), status: 'GRANTED', origin: consent.origin, consentAt: consent.consentAt, evidence: consent.evidence, legalBasis: consent.legalBasis, updatedAt: now.toISOString(), updatedBy: input.actorId };
    batch.set(db.collection(MESSAGE_CONSENT_COLLECTION).doc(id), document, { merge: true });
    const eventId = digest(`${id}:${document.consentAt}:${document.origin}:${document.legalBasis}:${document.evidence}`);
    const event: MessageConsentEvent = { action: 'OPT_IN', unitId: input.unitId, phoneHash: id, timestamp: now.toISOString(), actorId: input.actorId, origin: document.origin, consentAt: document.consentAt, evidence: document.evidence, legalBasis: document.legalBasis };
    batch.set(db.collection(MESSAGE_CONSENT_EVENTS_COLLECTION).doc(eventId), event);
  });
  await batch.commit();
  return { registered: unique.size };
}

export async function applyMessagePhoneRetention(db: Firestore, now = new Date(), retentionDays = 730) {
  const cutoff = new Date(now.getTime() - Math.max(30, retentionDays) * 86_400_000).toISOString();
  let anonymizedRecipients = 0, anonymizedHistories = 0, deletedDirectoryContacts = 0, deletedConsents = 0;
  const recipients = await db.collection('message_campaign_recipients').where('processedAt', '<=', cutoff).limit(400).get();
  if (!recipients.empty) {
    const batch = db.batch();
    recipients.docs.forEach(document => { const data = document.data(); if (String(data.normalizedPhone || '').startsWith('anon_')) return; const hash = digest(String(data.normalizedPhone || '')); batch.update(document.ref, { normalizedPhone: `anon_${hash}`, maskedPhone: 'ANONIMIZADO', personalizedMessage: '', variables: {}, lastError: null, updatedAt: now.toISOString() }); anonymizedRecipients++; });
    if (anonymizedRecipients) await batch.commit();
  }
  const histories = await db.collection('message_dispatch_history').where('finishedAt', '<=', cutoff).limit(200).get();
  if (!histories.empty) {
    const batch = db.batch();
    histories.docs.forEach(document => { const data = document.data(); if (data.phoneDataAnonymizedAt) return; batch.update(document.ref, { contacts: [], deliveryDetails: [], errorDetails: [], phoneDataAnonymizedAt: now.toISOString() }); anonymizedHistories++; });
    if (anonymizedHistories) await batch.commit();
  }
  const [directory, consents] = await Promise.all([
    db.collection('message_contact_directory').where('updatedAt', '<=', cutoff).limit(400).get(),
    db.collection(MESSAGE_CONSENT_COLLECTION).where('updatedAt', '<=', cutoff).limit(400).get(),
  ]);
  if (!directory.empty || !consents.empty) {
    const batch = db.batch();
    directory.docs.forEach(document => { batch.delete(document.ref); deletedDirectoryContacts++; });
    consents.docs.forEach(document => { batch.delete(document.ref); deletedConsents++; });
    await batch.commit();
  }
  return { cutoff, anonymizedRecipients, anonymizedHistories, deletedDirectoryContacts, deletedConsents };
}

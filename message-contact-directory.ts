import { createHash } from 'node:crypto';
import { normalizeMessageContact } from './message-blocklist';

export const MESSAGE_CONTACT_DIRECTORY_COLLECTION = 'message_contact_directory';
export const MESSAGE_CONTACT_SEGMENT_COLLECTION = 'message_contact_segments';

export type MessageDirectoryContact = {
  id: string;
  unitId: string;
  name: string;
  normalizedPhone: string;
  maskedPhone: string;
  origin: string;
  consentAt: string;
  evidence: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export const messageDirectoryContactId = (unitId: string, phone: string) => createHash('sha256').update(`${unitId}:${normalizeMessageContact(phone)}`).digest('hex');
export const maskDirectoryPhone = (phone: string) => `${phone.slice(0, 4)}*****${phone.slice(-4)}`;

export function buildDirectoryContact(unitId: string, input: Record<string, unknown>, now = new Date().toISOString()): MessageDirectoryContact {
  const phone = normalizeMessageContact(input.phone);
  if (!unitId || !phone) throw new Error('Unidade e telefone válido são obrigatórios.');
  return { id: messageDirectoryContactId(unitId, phone), unitId, name: String(input.name || '').trim().slice(0, 160), normalizedPhone: phone, maskedPhone: maskDirectoryPhone(phone), origin: String(input.origin || '').trim().slice(0, 200), consentAt: String(input.consentAt || '').trim(), evidence: String(input.evidence || '').trim().slice(0, 500), variables: typeof input.variables === 'object' && input.variables ? Object.fromEntries(Object.entries(input.variables as Record<string, unknown>).map(([key, value]) => [key.slice(0, 80), String(value).slice(0, 500)])) : {}, createdAt: now, updatedAt: now };
}

export function searchDirectoryContacts(contacts: MessageDirectoryContact[], options: { unitId: string; query?: string; page?: number; pageSize?: number }) {
  const query = String(options.query || '').trim().toLocaleLowerCase('pt-BR');
  const phoneQuery = query.replace(/\D/g, '');
  const scoped = contacts.filter(contact => contact.unitId === options.unitId && (!query || contact.name.toLocaleLowerCase('pt-BR').includes(query) || Boolean(phoneQuery && contact.maskedPhone.includes(phoneQuery))));
  const pageSize = Math.max(1, Math.min(50, options.pageSize || 10));
  const page = Math.max(1, options.page || 1);
  const start = (page - 1) * pageSize;
  return { items: scoped.slice(start, start + pageSize).map(({ normalizedPhone: _phone, ...contact }) => contact), total: scoped.length, page, pageSize, totalPages: Math.max(1, Math.ceil(scoped.length / pageSize)) };
}

export function createSnapshotSegment(options: { id: string; unitId: string; name: string; contactIds: string[]; actorId: string; now?: string }) {
  const contactIds = [...new Set(options.contactIds.filter(Boolean))];
  if (!options.unitId || !options.name.trim() || !contactIds.length) throw new Error('Informe nome e contatos do segmento.');
  const now = options.now || new Date().toISOString();
  return { id: options.id, unitId: options.unitId, name: options.name.trim().slice(0, 120), policy: 'SNAPSHOT' as const, contactIds, contactCount: contactIds.length, createdAt: now, createdBy: options.actorId, updatedAt: now };
}

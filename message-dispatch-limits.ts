import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export const MESSAGE_POLICY_COLLECTION = 'message_dispatch_policies';
export const MESSAGE_QUOTA_COLLECTION = 'message_dispatch_quota_counters';
export const MESSAGE_FREQUENCY_COLLECTION = 'message_contact_frequency';
export const MESSAGE_ACCOUNT_SAFETY_COLLECTION = 'message_account_safety';

export type MessageDispatchPolicy = {
  globalDailyLimit: number;
  unitDailyLimit: number;
  accountDailyLimit: number;
  contactFrequencyHours: number;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timeZone: string;
  warmupEnabled: boolean;
  warmupDailyLimits: number[];
  warmupStageDays: number;
  failureWindowSize: number;
  failureMinimumSample: number;
  failureThresholdPercent: number;
  autoPauseCooldownMinutes: number;
};

export type DispatchBlock = { code: 'QUIET_HOURS' | 'GLOBAL_DAILY_LIMIT' | 'UNIT_DAILY_LIMIT' | 'ACCOUNT_DAILY_LIMIT' | 'WARMUP_DAILY_LIMIT' | 'CONTACT_FREQUENCY'; message: string; retryAt: string };

export class MessageDispatchPolicyBlockedError extends Error {
  constructor(public readonly block: DispatchBlock) { super(block.message); this.name = 'MessageDispatchPolicyBlockedError'; }
}

const defaults: MessageDispatchPolicy = {
  globalDailyLimit: 10_000,
  unitDailyLimit: 2_000,
  accountDailyLimit: 2_000,
  contactFrequencyHours: 24,
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  timeZone: 'America/Sao_Paulo',
  warmupEnabled: true,
  warmupDailyLimits: [20, 50, 100, 250, 500],
  warmupStageDays: 2,
  failureWindowSize: 20,
  failureMinimumSample: 10,
  failureThresholdPercent: 30,
  autoPauseCooldownMinutes: 15,
};

const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const validTime = (value: unknown, fallback: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')) ? String(value) : fallback;

export function normalizeMessageDispatchPolicy(value: Partial<MessageDispatchPolicy> = {}): MessageDispatchPolicy {
  const suppliedCurve = Array.isArray(value.warmupDailyLimits) ? value.warmupDailyLimits.map(item => bounded(item, 1, 1, 100_000)).slice(0, 30) : [];
  return {
    globalDailyLimit: bounded(value.globalDailyLimit, defaults.globalDailyLimit, 1, 1_000_000),
    unitDailyLimit: bounded(value.unitDailyLimit, defaults.unitDailyLimit, 1, 100_000),
    accountDailyLimit: bounded(value.accountDailyLimit, defaults.accountDailyLimit, 1, 100_000),
    contactFrequencyHours: bounded(value.contactFrequencyHours, defaults.contactFrequencyHours, 1, 24 * 90),
    quietHoursEnabled: value.quietHoursEnabled !== false,
    quietStart: validTime(value.quietStart, defaults.quietStart),
    quietEnd: validTime(value.quietEnd, defaults.quietEnd),
    timeZone: String(value.timeZone || defaults.timeZone),
    warmupEnabled: value.warmupEnabled !== false,
    warmupDailyLimits: suppliedCurve.length ? suppliedCurve : defaults.warmupDailyLimits,
    warmupStageDays: bounded(value.warmupStageDays, defaults.warmupStageDays, 1, 30),
    failureWindowSize: bounded(value.failureWindowSize, defaults.failureWindowSize, 5, 200),
    failureMinimumSample: bounded(value.failureMinimumSample, defaults.failureMinimumSample, 3, 100),
    failureThresholdPercent: bounded(value.failureThresholdPercent, defaults.failureThresholdPercent, 1, 100),
    autoPauseCooldownMinutes: bounded(value.autoPauseCooldownMinutes, defaults.autoPauseCooldownMinutes, 1, 24 * 60),
  };
}

function zonedParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };

export function quietHoursBlock(policy: MessageDispatchPolicy, now = new Date()): DispatchBlock | null {
  if (!policy.quietHoursEnabled || policy.quietStart === policy.quietEnd) return null;
  const local = zonedParts(now, policy.timeZone), start = minutes(policy.quietStart), end = minutes(policy.quietEnd);
  const blocked = start < end ? local.minutes >= start && local.minutes < end : local.minutes >= start || local.minutes < end;
  if (!blocked) return null;
  const remainingMinutes = start < end || local.minutes < end ? end - local.minutes : (24 * 60 - local.minutes) + end;
  const retryAt = new Date(now.getTime() + Math.max(1, remainingMinutes) * 60_000);
  return { code: 'QUIET_HOURS', message: `Envios pausados pelo horário silencioso até ${policy.quietEnd}.`, retryAt: retryAt.toISOString() };
}

export const messageFrequencyId = (unitId: string, phone: string) => createHash('sha256').update(`${unitId}:${phone}`).digest('hex');
const safeId = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);

export async function loadMessageDispatchPolicy(db: Firestore, unitId: string) {
  const snapshot = await db.collection(MESSAGE_POLICY_COLLECTION).doc(unitId).get();
  return normalizeMessageDispatchPolicy(snapshot.exists ? snapshot.data() as Partial<MessageDispatchPolicy> : {});
}

export async function reserveMessageDispatchSlot(options: {
  db: Firestore;
  transaction: Transaction;
  unitId: string;
  accountId: string;
  campaignId: string;
  phone: string;
  now: Date;
  alreadyReserved: boolean;
}) {
  if (options.alreadyReserved) return null;
  const policyReference = options.db.collection(MESSAGE_POLICY_COLLECTION).doc(options.unitId);
  const policySnapshot = await options.transaction.get(policyReference);
  const policy = normalizeMessageDispatchPolicy(policySnapshot.exists ? policySnapshot.data() as Partial<MessageDispatchPolicy> : {});
  const quiet = quietHoursBlock(policy, options.now);
  if (quiet) throw new MessageDispatchPolicyBlockedError(quiet);

  const local = zonedParts(options.now, policy.timeZone);
  const tomorrow = new Date(options.now.getTime() + Math.max(1, 24 * 60 - local.minutes) * 60_000).toISOString();
  const accountSafetyReference = options.db.collection(MESSAGE_ACCOUNT_SAFETY_COLLECTION).doc(safeId(options.accountId || options.unitId));
  const accountSafetySnapshot = await options.transaction.get(accountSafetyReference);
  const warmupStartedAt = String(accountSafetySnapshot.data()?.warmupStartedAt || options.now.toISOString());
  const warmupAgeDays = Math.max(0, Math.floor((options.now.getTime() - Date.parse(warmupStartedAt)) / 86_400_000));
  const warmupStage = Math.min(policy.warmupDailyLimits.length - 1, Math.floor(warmupAgeDays / policy.warmupStageDays));
  const warmupLimit = policy.warmupEnabled ? policy.warmupDailyLimits[warmupStage] : policy.accountDailyLimit;
  const effectiveAccountLimit = Math.min(policy.accountDailyLimit, warmupLimit);
  const counters = [
    { scope: 'global', id: `global_${local.day}`, limit: policy.globalDailyLimit, code: 'GLOBAL_DAILY_LIMIT' as const },
    { scope: 'unidade', id: `unit_${safeId(options.unitId)}_${local.day}`, limit: policy.unitDailyLimit, code: 'UNIT_DAILY_LIMIT' as const },
    { scope: 'conta', id: `account_${safeId(options.accountId || options.unitId)}_${local.day}`, limit: effectiveAccountLimit, code: (policy.warmupEnabled && warmupLimit < policy.accountDailyLimit ? 'WARMUP_DAILY_LIMIT' : 'ACCOUNT_DAILY_LIMIT') as 'WARMUP_DAILY_LIMIT' | 'ACCOUNT_DAILY_LIMIT' },
  ];
  const counterSnapshots = await Promise.all(counters.map(item => options.transaction.get(options.db.collection(MESSAGE_QUOTA_COLLECTION).doc(item.id))));
  const frequencyReference = options.db.collection(MESSAGE_FREQUENCY_COLLECTION).doc(messageFrequencyId(options.unitId, options.phone));
  const frequencySnapshot = await options.transaction.get(frequencyReference);
  const frequency = frequencySnapshot.exists ? frequencySnapshot.data() as { campaignId?: string; nextAllowedAt?: string } : null;
  if (frequency?.campaignId !== options.campaignId && frequency?.nextAllowedAt && Date.parse(frequency.nextAllowedAt) > options.now.getTime()) {
    throw new MessageDispatchPolicyBlockedError({ code: 'CONTACT_FREQUENCY', message: `Contato aguardando a janela mínima entre campanhas até ${new Date(frequency.nextAllowedAt).toLocaleString('pt-BR')}.`, retryAt: frequency.nextAllowedAt });
  }
  for (let index = 0; index < counters.length; index += 1) {
    const used = Number(counterSnapshots[index].data()?.used || 0);
    if (used >= counters[index].limit) throw new MessageDispatchPolicyBlockedError({ code: counters[index].code, message: `Limite diário ${counters[index].scope} atingido. Novos envios serão liberados no próximo dia.`, retryAt: tomorrow });
  }
  counters.forEach((item, index) => {
    const reference = options.db.collection(MESSAGE_QUOTA_COLLECTION).doc(item.id), used = Number(counterSnapshots[index].data()?.used || 0);
    options.transaction.set(reference, { scope: item.scope, scopeId: item.scope === 'global' ? 'ALL' : item.scope === 'unidade' ? options.unitId : options.accountId, day: local.day, used: used + 1, limit: item.limit, updatedAt: options.now.toISOString() }, { merge: true });
  });
  const nextAllowedAt = new Date(options.now.getTime() + policy.contactFrequencyHours * 60 * 60_000).toISOString();
  options.transaction.set(frequencyReference, { unitId: options.unitId, phoneHash: frequencyReference.id, campaignId: options.campaignId, lastReservedAt: options.now.toISOString(), nextAllowedAt }, { merge: true });
  options.transaction.set(accountSafetyReference, { unitId: options.unitId, accountId: options.accountId || options.unitId, warmupStartedAt, warmupStage, warmupDailyLimit: effectiveAccountLimit, updatedAt: options.now.toISOString() }, { merge: true });
  return { reservedAt: options.now.toISOString(), nextAllowedAt };
}

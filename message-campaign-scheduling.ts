import type { MessageCampaignDocument, MessageCampaignRecurrence } from './src/services/messageCampaignSchema';
import { randomUUID } from 'node:crypto';

export const DEFAULT_CAMPAIGN_TIME_ZONE = 'America/Sao_Paulo';

export type CampaignScheduleInput = {
  scheduledAt?: unknown;
  timeZone?: unknown;
  recurrence?: unknown;
  recurrenceEndsAt?: unknown;
  approvalRequired?: unknown;
};

const validDate = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
};

export function normalizeCampaignSchedule(input: CampaignScheduleInput, now = new Date()) {
  const timeZone = String(input.timeZone || DEFAULT_CAMPAIGN_TIME_ZONE);
  try { new Intl.DateTimeFormat('pt-BR', { timeZone }).format(now); }
  catch { throw new Error('Fuso horário inválido para o agendamento.'); }
  const scheduled = input.scheduledAt ? validDate(input.scheduledAt) : null;
  if (input.scheduledAt && !scheduled) throw new Error('Data de início inválida.');
  if (scheduled && scheduled.getTime() < now.getTime() - 60_000) throw new Error('A data de início não pode estar no passado.');
  const recurrence = String(input.recurrence || 'NONE').toUpperCase() as MessageCampaignRecurrence;
  if (!['NONE','DAILY','WEEKLY','MONTHLY'].includes(recurrence)) throw new Error('Recorrência inválida.');
  if (recurrence !== 'NONE' && !scheduled) throw new Error('Campanhas recorrentes precisam de uma data de início.');
  const recurrenceEnds = input.recurrenceEndsAt ? validDate(input.recurrenceEndsAt) : null;
  if (input.recurrenceEndsAt && !recurrenceEnds) throw new Error('Data final da recorrência inválida.');
  if (recurrenceEnds && scheduled && recurrenceEnds <= scheduled) throw new Error('O fim da recorrência deve ser posterior ao primeiro envio.');
  const approvalRequired = input.approvalRequired === true;
  const status: MessageCampaignDocument['status'] = approvalRequired ? 'AGUARDANDO_APROVACAO' : scheduled && scheduled > now ? 'AGENDADA' : 'NA_FILA';
  return { scheduledAt: scheduled?.toISOString() || null, timeZone, recurrence, recurrenceEndsAt: recurrenceEnds?.toISOString() || null, approvalRequired, status };
}

export function approveCampaignTransition(campaign: MessageCampaignDocument, approverId: string, approverEmail = '', now = new Date()) {
  if (campaign.status !== 'AGUARDANDO_APROVACAO') throw new Error('Esta campanha não está aguardando aprovação.');
  if (campaign.createdBy === approverId) throw new Error('O criador da campanha não pode aprovar o próprio envio.');
  const status: MessageCampaignDocument['status'] = campaign.scheduledAt && Date.parse(campaign.scheduledAt) > now.getTime() ? 'AGENDADA' : 'NA_FILA';
  return { status, approvedAt: now.toISOString(), approvedBy: approverId, ...(approverEmail ? { approvedByEmail: approverEmail } : {}), updatedAt: now.toISOString() };
}

export function cancelCampaignTransition(campaign: MessageCampaignDocument, actorId: string, reason: string, now = new Date()) {
  const processed = campaign.sentCount + campaign.deliveredCount + campaign.readCount + campaign.failedCount;
  if (processed > 0 || campaign.firstSentAt || campaign.status === 'EM_PROCESSAMENTO') throw new Error('O processamento já começou. Use a interrupção auditada da campanha ativa.');
  if (['CONCLUIDA','CANCELADA','FALHOU'].includes(campaign.status)) throw new Error('Esta campanha já foi encerrada.');
  return { status: 'CANCELADA' as const, cancelledAt: now.toISOString(), cancelledBy: actorId, cancellationReason: reason.trim().slice(0,300) || 'Cancelada antes do primeiro envio.', updatedAt: now.toISOString(), finishedAt: now.toISOString() };
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part=>part.type===type)?.value || 0);
  return { year:value('year'), month:value('month'), day:value('day'), hour:value('hour'), minute:value('minute'), second:value('second') };
}

function localPartsToUtc(parts: ReturnType<typeof zonedParts>, timeZone: string) {
  const wallClock = Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);
  let candidate = wallClock;
  for(let attempt=0;attempt<2;attempt++) {
    const observed=zonedParts(new Date(candidate),timeZone);
    const observedWall=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second);
    candidate += wallClock-observedWall;
  }
  return new Date(candidate);
}

export function nextCampaignOccurrence(campaign: MessageCampaignDocument) {
  if (!campaign.scheduledAt || !campaign.recurrence || campaign.recurrence === 'NONE') return null;
  const timeZone=campaign.timeZone||DEFAULT_CAMPAIGN_TIME_ZONE,parts=zonedParts(new Date(campaign.scheduledAt),timeZone);
  const local=new Date(Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second));
  if (campaign.recurrence === 'DAILY') local.setUTCDate(local.getUTCDate() + 1);
  if (campaign.recurrence === 'WEEKLY') local.setUTCDate(local.getUTCDate() + 7);
  if (campaign.recurrence === 'MONTHLY') local.setUTCMonth(local.getUTCMonth() + 1);
  const date=localPartsToUtc({year:local.getUTCFullYear(),month:local.getUTCMonth()+1,day:local.getUTCDate(),hour:local.getUTCHours(),minute:local.getUTCMinutes(),second:local.getUTCSeconds()},timeZone);
  if (campaign.recurrenceEndsAt && date > new Date(campaign.recurrenceEndsAt)) return null;
  return date.toISOString();
}

export function buildCampaignDuplicateDraft(campaign: MessageCampaignDocument, recipients: { normalizedPhone: string; variables?: Record<string,string> }[], idempotencyKey = randomUUID()) {
  return {
    campaignName:`Cópia de ${campaign.name}`.slice(0,120),message:campaign.message,
    contacts:recipients.map(item=>item.normalizedPhone),
    recipientData:recipients.map(item=>({phone:item.normalizedPhone,name:item.variables?.nome||'',variables:item.variables||{}})),
    minDelay:campaign.minDelaySeconds,maxDelay:campaign.maxDelaySeconds,simulateTyping:campaign.simulateTyping!==false,
    idempotencyKey,scheduledAt:null,recurrence:'NONE' as const,approvalRequired:false,
  };
}

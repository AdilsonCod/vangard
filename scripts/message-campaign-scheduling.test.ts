import assert from 'node:assert/strict';
import test from 'node:test';
import { approveCampaignTransition, buildCampaignDuplicateDraft, cancelCampaignTransition, nextCampaignOccurrence, normalizeCampaignSchedule } from '../message-campaign-scheduling';
import type { MessageCampaignDocument } from '../src/services/messageCampaignSchema';

const campaign=(overrides:Partial<MessageCampaignDocument>={}):MessageCampaignDocument=>({schemaVersion:1,id:'campaign-a',unitId:'matriz',name:'Campanha',status:'AGUARDANDO_APROVACAO',message:'Olá',totalRecipients:1,pendingCount:1,processingCount:0,sentCount:0,deliveredCount:0,readCount:0,failedCount:0,cancelledCount:0,scheduledAt:'2026-10-01T12:00:00.000Z',createdAt:'2026-09-18T12:00:00.000Z',createdBy:'creator',updatedAt:'2026-09-18T12:00:00.000Z',...overrides});

test('normaliza início futuro, fuso e recorrência',()=>{
  const result=normalizeCampaignSchedule({scheduledAt:'2026-10-01T12:00:00.000Z',timeZone:'America/Sao_Paulo',recurrence:'WEEKLY',recurrenceEndsAt:'2026-12-01T12:00:00.000Z',approvalRequired:true},new Date('2026-09-18T12:00:00.000Z'));
  assert.equal(result.status,'AGUARDANDO_APROVACAO');
  assert.equal(result.recurrence,'WEEKLY');
  assert.throws(()=>normalizeCampaignSchedule({scheduledAt:'2026-01-01T00:00:00Z'},new Date('2026-09-18T00:00:00Z')),/passado/);
});

test('mantém o horário local ao atravessar mudança de horário de verão',()=>{
  const next=nextCampaignOccurrence(campaign({scheduledAt:'2026-03-07T14:00:00.000Z',timeZone:'America/New_York',recurrence:'DAILY'}));
  assert.equal(next,'2026-03-08T13:00:00.000Z');
});

test('exige outro administrador e respeita a data agendada',()=>{
  const source=campaign();
  assert.throws(()=>approveCampaignTransition(source,'creator','creator@example.com',new Date('2026-09-18T12:00:00Z')),/não pode aprovar/);
  const approved=approveCampaignTransition(source,'admin-2','admin2@example.com',new Date('2026-09-18T12:00:00Z'));
  assert.equal(approved.status,'AGENDADA');
  assert.equal(approved.approvedBy,'admin-2');
});

test('cancelamento livre termina antes do primeiro envio',()=>{
  assert.equal(cancelCampaignTransition(campaign({status:'AGENDADA'}),'admin','Planejamento alterado').status,'CANCELADA');
  assert.throws(()=>cancelCampaignTransition(campaign({status:'EM_PROCESSAMENTO',sentCount:1,firstSentAt:'2026-09-18T12:10:00Z'}),'admin','Cancelar'),/processamento já começou/);
});

test('duplicação remove estado operacional e recebe nova chave',()=>{
  const source=campaign({status:'CONCLUIDA',requestIdempotencyKey:'original',firstSentAt:'2026-09-18T12:00:00Z'});
  const copy=buildCampaignDuplicateDraft(source,[{normalizedPhone:'5511999999999',variables:{nome:'Ana'}}],'nova-chave');
  assert.equal(copy.idempotencyKey,'nova-chave');
  assert.equal(copy.scheduledAt,null);
  assert.equal(copy.approvalRequired,false);
  assert.ok(!('id' in copy));
  assert.ok(!('status' in copy));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCampaignPerformance, safeCampaignRecipientExport, summarizeCampaignPerformance } from '../message-campaign-analytics';
import type { MessageCampaignDocument, MessageCampaignRecipientDocument } from '../src/services/messageCampaignSchema';

const campaign = { id: 'c1', unitId: 'u1', name: 'Retorno', status: 'EM_PROCESSAMENTO', totalRecipients: 4, createdAt: '2026-09-19T10:00:00.000Z', firstSentAt: '2026-09-19T10:00:00.000Z' } as MessageCampaignDocument;
const recipient = (id: string, status: MessageCampaignRecipientDocument['status'], extra: Partial<MessageCampaignRecipientDocument> = {}) => ({ id, campaignId: 'c1', unitId: 'u1', normalizedPhone: `55119999900${id.slice(-1)}`, maskedPhone: '5511*****0000', status, createdAt: '2026-09-19T10:00:00.000Z', updatedAt: '2026-09-19T10:00:10.000Z', attemptCount: 1, maxAttempts: 3, idempotencyKey: id, nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null, personalizedMessage: 'Olá', variables: {}, schemaVersion: 1, ...extra } as MessageCampaignRecipientDocument);

test('consolida entrega, leitura, resposta, falha, média e estimativa', () => {
  const items = [recipient('r1', 'ENVIADO', { processedAt: '2026-09-19T10:00:10.000Z' }), recipient('r2', 'ENTREGUE', { processedAt: '2026-09-19T10:00:20.000Z' }), recipient('r3', 'FALHOU', { processedAt: '2026-09-19T10:00:30.000Z', lastError: 'Número inválido' }), recipient('r4', 'PENDENTE')];
  const result = buildCampaignPerformance(campaign, items, new Set(['r2']), new Date('2026-09-19T10:01:00.000Z'));
  assert.deepEqual({ sent: result.sent, delivered: result.delivered, read: result.read, responded: result.responded, failed: result.failed }, { sent: 2, delivered: 1, read: 0, responded: 1, failed: 1 });
  assert.equal(result.averageProcessingMs, 20_000);
  assert.equal(result.estimatedRemainingMs, 20_000);
  assert.equal(result.failureReasons['Número inválido'], 1);
});

test('resumo compara campanhas sem perder a distribuição de falhas', () => {
  const first = buildCampaignPerformance(campaign, [recipient('r1', 'FALHOU', { lastError: 'Bloqueado' })]);
  const second = buildCampaignPerformance({ ...campaign, id: 'c2', name: 'Outra' }, [{ ...recipient('r2', 'FALHOU', { lastError: 'Bloqueado' }), campaignId: 'c2' }]);
  const summary = summarizeCampaignPerformance([first, second]);
  assert.equal(summary.campaigns, 2);
  assert.equal(summary.failureReasons.Bloqueado, 2);
});

test('exportação mascara telefone do destinatário', () => {
  const exported = safeCampaignRecipientExport(recipient('r1', 'ENVIADO'));
  assert.equal(exported.contact.includes('99999001'), false);
  assert.match(exported.contact, /\*{5}/);
});

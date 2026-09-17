import assert from 'node:assert/strict';
import test from 'node:test';
import { createMessageCampaignAtomically, planMessageCampaignCreation } from '../message-campaign-creation';

class FakeFirestore {
  documents = new Map<string, unknown>();
  failAfterCreates = Number.POSITIVE_INFINITY;
  collection(name: string) { return { doc: (id: string) => `${name}/${id}` }; }
  async runTransaction<T>(handler: (transaction: { get(reference: unknown): Promise<{ exists: boolean; data(): unknown }>; create(reference: unknown, data: unknown): unknown }) => Promise<T>) {
    const staged = new Map<string, unknown>();
    let creates = 0;
    const result = await handler({
      get: async reference => ({ exists: this.documents.has(String(reference)), data: () => this.documents.get(String(reference)) }),
      create: (reference, data) => {
        creates += 1;
        if (creates > this.failAfterCreates) throw new Error('Falha simulada');
        const key = String(reference);
        if (this.documents.has(key) || staged.has(key)) throw new Error('Documento já existe');
        staged.set(key, data);
        return this;
      },
    });
    staged.forEach((value, key) => this.documents.set(key, value));
    return result;
  }
}

const input = { requestIdempotencyKey: 'request-1', unitId: 'unit-a', name: 'Retorno', message: 'Olá', contacts: ['11999999999', '(11) 99999-9999', 'inválido'], createdBy: 'admin', createdAt: '2026-09-16T12:00:00.000Z' };

test('planejamento deduplica contatos e gera IDs determinísticos', () => {
  const first = planMessageCampaignCreation(input);
  const second = planMessageCampaignCreation(input);
  assert.deepEqual(first, second);
  assert.equal(first.recipients.length, 1);
  assert.equal(first.recipients[0].normalizedPhone, '5511999999999');
  assert.equal(first.campaign.totalRecipients, 1);
});

test('lote parcialmente inválido mantém somente contatos válidos e lote totalmente inválido é rejeitado', () => {
  const partial = planMessageCampaignCreation({ ...input, contacts: ['11999999999', 'abc', '123'] });
  assert.deepEqual(partial.recipients.map(item => item.normalizedPhone), ['5511999999999']);
  assert.throws(() => planMessageCampaignCreation({ ...input, contacts: ['abc', '123'] }), /contato válido/);
});

test('criação persiste campanha e destinatários uma única vez', async () => {
  const db = new FakeFirestore();
  const first = await createMessageCampaignAtomically(db, input);
  const second = await createMessageCampaignAtomically(db, input);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(db.documents.size, 2);
});

test('a mesma chave rejeita conteúdo diferente', async () => {
  const db = new FakeFirestore();
  await createMessageCampaignAtomically(db, input);
  await assert.rejects(() => createMessageCampaignAtomically(db, { ...input, message: 'Outra mensagem' }), /dados diferentes/);
});

test('falha parcial não deixa campanha nem destinatários persistidos', async () => {
  const db = new FakeFirestore();
  db.failAfterCreates = 1;
  await assert.rejects(() => createMessageCampaignAtomically(db, input), /Falha simulada/);
  assert.equal(db.documents.size, 0);
});

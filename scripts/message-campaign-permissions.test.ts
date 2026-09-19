import assert from 'node:assert/strict';
import test from 'node:test';
import { canPerformMessageCampaignAction } from '../message-campaign-permissions';

test('administrador pode criar, aprovar e executar campanhas', () => {
  const user = { uid: 'admin-1', role: 'ADMIN' };
  assert.equal(canPerformMessageCampaignAction(user, 'create'), true);
  assert.equal(canPerformMessageCampaignAction(user, 'approve'), true);
  assert.equal(canPerformMessageCampaignAction(user, 'execute'), true);
});

test('marketing e recepção não elevam privilégio para aprovação', () => {
  for (const role of ['MARKETING', 'RECEPTION']) {
    const user = { uid: role.toLowerCase(), role, dispatchPermissions: { approve: true } };
    assert.equal(canPerformMessageCampaignAction(user, 'approve'), false);
    assert.equal(canPerformMessageCampaignAction(user, 'create'), true);
    assert.equal(canPerformMessageCampaignAction(user, 'execute'), true);
  }
});

test('restrição individual confiável pode retirar uma permissão básica', () => {
  const user = { uid: 'marketing-1', role: 'MARKETING', dispatchPermissions: { execute: false } };
  assert.equal(canPerformMessageCampaignAction(user, 'create'), true);
  assert.equal(canPerformMessageCampaignAction(user, 'execute'), false);
});

test('perfil sem acesso de comunicação permanece bloqueado', () => {
  const user = { uid: 'barber-1', role: 'BARBER', dispatchPermissions: { create: true, approve: true, execute: true } };
  assert.equal(canPerformMessageCampaignAction(user, 'create'), false);
  assert.equal(canPerformMessageCampaignAction(user, 'approve'), false);
  assert.equal(canPerformMessageCampaignAction(user, 'execute'), false);
});

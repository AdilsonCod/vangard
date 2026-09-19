import type { VerifiedFirebaseUser } from './server-auth';

export type MessageCampaignAction = 'create' | 'approve' | 'execute';
type DispatchGrants = Partial<Record<MessageCampaignAction, boolean>>;

const baseGrants: Record<string, Record<MessageCampaignAction, boolean>> = {
  ADMIN: { create: true, approve: true, execute: true },
  MARKETING: { create: true, approve: false, execute: true },
  RECEPTION: { create: true, approve: false, execute: true },
};

export function canPerformMessageCampaignAction(user: VerifiedFirebaseUser | undefined, action: MessageCampaignAction) {
  if (!user) return false;
  const grants = baseGrants[String(user.role || '').toUpperCase()];
  if (!grants?.[action]) return false;
  const override = user.dispatchPermissions as DispatchGrants | undefined;
  return override?.[action] !== false;
}

export function assertMessageCampaignAction(user: VerifiedFirebaseUser | undefined, action: MessageCampaignAction) {
  if (!canPerformMessageCampaignAction(user, action)) {
    const label = { create: 'criar', approve: 'aprovar', execute: 'executar' }[action];
    throw new Error(`Seu perfil não possui permissão para ${label} campanhas.`);
  }
}

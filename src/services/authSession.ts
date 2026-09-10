import type { User } from '../types';

export type AuthIdentity = { uid: string; email?: string | null };

export type AuthSessionGateway = {
  signIn: (email: string, password: string) => Promise<AuthIdentity>;
  signOut: () => Promise<void>;
  readProfile: (uid: string, email?: string | null) => Promise<User | null>;
};

export const authenticatedProfile = (profile: User | null, uid: string): User | null => {
  if (!profile || profile.isActive === false) return null;
  return { ...profile, id: uid, authUid: uid };
};

export const restoreAuthenticatedSession = async (
  identity: AuthIdentity | null,
  readProfile: AuthSessionGateway['readProfile'],
): Promise<User | null> => {
  if (!identity) return null;
  return authenticatedProfile(await readProfile(identity.uid, identity.email), identity.uid);
};

export const startAuthenticatedSession = async (
  gateway: AuthSessionGateway,
  email: string,
  password: string,
): Promise<User | null> => {
  try {
    const identity = await gateway.signIn(email.trim().toLowerCase(), password);
    const profile = await restoreAuthenticatedSession(identity, gateway.readProfile);
    if (profile) return profile;
  } catch {
    // A tela de login apresenta uma mensagem neutra para não revelar se a conta existe.
  }
  await gateway.signOut().catch(() => undefined);
  return null;
};

export const endAuthenticatedSession = async (
  signOutSession: () => Promise<void>,
  clearPrivateState: () => void,
) => {
  try {
    await signOutSession();
  } finally {
    clearPrivateState();
  }
};

export const canAccessProtectedContent = (profile: User | null) => profile !== null;

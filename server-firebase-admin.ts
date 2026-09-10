import { applicationDefault, cert, getApps, initializeApp, type AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import type { VerifiedFirebaseUser } from './server-auth';

function adminOptions(): AppOptions {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || firebaseConfig.projectId;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (rawServiceAccount) {
    try {
      return { credential: cert(JSON.parse(rawServiceAccount)), projectId };
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contém um JSON inválido.');
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return { credential: applicationDefault(), projectId };
  }

  // A verificação de ID tokens funciona com o projectId. Operações administrativas
  // exigem uma das credenciais seguras acima ou a identidade gerenciada do ambiente.
  return { projectId };
}

const adminApp = getApps()[0] ?? initializeApp(adminOptions());

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

function normalizedRole(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : undefined;
}

async function trustedProfile(uid: string, email?: string) {
  const direct = await adminDb.collection('users').doc(uid).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };

  const byAuthUid = await adminDb.collection('users').where('authUid', '==', uid).limit(1).get();
  if (!byAuthUid.empty) return { id: byAuthUid.docs[0].id, ...byAuthUid.docs[0].data() };

  if (!email) return undefined;
  const byEmail = await adminDb.collection('users').where('email', '==', email.trim().toLowerCase()).limit(1).get();
  return byEmail.empty ? undefined : { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
  const decoded = await adminAuth.verifyIdToken(token);
  const profile = await trustedProfile(decoded.uid, decoded.email);
  const unitId = profile?.unitId ?? profile?.unit;

  return {
    uid: decoded.uid,
    email: decoded.email,
    role: normalizedRole(profile?.role ?? decoded.role),
    unitId: typeof unitId === 'string' ? unitId : undefined,
    profileId: typeof profile?.id === 'string' ? profile.id : undefined,
  };
}

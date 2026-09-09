import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { buildCanonicalUserProfile, isCanonicalUserProfile, UserProfileData as LegacyProfile } from './user-uid-migration-core';

const applyChanges = process.argv.slice(2).includes('--apply');
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential, projectId: firebaseConfig.projectId });
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const profiles = await db.collection('users').get();
const unmatched: Array<{ documentId: string; email: string; reason: string }> = [];
const migrations: Array<{ documentId: string; uid: string }> = [];
let alreadyCanonical = 0;

for (const document of profiles.docs) {
  const profile = document.data() as LegacyProfile;
  const email = String(profile.email || '').trim().toLowerCase();
  try {
    const authUser = profile.authUid
      ? await auth.getUser(profile.authUid)
      : email
        ? await auth.getUserByEmail(email)
        : null;
    if (!authUser) {
      unmatched.push({ documentId: document.id, email, reason: 'Perfil sem e-mail ou UID para correspondência.' });
      continue;
    }
    if (isCanonicalUserProfile(document.id, profile, authUser.uid)) {
      alreadyCanonical += 1;
      continue;
    }
    migrations.push({ documentId: document.id, uid: authUser.uid });
  } catch (error) {
    const code = (error as { code?: string }).code || 'auth/unknown';
    unmatched.push({ documentId: document.id, email, reason: code });
  }
}

console.log(`Perfis encontrados: ${profiles.size}.`);
console.log(`Já padronizados: ${alreadyCanonical}.`);
console.log(`Prontos para migração: ${migrations.length}.`);
if (unmatched.length) {
  console.log('Perfis sem correspondência (nenhum deles será removido):');
  console.table(unmatched);
}

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi alterado.');
  process.exit(0);
}

let migrated = 0;
for (const item of migrations) {
  const legacyRef = db.collection('users').doc(item.documentId);
  const canonicalRef = db.collection('users').doc(item.uid);
  await db.runTransaction(async transaction => {
    const [legacySnapshot, canonicalSnapshot] = await Promise.all([
      transaction.get(legacyRef),
      transaction.get(canonicalRef),
    ]);
    if (!legacySnapshot.exists) return;
    const legacyProfile = legacySnapshot.data() as LegacyProfile;
    const canonicalProfile = canonicalSnapshot.exists ? canonicalSnapshot.data() as LegacyProfile : {};
    const canonicalEmail = String(canonicalProfile.email || '').trim().toLowerCase();
    const legacyEmail = String(legacyProfile.email || '').trim().toLowerCase();
    if (canonicalSnapshot.exists && canonicalEmail && legacyEmail && canonicalEmail !== legacyEmail) {
      throw new Error(`Conflito: users/${item.uid} pertence a outro e-mail.`);
    }
    transaction.set(canonicalRef, buildCanonicalUserProfile(
      legacyProfile,
      canonicalProfile,
      item.documentId,
      item.uid,
      new Date().toISOString(),
      FieldValue.delete(),
    ), { merge: true });
    if (legacyRef.path !== canonicalRef.path) transaction.delete(legacyRef);
  });
  migrated += 1;
  console.log(`Migrado ${migrated}/${migrations.length}: ${item.documentId} -> ${item.uid}`);
}

console.log(`Migração concluída: ${migrated} perfil(is) padronizado(s) por UID.`);
console.log(`${unmatched.length} perfil(is) sem correspondência foram preservados sem alteração.`);

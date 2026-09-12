import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const applyChanges = process.argv.includes('--apply');
const backupRoot = process.env.FIREBASE_PROFILE_BACKUP_DIR?.trim()
  || path.join(process.cwd(), '.local-backups');

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId,
});
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function hasAuthCorrespondence(data: FirebaseFirestore.DocumentData): Promise<boolean> {
  const uid = String(data.authUid || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  if (uid) {
    try {
      await auth.getUser(uid);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
  }
  if (email) {
    try {
      await auth.getUserByEmail(email);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
  }
  return false;
}

const snapshot = await db.collection('users').get();
const unmatched = [] as Array<{ id: string; data: FirebaseFirestore.DocumentData }>;
for (const document of snapshot.docs) {
  if (!(await hasAuthCorrespondence(document.data()))) {
    unmatched.push({ id: document.id, data: document.data() });
  }
}

console.log(`Perfis verificados: ${snapshot.size}.`);
console.log(`Perfis sem correspondência no Firebase Auth: ${unmatched.length}.`);
console.table(unmatched.map(({ id, data }) => ({ id, email: String(data.email || '') })));

if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhum documento foi removido.');
  process.exit(0);
}

if (unmatched.length === 0) {
  console.log('Nenhum perfil precisa ser removido.');
  process.exit(0);
}

await mkdir(backupRoot, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupRoot, `firebase-users-unmatched-${timestamp}.json`);
await writeFile(backupPath, JSON.stringify({
  projectId: firebaseConfig.projectId,
  createdAt: new Date().toISOString(),
  collection: 'users',
  documents: unmatched,
}, null, 2), 'utf8');

const batch = db.batch();
for (const profile of unmatched) batch.delete(db.collection('users').doc(profile.id));
await batch.commit();

const remaining = await db.collection('users').get();
console.log(`Backup gravado em: ${backupPath}`);
console.log(`Remoção concluída: ${unmatched.length} perfil(is). Restam ${remaining.size} perfil(is).`);

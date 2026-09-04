import fs from 'node:fs';
import path from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import { doc, initializeFirestore, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

type BackupUser = {
  _id?: string;
  id?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  unit?: string | null;
  isActive?: boolean;
};

type AuthResponse = {
  localId: string;
};

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const backupArgument = args.find(argument => !argument.startsWith('--'));

if (!backupArgument) {
  throw new Error('Informe o backup. Exemplo: npm run auth:migrate:dry -- .Docs/BAKU.MOD.md');
}

const backupPath = path.resolve(backupArgument);
const rawBackup = fs.readFileSync(backupPath, 'utf8').trim();
const jsonText = rawBackup.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
const backup = JSON.parse(jsonText) as { collections?: { users?: BackupUser[] } };
const users = backup.collections?.users;

if (!Array.isArray(users) || users.length === 0) {
  throw new Error('Backup inválido: coleção de usuários vazia ou ausente.');
}

const emails = new Set<string>();
for (const user of users) {
  const userId = String(user.id || user._id || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  const password = String(user.password || '');
  if (!userId) throw new Error('Existe usuário sem ID no backup.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`E-mail inválido no usuário ${userId}.`);
  if (password.length < 6) throw new Error(`Senha incompatível com Firebase Auth no usuário ${userId}.`);
  if (emails.has(email)) throw new Error(`E-mail duplicado no usuário ${userId}.`);
  emails.add(email);
}

console.log(`Migração validada: ${users.length} contas, sem e-mails duplicados ou senhas incompatíveis.`);
if (!applyChanges) {
  console.log('SIMULAÇÃO concluída. Nenhuma conta ou documento foi alterado.');
  process.exit(0);
}

async function callAuth(endpoint: 'signUp' | 'signInWithPassword', email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const payload = await response.json() as AuthResponse & { error?: { message?: string } };
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Firebase Auth retornou HTTP ${response.status}.`);
    (error as Error & { code?: string }).code = payload.error?.message;
    throw error;
  }
  return payload;
}

const app = initializeApp(firebaseConfig, `auth-migration-${Date.now()}`);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || '(default)');
let created = 0;
let existing = 0;

try {
  for (const [index, user] of users.entries()) {
    const userId = String(user.id || user._id);
    const email = String(user.email).trim().toLowerCase();
    const password = String(user.password);
    let authUser: AuthResponse;

    try {
      authUser = await callAuth('signUp', email, password);
      created += 1;
    } catch (error) {
      if ((error as Error & { code?: string }).code !== 'EMAIL_EXISTS') throw error;
      authUser = await callAuth('signInWithPassword', email, password);
      existing += 1;
    }

    await setDoc(doc(db, 'authUsers', authUser.localId), {
      userId,
      email,
      role: user.role || 'BARBER',
      unit: user.unit ?? null,
      isActive: user.isActive !== false,
      migratedAt: new Date().toISOString(),
    }, { merge: true });
    await setDoc(doc(db, 'users', userId), { authUid: authUser.localId }, { merge: true });
    console.log(`Conta ${index + 1}/${users.length} vinculada.`);
  }

  console.log(`Migração concluída: ${created} contas criadas, ${existing} contas existentes validadas.`);
  console.log('As senhas legadas foram preservadas temporariamente para permitir reversão segura.');
} finally {
  await deleteApp(app);
}

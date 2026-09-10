import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../firebase';

export async function createFirebaseUser(email: string, password: string) {
  const secondaryApp = initializeApp(firebaseConfig, `user-registration-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp);
  }
}

export async function createFirebaseUserWithProfile(
  email: string,
  password: string,
  saveProfile: (authUid: string) => Promise<void>,
) {
  const secondaryApp = initializeApp(firebaseConfig, `user-registration-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    try {
      await saveProfile(credential.user.uid);
      return credential.user.uid;
    } catch (error) {
      await deleteUser(credential.user).catch(rollbackError => {
        console.error('Não foi possível desfazer a conta após falha no perfil:', rollbackError);
      });
      throw error;
    }
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp);
  }
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export function accountErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('email-already-in-use')) return 'Este e-mail já possui uma conta de acesso.';
  if (code.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (code.includes('invalid-email')) return 'Informe um endereço de e-mail válido.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (code.includes('network-request-failed')) return 'Falha de conexão com o Firebase.';
  return 'Não foi possível concluir a operação de acesso.';
}

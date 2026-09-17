import type { Firestore } from 'firebase-admin/firestore';

export const MESSAGE_SESSION_LOCK_COLLECTION = 'message_whatsapp_session_locks';

export type MessageSessionLock = {
  unitId: string;
  ownerId: string;
  fencingToken: number;
  leaseExpiresAt: string;
  acquiredAt: string;
  updatedAt: string;
};

export async function acquireMessageSessionLock(
  db: Firestore,
  unitId: string,
  ownerId: string,
  now = new Date(),
  leaseMs = 60_000,
) {
  const ref = db.collection(MESSAGE_SESSION_LOCK_COLLECTION).doc(unitId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() as MessageSessionLock : null;
    const expired = !current || Date.parse(current.leaseExpiresAt) <= now.getTime();
    if (current && current.ownerId !== ownerId && !expired) return null;
    const fencingToken = current?.ownerId === ownerId && !expired
      ? current.fencingToken
      : (current?.fencingToken || 0) + 1;
    const lock: MessageSessionLock = {
      unitId,
      ownerId,
      fencingToken,
      leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      acquiredAt: current?.ownerId === ownerId && !expired ? current.acquiredAt : now.toISOString(),
      updatedAt: now.toISOString(),
    };
    transaction.set(ref, lock);
    return lock;
  });
}

export async function renewMessageSessionLock(
  db: Firestore,
  unitId: string,
  ownerId: string,
  fencingToken: number,
  now = new Date(),
  leaseMs = 60_000,
) {
  const ref = db.collection(MESSAGE_SESSION_LOCK_COLLECTION).doc(unitId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const current = snapshot.data() as MessageSessionLock;
    if (current.ownerId !== ownerId || current.fencingToken !== fencingToken || Date.parse(current.leaseExpiresAt) <= now.getTime()) return false;
    transaction.update(ref, {
      leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      updatedAt: now.toISOString(),
    });
    return true;
  });
}

export async function releaseMessageSessionLock(
  db: Firestore,
  unitId: string,
  ownerId: string,
  fencingToken: number,
) {
  const ref = db.collection(MESSAGE_SESSION_LOCK_COLLECTION).doc(unitId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return true;
    const current = snapshot.data() as MessageSessionLock;
    if (current.ownerId !== ownerId || current.fencingToken !== fencingToken) return false;
    transaction.delete(ref);
    return true;
  });
}

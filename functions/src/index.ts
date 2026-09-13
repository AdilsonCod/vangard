import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { gzipSync } from 'node:zlib';

initializeApp();
const db = getFirestore();
const excluded = new Set(['loginAudit', 'dataAudit', 'auditArchives']);

export const captureDataAudit = onDocumentWrittenWithAuthContext('{collectionId}/{documentId}', async event => {
  const module = event.params.collectionId;
  if (excluded.has(module)) return;
  const before = event.data?.before.exists ? event.data.before.data() : null;
  const after = event.data?.after.exists ? event.data.after.data() : null;
  const action = !before ? 'criação_registro' : !after ? 'exclusao_registro' : 'alteracao_campo';
  const id = crypto.randomUUID();
  const authId = event.authId || 'SYSTEM';
  const profile = authId === 'SYSTEM' ? null : await db.collection('users').doc(authId).get();
  await db.collection('dataAudit').doc(id).create({
    id, userId: authId, userRole: profile?.data()?.role || event.authType || 'SYSTEM', action,
    module, recordId: event.params.documentId, beforeState: before, afterState: after,
    timestamp: new Date().toISOString(), ipAddress: null, userAgent: null,
  });
});

export const archiveAuditWeekly = onSchedule('every sunday 03:00', async () => {
  const years = Math.max(1, Number(process.env.AUDIT_RETENTION_YEARS || 5));
  const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  for (const name of ['loginAudit', 'dataAudit']) {
    const snapshot = await db.collection(name).where('timestamp', '<', cutoff.toISOString()).limit(500).get();
    if (snapshot.empty) continue;
    const archivedAt = new Date().toISOString();
    const archiveId = `${name}-${archivedAt.replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
    const objectPath = `audit-archives/${name}/${archiveId}.ndjson.gz`;
    const payload = snapshot.docs.map(document => JSON.stringify({ id: document.id, ...document.data() })).join('\n');
    await getStorage().bucket().file(objectPath).save(gzipSync(payload), { contentType: 'application/x-ndjson', metadata: { contentEncoding: 'gzip', cacheControl: 'private, max-age=0' } });
    const batch = db.batch();
    batch.create(db.collection('auditArchives').doc(archiveId), { id: archiveId, source: name, archivedAt, objectPath, recordCount: snapshot.size, cutoff: cutoff.toISOString() });
    snapshot.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
  }
});

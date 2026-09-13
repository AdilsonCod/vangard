import type { Request, Response } from 'express';
import { adminDb, verifyFirebaseIdToken } from '../server-firebase-admin.js';

const ipOf = (req: Request) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().slice(0, 64);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const succeeded = req.body?.succeeded === true;
  let userId = String(req.body?.identifier || '').trim().toLowerCase().slice(0, 254);
  let role = 'UNKNOWN';
  if (succeeded) {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const user = await verifyFirebaseIdToken(token);
      userId = user.profileId || user.uid;
      role = user.role || 'UNKNOWN';
    } catch { return res.status(401).json({ error: 'Sessão inválida.' }); }
  }
  const id = crypto.randomUUID();
  await adminDb.collection('loginAudit').doc(id).set({
    id, userId, userRole: role,
    action: succeeded ? 'login_sucesso' : 'login_falha',
    timestamp: new Date().toISOString(), ipAddress: ipOf(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
  });
  return res.status(204).end();
}

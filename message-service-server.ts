import 'dotenv/config';
import express from 'express';
import { configureMessageDispatch, startMessageDispatchConnection } from './message-dispatch-service';
import { createRequireAuth, requireRoles } from './server-auth';
import { verifyFirebaseIdToken } from './server-firebase-admin';

const app = express();
const port = Number(process.env.MESSAGE_SERVICE_PORT || 3001);
const allowedOrigins = new Set((process.env.MESSAGE_ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(value => value.trim()).filter(Boolean));

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403); return; }
  next();
});
app.use(express.json({ limit: '256kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'message-dispatch' }));

const requireAuth = createRequireAuth(verifyFirebaseIdToken);
configureMessageDispatch(app, requireAuth, requireRoles('ADMIN', 'MARKETING', 'RECEPTION'));

app.listen(port, () => {
  console.log(`Serviço persistente de mensagens ativo na porta ${port}.`);
  if (process.env.MESSAGE_AUTO_CONNECT !== 'false') void startMessageDispatchConnection();
});


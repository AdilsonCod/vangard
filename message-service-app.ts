import express from 'express';
import { configureMessageDispatch } from './message-dispatch-service';
import { createRequireAuth, requireRoles } from './server-auth';
import { verifyFirebaseIdToken } from './server-firebase-admin';

export function messageServiceReleaseInfo(env: NodeJS.ProcessEnv = process.env) {
  return {
    version: env.MESSAGE_SERVICE_VERSION?.trim() || env.npm_package_version?.trim() || '0.0.0',
    commit: env.RAILWAY_GIT_COMMIT_SHA?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || env.GIT_COMMIT_SHA?.trim() || 'local',
  };
}

export function createMessageServiceApp() {
  const app = express();
  const allowedOrigins = new Set((process.env.MESSAGE_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(value => value.trim()).filter(Boolean));

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name, X-File-Type, X-Upload-Id, X-Media-Caption, X-Media-Order');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403); return; }
    next();
  });
  app.use('/api/message-dispatch/media/upload', express.raw({ type: 'application/octet-stream', limit: '25mb' }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'message-dispatch', ...messageServiceReleaseInfo() }));

  const requireAuth = createRequireAuth(verifyFirebaseIdToken);
  configureMessageDispatch(app, requireAuth, requireRoles('ADMIN', 'MARKETING', 'RECEPTION'));
  return app;
}

import express from 'express';
import { configureSmartLinks } from '../smart-links-service.js';
import { createRequireAuth, requireRoles } from '../server-auth.js';
import { verifyFirebaseIdToken } from '../server-firebase-admin.js';

const app = express();
app.disable('x-powered-by');

app.use((req, _res, next) => {
  const forwardedPath = req.query.__path;
  if (typeof forwardedPath === 'string' && forwardedPath.length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === '__path') continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        if (typeof item === 'string') params.append(key, item);
      }
    }
    const query = params.toString();
    req.url = `/api/smart-links/${forwardedPath}${query ? `?${query}` : ''}`;
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
configureSmartLinks(app, createRequireAuth(verifyFirebaseIdToken), requireRoles('ADMIN', 'MARKETING', 'RECEPTION'));

export default app;

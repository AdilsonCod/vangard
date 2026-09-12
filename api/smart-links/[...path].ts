import express from 'express';
import { configureSmartLinks } from '../../smart-links-service.js';
import { createRequireAuth, requireRoles } from '../../server-auth.js';
import { verifyFirebaseIdToken } from '../../server-firebase-admin.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
configureSmartLinks(app, createRequireAuth(verifyFirebaseIdToken), requireRoles('ADMIN', 'MARKETING', 'RECEPTION'));

export default app;

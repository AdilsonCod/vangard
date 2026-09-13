import express from 'express';
import { celcoinConfigurationStatus, fetchCelcoinTransactions, testCelcoinConnection } from '../celcoin-service.js';
import { createRequireAuth, requireRoles } from '../server-auth.js';
import { verifyFirebaseIdToken } from '../server-firebase-admin.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const requireAuth = createRequireAuth(verifyFirebaseIdToken);
const requireFinancialAccess = requireRoles('ADMIN', 'FINANCIAL');

app.use(requireAuth, requireFinancialAccess);

app.get('/api/celcoin', async (req, res) => {
  try {
    const action = String(req.query.action || 'status');
    if (action === 'status') {
      res.json(celcoinConfigurationStatus());
      return;
    }
    if (action === 'transactions') {
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const limit = Number(req.query.limit) || 100;
      res.json(await fetchCelcoinTransactions({ from, to, limit }));
      return;
    }
    res.status(400).json({ error: 'Ação Celcoin inválida.' });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao consultar a Celcoin.' });
  }
});

app.post('/api/celcoin', async (req, res) => {
  try {
    if (req.query.action !== 'test') {
      res.status(400).json({ error: 'Ação Celcoin inválida.' });
      return;
    }
    res.json({ ...(await testCelcoinConnection()), connected: true });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao conectar à Celcoin.' });
  }
});

export default app;

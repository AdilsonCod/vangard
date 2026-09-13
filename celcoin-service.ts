const SANDBOX_URL = 'https://api.sandbox.cel.cash/v2';
const PRODUCTION_URL = 'https://api-celcash.celcoin.com.br/v2';

export type CelcoinEnvironment = 'sandbox' | 'production';

export type CelcoinReportItem = {
  id: string;
  externalId: string;
  amount: number;
  dueDate: string;
  settledAt?: string;
  createdAt?: string;
  status: string;
  statusDescription: string;
  paymentMethod: string;
  customerName?: string;
  installment?: number;
  source: 'CELCOIN';
};

type CelcoinConfig = { id: string; hash: string; environment: CelcoinEnvironment; baseUrl: string };
type TokenEntry = { value: string; expiresAt: number };
const cachedTokens = new Map<string, TokenEntry>();

export type CelcoinCredentials = { id?: string; hash?: string; environment?: CelcoinEnvironment };

function config(override?: CelcoinCredentials): CelcoinConfig {
  const suppliedId = typeof override?.id === 'string' ? override.id.trim().slice(0, 64) : '';
  const suppliedHash = typeof override?.hash === 'string' ? override.hash.trim().slice(0, 256) : '';
  const id = suppliedId || process.env.CELCOIN_GALAX_ID?.trim() || '';
  const hash = suppliedHash || process.env.CELCOIN_GALAX_HASH?.trim() || '';
  const environment = override?.environment === 'sandbox' || override?.environment === 'production'
    ? override.environment
    : process.env.CELCOIN_ENVIRONMENT?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
  const baseUrl = (process.env.CELCOIN_API_URL?.trim() || (environment === 'sandbox' ? SANDBOX_URL : PRODUCTION_URL)).replace(/\/$/, '');
  return { id, hash, environment, baseUrl };
}

export function celcoinConfigurationStatus() {
  const current = config();
  return {
    configured: Boolean(current.id && current.hash),
    environment: current.environment,
    account: current.id ? `••••${current.id.slice(-4)}` : undefined,
  };
}

async function responseJson(response: Response) {
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const remoteMessage = typeof payload?.message === 'string' ? payload.message : undefined;
    throw new Error(remoteMessage || `Celcoin respondeu com HTTP ${response.status}.`);
  }
  return payload;
}

async function accessToken(fetcher: typeof fetch = fetch, credentials?: CelcoinCredentials) {
  const current = config(credentials);
  const cacheKey = `${current.environment}:${current.id}:${current.hash}`;
  const cachedToken = cachedTokens.get(cacheKey);
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  if (!current.id || !current.hash) throw new Error('Credenciais Celcoin não configuradas no servidor.');
  const basic = Buffer.from(`${current.id}:${current.hash}`, 'utf8').toString('base64');
  const response = await fetcher(`${current.baseUrl}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', scope: 'transactions.read' }),
  });
  const payload = await responseJson(response);
  const token = typeof payload?.access_token === 'string' ? payload.access_token : '';
  if (!token) throw new Error('A Celcoin não retornou um token de acesso.');
  const expiresIn = Number(payload?.expires_in) || 600;
  cachedTokens.set(cacheKey, { value: token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

export async function testCelcoinConnection(fetcher: typeof fetch = fetch, credentials?: CelcoinCredentials) {
  await accessToken(fetcher, credentials);
  const current = config(credentials);
  return { configured: true, environment: current.environment, account: `••••${current.id.slice(-4)}` };
}

const text = (value: unknown) => typeof value === 'string' ? value : '';
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};

export function normalizeCelcoinTransaction(value: unknown): CelcoinReportItem | null {
  const item = record(value);
  const externalId = String(item.galaxPayId ?? item.myId ?? '').trim();
  if (!externalId) return null;
  const subscription = record(item.Subscription);
  const customer = record(subscription.Customer);
  const paymentMethod = item.Pix ? 'PIX' : item.Boleto ? 'BOLETO' : item.Card ? 'CARTÃO' : text(subscription.mainPaymentMethodId).toUpperCase() || 'OUTRO';
  return {
    id: `celcoin_${externalId}`,
    externalId,
    amount: Math.round(Number(item.value) || 0) / 100,
    dueDate: text(item.payday).slice(0, 10),
    settledAt: text(item.paydayDate).slice(0, 10) || undefined,
    createdAt: text(item.createdAt) || undefined,
    status: text(item.status) || 'unknown',
    statusDescription: text(item.statusDescription) || text(item.status) || 'Status não informado',
    paymentMethod,
    customerName: text(customer.name) || text(customer.tradeName) || undefined,
    installment: Number(item.installment) || undefined,
    source: 'CELCOIN',
  };
}

export async function fetchCelcoinTransactions(options: { from?: string; to?: string; limit?: number }, fetcher: typeof fetch = fetch, credentials?: CelcoinCredentials) {
  const current = config(credentials);
  const token = await accessToken(fetcher, credentials);
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  const response = await fetcher(`${current.baseUrl}/transactions?limit=${limit}&startAt=0`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const payload = await responseJson(response);
  const raw = Array.isArray(payload) ? payload : Array.isArray(payload?.Transactions) ? payload.Transactions : [];
  const transactions = raw.map(normalizeCelcoinTransaction).filter((item): item is CelcoinReportItem => Boolean(item));
  const filtered = transactions.filter(item => (!options.from || item.dueDate >= options.from) && (!options.to || item.dueDate <= options.to));
  const today = new Date().toISOString().slice(0, 10);
  const terminal = /paid|payed|captured|cancel|revers|refund|baixad|liquid/i;
  return {
    transactions: filtered,
    receivables: filtered.filter(item => item.dueDate >= today && !item.settledAt && !terminal.test(`${item.status} ${item.statusDescription}`)),
    total: filtered.length,
    fetchedAt: new Date().toISOString(),
  };
}

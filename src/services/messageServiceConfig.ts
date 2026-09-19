export const DEFAULT_PRODUCTION_MESSAGE_SERVICE_URL = 'https://vangard-messages-production.up.railway.app';

export function resolveMessageServiceUrl(configuredUrl: unknown, isDevelopment: boolean) {
  const configured = String(configuredUrl || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return isDevelopment ? 'http://127.0.0.1:3101' : DEFAULT_PRODUCTION_MESSAGE_SERVICE_URL;
}

export function messageReconnectDelay(attempt: number) {
  return Math.min(15_000, 2_000 * (2 ** Math.min(3, Math.max(0, attempt))));
}

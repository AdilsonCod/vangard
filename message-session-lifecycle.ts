export function messageQrExpiresAt(now = new Date(), ttlMs = 60_000) { return new Date(now.getTime() + ttlMs).toISOString(); }
export function messageQrIsExpired(expiresAt: string | null, now = new Date()) { return !expiresAt || new Date(expiresAt).getTime() <= now.getTime(); }
export function messageDisconnectReason(error: unknown, code?: number) { return error instanceof Error && error.message ? error.message : code ? `Conexão encerrada pelo WhatsApp (código ${code}).` : 'Conexão encerrada sem motivo informado.'; }

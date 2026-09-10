import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type ApiRole = 'ADMIN' | 'FINANCIAL' | 'MARKETING' | 'RECEPTION' | 'BARBER' | 'MANICURE';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export type VerifyFirebaseToken = (token: string) => Promise<VerifiedFirebaseUser>;

export interface AuthenticatedRequest extends Request {
  firebaseUser?: VerifiedFirebaseUser;
}

export function createRequireAuth(verifyToken: VerifyFirebaseToken): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const match = authHeader?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]?.trim()) {
      res.status(401).json({ error: 'Token de autenticação não fornecido.' });
      return;
    }

    verifyToken(match[1].trim())
      .then(decoded => {
        (req as AuthenticatedRequest).firebaseUser = decoded;
        next();
      })
      .catch(() => {
        res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
      });
  };
}

export function requireRoles(...allowedRoles: ApiRole[]): RequestHandler {
  const allowed = new Set<string>(allowedRoles);
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).firebaseUser;
    if (!user) {
      res.status(401).json({ error: 'Autenticação necessária para acessar este recurso.' });
      return;
    }

    const role = typeof user.role === 'string' ? user.role.toUpperCase() : '';
    if (!allowed.has(role)) {
      res.status(403).json({ error: 'Seu perfil não possui permissão para esta operação.' });
      return;
    }

    next();
  };
}

export function authenticatedUser(req: Request): VerifiedFirebaseUser | undefined {
  return (req as AuthenticatedRequest).firebaseUser;
}

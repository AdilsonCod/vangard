import { signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';

type TokenUser = Pick<FirebaseUser, 'getIdToken'>;
type ApiClientDependencies = {
  currentUser: () => TokenUser | null;
  logout: () => Promise<unknown>;
  fetcher?: typeof fetch;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function errorMessage(response: Response) {
  const payload = await response.clone().json().catch(() => null) as { error?: unknown } | null;
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
  if (response.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (response.status === 403) return 'Seu perfil não possui permissão para esta operação.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

export function createAuthenticatedApiClient(dependencies: ApiClientDependencies) {
  const fetcher = dependencies.fetcher || fetch;

  const request = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const user = dependencies.currentUser();
    if (!user) throw new ApiError('Sua sessão expirou. Entre novamente para continuar.', 401);

    const execute = async (forceRefresh: boolean) => {
      const token = await user.getIdToken(forceRefresh);
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetcher(input, { ...init, headers });
    };

    let response = await execute(false);
    if (response.status === 401) response = await execute(true);
    if (response.status === 401) await dependencies.logout().catch(() => undefined);
    if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
    return response;
  };

  const json = async <T>(input: RequestInfo | URL, init: RequestInit = {}) => {
    const response = await request(input, init);
    return response.json() as Promise<T>;
  };

  return { request, json };
}

export const authenticatedApi = createAuthenticatedApiClient({
  currentUser: () => auth.currentUser,
  logout: () => signOut(auth),
});

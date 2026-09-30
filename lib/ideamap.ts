import { createHash, randomBytes } from 'crypto';
import { prisma } from './prisma';
import { open } from './secretBox';

// IdeaMap (Idealo) client. TaskTimmer connects through IdeaMap's consent screen (authorization
// code + PKCE) and then calls IdeaMap's /integrations/tasktimmer/* endpoints server to server.
export const IDEAMAP_API_URL = (process.env.IDEAMAP_API_URL || 'https://apiideapanel.idealo.com.ve/api-map').replace(/\/$/, '');
export const IDEAMAP_WEB_URL = (process.env.IDEAMAP_WEB_URL || 'https://idealo.com.ve/idea-map').replace(/\/$/, '');
export const OAUTH_COOKIE = 'tt_ideamap_oauth';
export const TASK_STATUSES = ['backlog', 'selected', 'inprogress', 'done'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export interface IdeaMapTask {
  id: number; title: string; type: string; status: TaskStatus; priority: string;
  startDate: string | null; dueDate: string | null; completedAt: string | null; description: string | null;
  project: { id: number; key: string; name: string }; url: string; canUpdate: boolean; updatedAt: string | null;
}

/** Must be listed, byte for byte, in IdeaMap's TASKTIMMER_REDIRECT_URIS. */
export function callbackUrl(req: Request) {
  const origin = (process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(/\/$/, '');
  return origin + '/api/integrations/ideamap/callback';
}

export function pkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export class IdeaMapError extends Error {
  constructor(message: string, public status: number, public disconnected = false) { super(message); }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(IDEAMAP_API_URL + path, {
      ...rest,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }
    });
  } catch {
    throw new IdeaMapError('IdeaMap is not responding. Try again in a moment.', 503);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new IdeaMapError(body?.error?.message || body?.message || 'IdeaMap request failed.', response.status);
  return body as T;
}

export function exchangeCode(code: string, verifier: string, redirectUri: string) {
  return call<{ accessToken: string; user: { id: number; name: string; email: string } }>('/integrations/tasktimmer/token', {
    method: 'POST', body: JSON.stringify({ code, codeVerifier: verifier, redirectUri })
  });
}

/**
 * Calls IdeaMap as the connected user. A 401 means the connection was revoked on IdeaMap's side,
 * so the stored link is dropped and the UI offers to reconnect.
 */
export async function asUser<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const connection = await prisma.ideaMapConnection.findUnique({ where: { userId } });
  const token = open(connection?.accessToken);
  if (!connection || !token) throw new IdeaMapError('IdeaMap is not connected.', 409, true);
  try {
    const result = await call<T>(path, { ...init, token });
    if (!connection.lastUsedAt || Date.now() - connection.lastUsedAt.getTime() > 60000) {
      await prisma.ideaMapConnection.update({ where: { userId }, data: { lastUsedAt: new Date() } });
    }
    return result;
  } catch (error) {
    if (error instanceof IdeaMapError && error.status === 401) {
      await prisma.ideaMapConnection.deleteMany({ where: { userId } });
      throw new IdeaMapError('The IdeaMap connection was revoked. Connect it again.', 409, true);
    }
    throw error;
  }
}

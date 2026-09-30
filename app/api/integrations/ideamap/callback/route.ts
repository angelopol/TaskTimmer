import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '../../../../../lib/prisma';
import { sessionUserId } from '../../../../../lib/sessionUser';
import { callbackUrl, exchangeCode, IdeaMapError, OAUTH_COOKIE } from '../../../../../lib/ideamap';
import { open, seal } from '../../../../../lib/secretBox';

export const dynamic = 'force-dynamic';

/** IdeaMap sends the user back here with ?code&state (or ?error=access_denied). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const done = (result: string) => {
    const response = NextResponse.redirect(new URL('/schedule?ideamap=' + result, req.url));
    response.cookies.set(OAUTH_COOKIE, '', { path: '/api/integrations/ideamap', maxAge: 0 });
    return response;
  };
  const userId = await sessionUserId();
  let pending: { state?: string; verifier?: string; userId?: string } = {};
  try { pending = JSON.parse(open(cookies().get(OAUTH_COOKIE)?.value) || '{}'); } catch {}

  // The state must match what this browser started, for the same TaskTimmer user.
  if (!userId || !pending.state || pending.state !== url.searchParams.get('state') || pending.userId !== userId || !pending.verifier) return done('error');
  if (url.searchParams.get('error')) return done('denied');
  const code = url.searchParams.get('code');
  if (!code) return done('error');

  try {
    const { accessToken, user } = await exchangeCode(code, pending.verifier, callbackUrl(req));
    const data = { accessToken: seal(accessToken), ideamapUserName: user.name, ideamapEmail: user.email, lastUsedAt: null };
    await prisma.ideaMapConnection.upsert({ where: { userId }, create: { userId, ...data }, update: { ...data, createdAt: new Date() } });
    return done('connected');
  } catch (error) {
    console.error('[ideamap] code exchange failed:', error instanceof IdeaMapError ? error.message : error);
    return done('error');
  }
}

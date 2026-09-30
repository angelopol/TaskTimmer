import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sessionUserId } from '../../../../../lib/sessionUser';
import { callbackUrl, IDEAMAP_WEB_URL, OAUTH_COOKIE, pkcePair } from '../../../../../lib/ideamap';
import { seal } from '../../../../../lib/secretBox';

export const dynamic = 'force-dynamic';

/** Starts the IdeaMap consent flow: remembers state + PKCE verifier in a sealed cookie and redirects. */
export async function GET(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.redirect(new URL('/login', req.url));
  const state = randomBytes(24).toString('base64url');
  const { verifier, challenge } = pkcePair();
  const target = new URL(IDEAMAP_WEB_URL + '/connect/tasktimmer');
  target.search = new URLSearchParams({ redirect_uri: callbackUrl(req), state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  const response = NextResponse.redirect(target);
  response.cookies.set(OAUTH_COOKIE, seal(JSON.stringify({ state, verifier, userId })), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/integrations/ideamap', maxAge: 600
  });
  return response;
}

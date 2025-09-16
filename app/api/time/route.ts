import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: Request) {
  const now = new Date();
  const epochMs = Date.now();
  const tzOffsetMin = now.getTimezoneOffset();
  const region = process.env.VERCEL_REGION || null;
  const envNextAuthUrl = process.env.NEXTAUTH_URL || null;

  let tokenSummary: any = { hasToken: false };
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      tokenSummary = {
        hasToken: true,
        userId: (token as any).userId ?? null,
        remember: (token as any).remember ?? null,
        expTs: (token as any).expTs ?? null,
        expiresInMs: (token as any).expTs ? ((token as any).expTs - epochMs) : null
      };
    }
  } catch (e: any) {
    tokenSummary = { hasToken: false, error: e?.message || 'token_decode_error' };
  }

  return NextResponse.json({
    serverNowIso: now.toISOString(),
    serverEpochMs: epochMs,
    tzOffsetMinutes: tzOffsetMin,
    vercelRegion: region,
    nextAuthUrlEnv: envNextAuthUrl,
    token: tokenSummary
  });
}

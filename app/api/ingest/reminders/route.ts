import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { bearerFrom, verifyToken } from '../../../../lib/integrationTokens';
import { clientIp, isLimited, rateLimit } from '../../../../lib/rateLimit';
import { parseReminders } from '../../../../lib/reminderPayload';

// Public endpoint for the iOS Shortcut (exempted from the session middleware).
// Auth: `Authorization: Bearer XXXX-XXXX-XXXX-XXXX`. Each POST replaces the user's reminder snapshot.
export const dynamic = 'force-dynamic';
const MAX_BODY = 1_000_000;
const WINDOW = 10 * 60 * 1000;

async function authenticate(req: Request) {
  const ip = clientIp(req);
  if (isLimited('ingest-fail:' + ip, 10)) return { error: tooMany(600) };
  const limit = rateLimit('ingest:' + ip, 30, WINDOW);
  if (!limit.ok) return { error: tooMany(limit.retryAfter) };
  const userId = await verifyToken(bearerFrom(req));
  if (!userId) {
    rateLimit('ingest-fail:' + ip, 10, 60 * 60 * 1000);
    return { error: NextResponse.json({ ok: false, error: 'Invalid or revoked token.' }, { status: 401 }) };
  }
  return { userId };
}

function tooMany(retryAfter: number) {
  return NextResponse.json({ ok: false, error: 'Too many requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

/** Connection test from the Shortcut or curl. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth.error) return auth.error;
  const count = await prisma.externalReminder.count({ where: { userId: auth.userId } });
  return NextResponse.json({ ok: true, message: 'Token valid.', stored: count });
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth.error) return auth.error;
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'Payload too large.' }, { status: 413 });
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* text/plain bodies are parsed as NDJSON / concatenated objects */ }
  const { reminders, received, skipped } = parseReminders(body);
  if (received > 0 && reminders.length === 0) {
    return NextResponse.json({ ok: false, error: 'No reminders could be read. Check the dictionary keys (title, due, list, completed).' }, { status: 422 });
  }
  const syncedAt = new Date();
  await prisma.$transaction([
    prisma.externalReminder.deleteMany({ where: { userId: auth.userId, source: 'apple' } }),
    prisma.externalReminder.createMany({ data: reminders.map(r => ({ ...r, userId: auth.userId, source: 'apple', syncedAt })) })
  ]);
  return NextResponse.json({
    ok: true,
    message: `Synced ${reminders.length} reminder${reminders.length === 1 ? '' : 's'}.`,
    stored: reminders.length, skipped, syncedAt: syncedAt.toISOString()
  });
}

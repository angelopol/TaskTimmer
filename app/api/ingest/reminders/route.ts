import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { bearerFrom, REMINDERS_KIND, verifyToken } from '../../../../lib/integrationTokens';
import { clientIp, isLimited, rateLimit } from '../../../../lib/rateLimit';
import { parseReminders } from '../../../../lib/reminderPayload';

// Public endpoint for the iOS Shortcut (exempted from the session middleware).
// Auth: `Authorization: Bearer XXXX-XXXX-XXXX-XXXX`. Each POST carries all pending reminders; see POST for the dedupe rules.
// The response's `complete` list is how reminders completed in TaskTimmer reach the iPhone.
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
  const userId = auth.userId;
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: 'Payload too large.' }, { status: 413 });
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* text/plain bodies are parsed as NDJSON / concatenated objects */ }
  const { reminders, received, unreadable, completed, duplicates } = parseReminders(body);
  if (received > 0 && unreadable === received) {
    return NextResponse.json({ ok: false, error: 'No reminders could be read. Check the dictionary keys (title, due, list).' }, { status: 422 });
  }

  // The upload is the full list of pending reminders: create unseen ones, update changed ones,
  // and drop stored ones that were not sent (completed or deleted on the iPhone).
  const syncedAt = new Date();
  const existing = await prisma.externalReminder.findMany({ where: { userId, source: 'apple' } });
  const stored = new Map(existing.map(r => [r.externalKey, r]));
  const incoming = new Set(reminders.map(r => r.externalKey));
  const toCreate = reminders.filter(r => !stored.has(r.externalKey));
  const toUpdate = reminders.filter(r => {
    const old = stored.get(r.externalKey);
    return old && (old.title !== r.title || old.notes !== r.notes || old.list !== r.list || old.allDay !== r.allDay
      || old.flagged !== r.flagged || old.priority !== r.priority || old.dueAt?.getTime() !== r.dueAt?.getTime());
  });
  const toRemove = existing.filter(r => !incoming.has(r.externalKey)).map(r => r.id);
  // Completed in TaskTimmer but still pending on the iPhone: ask the Shortcut to complete them.
  // They are offered again on every sync until they disappear from the upload, so a failed run retries itself.
  const toComplete = existing.filter(r => r.completionRequestedAt && incoming.has(r.externalKey));
  await prisma.$transaction([
    prisma.externalReminder.deleteMany({ where: { id: { in: toRemove } } }),
    prisma.externalReminder.createMany({ data: toCreate.map(r => ({ ...r, userId, source: 'apple', syncedAt })), skipDuplicates: true }),
    ...toUpdate.map(r => prisma.externalReminder.update({ where: { userId_externalKey: { userId, externalKey: r.externalKey } }, data: { ...r, syncedAt } })),
    prisma.externalReminder.updateMany({ where: { userId, source: 'apple' }, data: { syncedAt } }),
    prisma.externalReminder.updateMany({ where: { id: { in: toComplete.map(r => r.id) } }, data: { completionSentAt: syncedAt } }),
    prisma.integrationToken.updateMany({ where: { userId, kind: REMINDERS_KIND }, data: { lastSyncAt: syncedAt } })
  ]);
  const unchanged = reminders.length - toCreate.length - toUpdate.length;
  return NextResponse.json({
    ok: true,
    message: `Synced ${reminders.length} pending: ${toCreate.length} new, ${toUpdate.length} updated, ${toRemove.length} removed` +
      (toComplete.length ? `, ${toComplete.length} to complete on this iPhone.` : '.'),
    // For the Shortcut's second loop: find each one by title + list and mark it completed.
    complete: toComplete.map(r => ({ title: r.title, list: r.list ?? '' })),
    pending: reminders.length, created: toCreate.length, updated: toUpdate.length, unchanged, removed: toRemove.length,
    duplicates, ignoredCompleted: completed, unreadable, syncedAt: syncedAt.toISOString()
  });
}

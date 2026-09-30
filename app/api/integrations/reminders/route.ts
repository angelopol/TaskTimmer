import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';
import { issueToken, REMINDERS_KIND } from '../../../../lib/integrationTokens';

export const dynamic = 'force-dynamic';

async function sessionUser() {
  const session = await getServerSession(authOptions as any);
  return ((session as any)?.userId as string | undefined) || null;
}

/** Connection status for the settings dialog. Never returns the token itself. */
export async function GET() {
  const userId = await sessionUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [token, count] = await Promise.all([
    prisma.integrationToken.findUnique({ where: { userId_kind: { userId, kind: REMINDERS_KIND } } }),
    prisma.externalReminder.count({ where: { userId } })
  ]);
  return NextResponse.json({
    connected: !!token,
    prefix: token?.prefix ?? null,
    createdAt: token?.createdAt ?? null,
    lastUsedAt: token?.lastUsedAt ?? null,
    lastSyncedAt: token?.lastSyncAt ?? null,
    stored: count
  });
}

/** Creates a new token (replacing any previous one). The plain token is returned only here. */
export async function POST() {
  const userId = await sessionUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = await issueToken(userId, REMINDERS_KIND);
  return NextResponse.json({ token });
}

/** Disconnects: revokes the token and removes the synced reminders. */
export async function DELETE() {
  const userId = await sessionUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.$transaction([
    prisma.integrationToken.deleteMany({ where: { userId, kind: REMINDERS_KIND } }),
    prisma.externalReminder.deleteMany({ where: { userId, source: 'apple' } })
  ]);
  return NextResponse.json({ ok: true });
}

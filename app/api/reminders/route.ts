import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Read-only pending reminders due in [from, to), plus the ones without a due date. The client
 * sends the instants for its local week so the server never has to guess the user's time zone.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  const userId = (session as any)?.userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get('from') || '');
  const to = new Date(url.searchParams.get('to') || '');
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 45 * 86400000) {
    return NextResponse.json({ error: 'Provide a valid from/to range (max 45 days).' }, { status: 400 });
  }
  // Date-only reminders are stored at 12:00 UTC; widen by 14h so they are not lost at the edges.
  const pad = 14 * 3600000;
  const select = { id: true, title: true, notes: true, list: true, dueAt: true, allDay: true, completed: true, flagged: true, priority: true };
  const [reminders, undated, token] = await Promise.all([
    prisma.externalReminder.findMany({
      where: { userId, dueAt: { gte: new Date(from.getTime() - pad), lt: new Date(to.getTime() + pad) } },
      orderBy: [{ dueAt: 'asc' }, { title: 'asc' }], select
    }),
    prisma.externalReminder.findMany({ where: { userId, dueAt: null }, orderBy: [{ priority: 'desc' }, { title: 'asc' }], take: 200, select }),
    prisma.integrationToken.findFirst({ where: { userId }, select: { lastSyncAt: true } })
  ]);
  return NextResponse.json({ reminders, undated, lastSyncedAt: token?.lastSyncAt ?? null });
}

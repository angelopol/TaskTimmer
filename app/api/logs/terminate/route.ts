import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Find current active log
  const active = await (prisma.timeLog as any).findFirst({ where: { userId, endedAt: { equals: null } }, orderBy: { startedAt: 'desc' } });
  if (!active) return NextResponse.json({ error: 'No active activity' }, { status: 409 });

  const now = new Date();
  const started = new Date(active.startedAt);
  if (now.getTime() <= started.getTime()) return NextResponse.json({ error: 'Invalid time' }, { status: 422 });
  const minutes = Math.max(1, Math.round((now.getTime() - started.getTime())/60000));

  const updated = await (prisma.timeLog as any).update({
    where: { id: active.id },
    data: { endedAt: now, minutes },
    include: { activity: { select: { id: true, name: true, color: true } } }
  });
  return NextResponse.json({ log: updated });
}

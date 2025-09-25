import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Using equals: null for forward-compat; cast to any to tolerate local types before prisma generate
  const log = await (prisma.timeLog as any).findFirst({
    where: { userId, endedAt: { equals: null } },
    orderBy: { startedAt: 'desc' },
    include: { activity: { select: { id: true, name: true, color: true } } }
  });
  if (!log) return NextResponse.json({ active: null });
  const now = new Date();
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - new Date(log.startedAt).getTime()) / 60000));
  return NextResponse.json({ active: { id: log.id, activity: (log as any).activity, startedAt: log.startedAt, elapsedMinutes } });
}

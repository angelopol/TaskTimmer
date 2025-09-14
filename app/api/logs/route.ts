import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { activityId, segmentId, date, startedAt, endedAt, minutes, partial, source, comment } = await req.json();
  const log = await prisma.timeLog.create({ data: { userId, activityId, segmentId, date: new Date(date), startedAt: new Date(startedAt), endedAt: new Date(endedAt), minutes, partial: !!partial, source, comment } });
  return NextResponse.json({ log });
}

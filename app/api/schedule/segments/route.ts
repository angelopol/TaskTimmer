import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const segments = await prisma.scheduleSegment.findMany({ where: { userId }, include: { activity: true } });
  return NextResponse.json({ segments });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { weekday, startMinute, endMinute, activityId, notes } = await req.json();
  const segment = await prisma.scheduleSegment.create({ data: { weekday, startMinute, endMinute, activityId: activityId || null, userId, notes } });
  return NextResponse.json({ segment });
}

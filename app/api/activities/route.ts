import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';

export async function GET() {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const activities = await prisma.activity.findMany({ where: { userId } });
  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { name, color, weeklyTargetMinutes } = await req.json();
  const activity = await prisma.activity.create({ data: { name, color, weeklyTargetMinutes: weeklyTargetMinutes || 0, userId } });
  return NextResponse.json({ activity });
}

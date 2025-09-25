import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  activityId: z.string().cuid().nullable().optional(),
  comment: z.string().max(300).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let payload: any; try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { activityId, comment } = parsed.data;

  // Enforce single active log per user
  const existing = await (prisma.timeLog as any).findFirst({ where: { userId, endedAt: { equals: null } } });
  if (existing) return NextResponse.json({ error: 'There is already an active activity' }, { status: 409 });

  if (activityId) {
    const act = await prisma.activity.findFirst({ where: { id: activityId, userId } });
    if (!act) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  const now = new Date();
  const dateLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const log = await (prisma.timeLog as any).create({ data: {
    userId,
    activityId: activityId || null,
    segmentId: null,
    date: dateLocal,
    startedAt: now,
    endedAt: null,
    minutes: 0,
    partial: false,
    source: 'ADHOC',
    comment: comment || null,
  }, include: { activity: { select: { id: true, name: true, color: true } } } });

  return NextResponse.json({ log });
}

import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { z } from 'zod';

const baseObject = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(24*60-1),
  endMinute: z.number().int().min(1).max(24*60).refine((v)=>v>0),
  activityId: z.string().cuid().nullable().optional(),
  notes: z.string().max(200).optional().nullable()
});

const createSchema = baseObject.refine(d => d.endMinute > d.startMinute, { message: 'endMinute must be greater than startMinute', path: ['endMinute'] });
const updateSchema = baseObject.partial().refine(d => !d.endMinute || !d.startMinute || d.endMinute > d.startMinute, { message: 'endMinute must be greater than startMinute', path: ['endMinute'] });

async function checkOverlap(userId: string, weekday: number, startMinute: number, endMinute: number, ignoreId?: string) {
  const overlapping = await prisma.scheduleSegment.findFirst({
    where: {
      userId,
      weekday,
      NOT: ignoreId ? { id: ignoreId } : undefined,
      OR: [
        { AND: [ { startMinute: { lte: startMinute } }, { endMinute: { gt: startMinute } } ] },
        { AND: [ { startMinute: { lt: endMinute } }, { endMinute: { gte: endMinute } } ] },
        { AND: [ { startMinute: { gte: startMinute } }, { endMinute: { lte: endMinute } } ] }
      ]
    }
  });
  return overlapping;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const segment = await prisma.scheduleSegment.findFirst({ where: { id, userId }, include: { activity: true } });
    if (!segment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ segment });
  }
  const weekday = searchParams.get('weekday');
  const where: any = { userId };
  if (weekday) where.weekday = Number(weekday);
  const segments = await prisma.scheduleSegment.findMany({ where, include: { activity: true }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
  return NextResponse.json({ segments });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  let raw; try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { weekday, startMinute, endMinute, activityId, notes } = parsed.data;
  const over = await checkOverlap(userId, weekday, startMinute, endMinute);
  if (over) return NextResponse.json({ error: 'Overlap with existing segment', overlapId: over.id }, { status: 409 });
  const segment = await prisma.scheduleSegment.create({ data: { userId, weekday, startMinute, endMinute, activityId: activityId || null, notes: notes || null } });
  return NextResponse.json({ segment }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id ?id=' }, { status: 400 });
  const existing = await prisma.scheduleSegment.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let raw; try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;
  const weekday = data.weekday ?? existing.weekday;
  const startMinute = data.startMinute ?? existing.startMinute;
  const endMinute = data.endMinute ?? existing.endMinute;
  const over = await checkOverlap(userId, weekday, startMinute, endMinute, id);
  if (over) return NextResponse.json({ error: 'Overlap with existing segment', overlapId: over.id }, { status: 409 });
  const updated = await prisma.scheduleSegment.update({ where: { id }, data: { ...data } });
  return NextResponse.json({ segment: updated });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing = await prisma.scheduleSegment.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.scheduleSegment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

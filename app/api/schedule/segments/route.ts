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

// Helper: produce YYYY-MM-DD string
function formatDateYMD(d: Date){
  const y = d.getFullYear();
  const m = (d.getMonth()+1).toString().padStart(2,'0');
  const day = d.getDate().toString().padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// Compute next Monday (week start) strictly after today
function computeNextMonday(base: Date = new Date()){ // base assumed now
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const jsDay = d.getDay(); // 0=Sun .. 6=Sat
  // days until next Monday (jsDay 1) strictly after today
  const daysUntil = ((8 - jsDay) % 7) || 7; // if today Monday -> 7 days
  d.setDate(d.getDate() + daysUntil);
  // normalize to midnight
  d.setHours(0,0,0,0);
  return d;
}

function isMonday(d: Date){
  return d.getDay() === 1; // Monday
}

// Only consider CURRENT template segments (effectiveTo == null) when checking overlap
async function checkOverlap(userId: string, weekday: number, startMinute: number, endMinute: number, ignoreId?: string) {
  return prisma.scheduleSegment.findFirst({
    where: {
      userId,
      weekday,
      effectiveTo: null,
      NOT: ignoreId ? { id: ignoreId } : undefined,
      OR: [
        { AND: [ { startMinute: { lte: startMinute } }, { endMinute: { gt: startMinute } } ] },
        { AND: [ { startMinute: { lt: endMinute } }, { endMinute: { gte: endMinute } } ] },
        { AND: [ { startMinute: { gte: startMinute } }, { endMinute: { lte: endMinute } } ] }
      ]
    }
  });
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
  const weekStart = searchParams.get('weekStart'); // ISO date (Monday) for historical snapshot
  const historical = searchParams.get('historical') === '1' || searchParams.get('mode') === 'historical';
  const modeAll = searchParams.get('mode') === 'all';

  // Base filter always by user
  const where: any = { userId };
  if (weekday) where.weekday = Number(weekday);

  if (historical && weekStart) {
    // Interpret snapshot as of the Monday (weekStart). We want the version that was active ON that date.
    // A segment version is considered active for the week if effectiveFrom <= weekStart AND (effectiveTo IS NULL OR effectiveTo >= weekStart)
    // This gives a stable snapshot for that week (assumes versions change aligned to Mondays).
    const wsDate = new Date(weekStart + 'T00:00:00');
    if (isNaN(wsDate.getTime())) {
      return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
    }
    where.effectiveFrom = { lte: wsDate };
    where.OR = [
      { effectiveTo: null },
      { effectiveTo: { gte: wsDate } }
    ];
  } else if (modeAll) {
    // Return active (today in range) + future (effectiveFrom > today) segments, exclude fully historical
    const today = new Date(); today.setHours(0,0,0,0);
    where.OR = [
      { AND: [
        { effectiveFrom: { lte: today } },
        { OR: [ { effectiveTo: null }, { effectiveTo: { gte: today } } ] }
      ]},
      { effectiveFrom: { gt: today } }
    ];
  } else {
    // Current template => only open-ended segments (effectiveTo null)
    where.effectiveTo = null;
  }

  const segments = await prisma.scheduleSegment.findMany({
    where,
    include: { activity: true },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }]
  });
  return NextResponse.json({ segments, snapshot: historical ? weekStart : null, mode: historical ? 'historical' : (modeAll ? 'all' : 'current') });
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
  // New segments are part of CURRENT template (effectiveTo null, effectiveFrom defaults to now via DB default)
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
  const { versioningMode, effectiveFromDate } = raw as any; // optional additional fields
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;

  const mode: 'now' | 'next-week' | 'custom-week' = (versioningMode === 'next-week' || versioningMode === 'custom-week') ? versioningMode : 'now';

  // Shared new values for overlap check
  const weekday = data.weekday ?? existing.weekday;
  const startMinute = data.startMinute ?? existing.startMinute;
  const endMinute = data.endMinute ?? existing.endMinute;

  // Overlap check is always against *current* open-ended segments (excluding this one) because all of them will carry forward.
  const over = await checkOverlap(userId, weekday, startMinute, endMinute, id);
  if (over) return NextResponse.json({ error: 'Overlap with existing segment', overlapId: over.id }, { status: 409 });

  // Guard: versioning only allowed on open-ended segment
  if (mode !== 'now' && existing.effectiveTo) {
    return NextResponse.json({ error: 'Cannot version a historical (closed) segment' }, { status: 400 });
  }

  if (mode === 'now') {
    // Mutate in place (no history of prior version). Optionally could create a new version aligned to next week, but spec keeps simple.
    const updated = await prisma.scheduleSegment.update({ where: { id }, data: { ...data } });
    return NextResponse.json({ segment: updated, mode: 'now' });
  }

  // Determine new effectiveFrom (must be Monday) for future version
  let newEffectiveFrom: Date;
  if (mode === 'next-week') {
    newEffectiveFrom = computeNextMonday();
  } else { // custom-week
    if (typeof effectiveFromDate !== 'string') {
      return NextResponse.json({ error: 'effectiveFromDate required for custom-week' }, { status: 400 });
    }
    const parsedDate = new Date(effectiveFromDate + 'T00:00:00');
    if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: 'Invalid effectiveFromDate' }, { status: 400 });
    if (!isMonday(parsedDate)) return NextResponse.json({ error: 'effectiveFromDate must be a Monday' }, { status: 400 });
    // Must be >= next Monday (cannot retroactively create version or split current week mid-way)
    const nextMon = computeNextMonday();
    if (parsedDate < nextMon) return NextResponse.json({ error: 'custom effectiveFromDate must be >= next week' }, { status: 400 });
    newEffectiveFrom = parsedDate;
  }

  // Close existing version at the Sunday before newEffectiveFrom
  const newEffectiveTo = new Date(newEffectiveFrom.getTime());
  newEffectiveTo.setDate(newEffectiveTo.getDate() - 1); // previous day (Sunday)
  newEffectiveTo.setHours(0,0,0,0);

  if (newEffectiveTo < existing.effectiveFrom) {
    return NextResponse.json({ error: 'Computed effectiveTo precedes existing effectiveFrom' }, { status: 400 });
  }

  // Transaction: close existing, create new future version
  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    const closed = await tx.scheduleSegment.update({ where: { id: existing.id }, data: { effectiveTo: newEffectiveTo } });
    const newSeg = await tx.scheduleSegment.create({ data: {
      userId,
      weekday,
      startMinute,
      endMinute,
      activityId: (data.activityId ?? existing.activityId) || null,
      notes: (data.notes ?? existing.notes) || null,
      effectiveFrom: newEffectiveFrom
    }});
    return { closed, newSeg };
  });

  return NextResponse.json({ oldSegment: result.closed, newSegment: result.newSeg, mode: 'versioned', newEffectiveFrom: formatDateYMD(newEffectiveFrom) });
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

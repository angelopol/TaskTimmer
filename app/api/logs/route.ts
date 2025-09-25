import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { z } from 'zod';

const sourceEnum = ['PLANNED','ADHOC','MAKEUP'] as const;

const createSchema = z.object({
  activityId: z.string().cuid().nullable().optional(),
  segmentId: z.string().cuid().nullable().optional(),
  date: z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid date'),
  startedAt: z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid startedAt'),
  endedAt: z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid endedAt'),
  minutes: z.number().int().positive().optional(),
  partial: z.boolean().optional(),
  source: z.enum(sourceEnum).default('PLANNED'),
  comment: z.string().max(300).optional().nullable()
}).refine(d => new Date(d.endedAt).getTime() > new Date(d.startedAt).getTime(), { message: 'endedAt must be after startedAt', path: ['endedAt'] });

const updateSchema = z.object({
  activityId: z.string().cuid().nullable().optional(),
  segmentId: z.string().cuid().nullable().optional(),
  date: z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid date').optional(),
  startedAt: z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid startedAt').optional(),
  endedAt: z.union([z.string().refine(v=>!isNaN(Date.parse(v)), 'Invalid endedAt'), z.null()]).optional(),
  minutes: z.number().int().positive().optional(),
  partial: z.boolean().optional(),
  source: z.enum(sourceEnum).optional(),
  comment: z.string().max(300).optional().nullable()
}).refine(d => {
  if(d.startedAt && d.endedAt){
    if(d.endedAt === null) return true; // allow making it ongoing via PATCH
    return new Date(d.endedAt).getTime() > new Date(d.startedAt).getTime();
  }
  return true;
}, { message: 'endedAt must be after startedAt', path: ['endedAt'] });

// Semanas basadas en lunes usando hora LOCAL (no UTC) para evitar desfases timezone
function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Dom .. 6=Sab
  const diff = (day === 0 ? -6 : 1 - day); // si Domingo retrocede 6, si no (1 - day)
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function endOfWeek(date: Date) {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(e.getDate()+7); // exclusivo
  return e;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  let raw; try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;

  // Ownership checks
  if (data.activityId) {
    const act = await prisma.activity.findFirst({ where: { id: data.activityId, userId } });
    if (!act) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }
  let segment = null as any;
  if (data.segmentId) {
    segment = await prisma.scheduleSegment.findFirst({ where: { id: data.segmentId, userId } });
    if (!segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
  }

  const started = new Date(data.startedAt);
  const ended = new Date(data.endedAt);
  const mins = data.minutes ?? Math.round((ended.getTime() - started.getTime())/60000);
  if (mins <= 0) return NextResponse.json({ error: 'minutes must be > 0' }, { status: 422 });

  // Overlap validation: any existing log that starts before new end and ends after new start
  const overlapping = await (prisma.timeLog as any).findFirst({
    where: {
      userId,
      AND: [
        { startedAt: { lt: ended } },
        { OR: [ { endedAt: { gt: started } }, { endedAt: null } ] }
      ]
    }
  });
  if (overlapping) {
    return NextResponse.json({ error: 'Time range overlaps an existing log' }, { status: 409 });
  }

  if (segment) {
    // Ensure times fit inside segment day bounds (same weekday assumption)
    const segmentDuration = segment.endMinute - segment.startMinute;
    if (mins > segmentDuration) {
      // allow exceeding only if source != PLANNED
      if (data.source === 'PLANNED') return NextResponse.json({ error: 'Minutes exceed segment length' }, { status: 422 });
    }
  }

  // Parse provided date (YYYY-MM-DD) as LOCAL midnight to avoid UTC shift
  let dateLocal: Date;
  const dm = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(data.date);
  if(dm){
    const yy = parseInt(dm[1],10), mo = parseInt(dm[2],10)-1, dd = parseInt(dm[3],10);
    dateLocal = new Date(yy, mo, dd, 0,0,0,0);
  } else {
    dateLocal = new Date(data.date);
  }
  const log = await prisma.timeLog.create({ data: {
    userId,
    activityId: data.activityId || null,
    segmentId: data.segmentId || null,
    date: dateLocal,
    startedAt: started,
    endedAt: ended,
    minutes: mins,
    partial: !!data.partial,
    source: data.source,
    comment: data.comment || null
  }});
  return NextResponse.json({ log }, { status: 201 });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get('weekStart');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const activityFilter = searchParams.get('activityId');
  const sourceFilter = searchParams.get('source');
  const noSegment = searchParams.get('noSegment');
  const orderParam = searchParams.get('order');
  const segmentIdFilter = searchParams.get('segmentId');
  const dateFilter = searchParams.get('date'); // restrict to one calendar day (local)
  // Interpret weekStart as a local-date (YYYY-MM-DD) rather than UTC to avoid off-by-one when user is behind UTC.
  let refDate: Date;
  if(weekStartParam){
    // Manually parse parts to construct local midnight
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartParam);
    if(m){
      const y = parseInt(m[1],10); const mo = parseInt(m[2],10)-1; const da = parseInt(m[3],10);
      refDate = new Date(y, mo, da, 0,0,0,0);
    } else {
      const tmp = new Date(weekStartParam);
      if(isNaN(tmp.getTime())) return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
      refDate = tmp;
    }
  } else {
    refDate = new Date();
  }
  if (isNaN(refDate.getTime())) return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
  const from = startOfWeek(refDate);
  const to = endOfWeek(refDate);
  const where: any = { userId, date: { gte: from, lt: to } };
  if(activityFilter){ where.activityId = activityFilter; }
  if(sourceFilter){ where.source = sourceFilter; }
  if(noSegment === '1') { where.segmentId = null; }
  if(segmentIdFilter){ where.segmentId = segmentIdFilter; }
  if(dateFilter){
    const dm = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateFilter);
    if(dm){
      const yy = parseInt(dm[1],10), mo = parseInt(dm[2],10)-1, dd = parseInt(dm[3],10);
      const dayStart = new Date(yy, mo, dd, 0,0,0,0);
      const dayEnd = new Date(yy, mo, dd+1, 0,0,0,0);
      where.date = { gte: dayStart, lt: dayEnd };
    }
  }
  const take = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam))) : 20;
  const skip = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;
  const order: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc'; // default desc
  const [logs, total] = await Promise.all([
    prisma.timeLog.findMany({ where, orderBy: { startedAt: order }, skip, take, include: { activity: { select: { id: true, name: true, color: true } } } }),
    prisma.timeLog.count({ where })
  ]);
  return NextResponse.json({ from, to, logs, total, order });
}

export async function PATCH(req: Request){
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if(!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  let raw; try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(raw);
  if(!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;
  const existing = await prisma.timeLog.findFirst({ where: { id, userId } });
  if(!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if(data.activityId){
    const act = await prisma.activity.findFirst({ where: { id: data.activityId, userId } });
    if(!act) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }
  let segment: any = null;
  if(data.segmentId){
    segment = await prisma.scheduleSegment.findFirst({ where: { id: data.segmentId, userId } });
    if(!segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
  }
  const startedAt = data.startedAt ? new Date(data.startedAt) : existing.startedAt;
  const endedAt: Date | null = (data.endedAt === undefined) ? existing.endedAt : (data.endedAt === null ? null : new Date(data.endedAt));
  // If updating date, parse local midnight
  let newDate = existing.date;
  if(data.date){
    const dm = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(data.date);
    if(dm){
      const yy = parseInt(dm[1],10), mo = parseInt(dm[2],10)-1, dd = parseInt(dm[3],10);
      newDate = new Date(yy, mo, dd, 0,0,0,0);
    } else {
      newDate = new Date(data.date);
    }
  }
  if(endedAt){
    if(endedAt.getTime() <= startedAt.getTime()) return NextResponse.json({ error: 'endedAt must be after startedAt' }, { status: 422 });
  }
  const minutes = data.minutes ?? (endedAt ? Math.round((endedAt.getTime()-startedAt.getTime())/60000) : existing.minutes);
  if(endedAt && minutes <= 0) return NextResponse.json({ error: 'minutes must be > 0' }, { status: 422 });
  if(segment){
    const segDur = segment.endMinute - segment.startMinute;
    if(minutes > segDur && (data.source ?? existing.source) === 'PLANNED'){
      return NextResponse.json({ error: 'Minutes exceed segment length' }, { status: 422 });
    }
  }
  // Overlap validation excluding current log id
  const overlapping = await prisma.timeLog.findFirst({
    where: {
      userId,
      id: { not: id },
      AND: [
        // existing starts before new end (use now if ongoing)
        { startedAt: { lt: endedAt ? endedAt : new Date() } },
        // existing ends after new start OR is ongoing
        { OR: [ { endedAt: { gt: startedAt } }, { endedAt: null as any } ] }
      ]
    }
  });
  if (overlapping) {
    return NextResponse.json({ error: 'Time range overlaps an existing log' }, { status: 409 });
  }
  const updated = await (prisma.timeLog as any).update({ where: { id }, data: {
    activityId: data.activityId === undefined ? existing.activityId : data.activityId,
    segmentId: data.segmentId === undefined ? existing.segmentId : data.segmentId,
    date: newDate,
    startedAt,
    endedAt,
    minutes,
    partial: data.partial === undefined ? existing.partial : !!data.partial,
    source: data.source || existing.source,
    comment: data.comment !== undefined ? (data.comment || null) : existing.comment
  }});
  return NextResponse.json({ log: updated });
}

export async function DELETE(req: Request){
  const session = await getServerSession(authOptions as any);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if(!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing = await prisma.timeLog.findFirst({ where: { id, userId } });
  if(!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.timeLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

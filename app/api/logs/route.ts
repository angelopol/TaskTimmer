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

function startOfWeek(date: Date) { // Week Monday-based
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // adjust to Monday
  d.setUTCDate(d.getUTCDate()+diff);
  d.setUTCHours(0,0,0,0);
  return d;
}
function endOfWeek(date: Date) {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setUTCDate(e.getUTCDate()+7);
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

  if (segment) {
    // Ensure times fit inside segment day bounds (same weekday assumption)
    const segmentDuration = segment.endMinute - segment.startMinute;
    if (mins > segmentDuration) {
      // allow exceeding only if source != PLANNED
      if (data.source === 'PLANNED') return NextResponse.json({ error: 'Minutes exceed segment length' }, { status: 422 });
    }
  }

  const log = await prisma.timeLog.create({ data: {
    userId,
    activityId: data.activityId || null,
    segmentId: data.segmentId || null,
    date: new Date(data.date),
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
  let refDate = weekStartParam ? new Date(weekStartParam) : new Date();
  if (isNaN(refDate.getTime())) return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
  const from = startOfWeek(refDate);
  const to = endOfWeek(refDate);
  const logs = await prisma.timeLog.findMany({ where: { userId, date: { gte: from, lt: to } }, orderBy: { startedAt: 'asc' } });
  return NextResponse.json({ from, to, logs });
}

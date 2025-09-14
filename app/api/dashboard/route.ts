import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/nextAuthOptions';
import { prisma } from '../../../lib/prisma';

function startOfWeek(date: Date) { // Monday-based
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day); // adjust to Monday
  d.setUTCDate(d.getUTCDate()+diff);
  d.setUTCHours(0,0,0,0);
  return d;
}
function endOfWeek(date: Date) { const s = startOfWeek(date); const e = new Date(s); e.setUTCDate(e.getUTCDate()+7); return e; }

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

  // Fetch activities (active)
  const activities = await prisma.activity.findMany({ where: { userId, active: true } });

  // Fetch all schedule segments for user (we'll derive planned minutes for the week)
  const segments = await prisma.scheduleSegment.findMany({ where: { userId } });

  // Fetch logs for week with needed fields
  const logs = await prisma.timeLog.findMany({
    where: { userId, date: { gte: from, lt: to } },
    select: { activityId: true, minutes: true, source: true, partial: true }
  });

  // Pre-calc: planned minutes per activity in a canonical week (sum of all segments assigned to activity)
  const plannedMap: Record<string, number> = {};
  for (const s of segments) {
    if (!s.activityId) continue;
    const duration = Math.max(0, s.endMinute - s.startMinute);
    plannedMap[s.activityId] = (plannedMap[s.activityId] || 0) + duration;
  }

  // Logs aggregation per activity
  interface LogAgg { total: number; bySource: Record<string, number>; partial: number; full: number; }
  const logsAgg: Record<string, LogAgg> = {};
  for (const l of logs) {
    if (!l.activityId) continue;
    const entry = logsAgg[l.activityId] || { total: 0, bySource: {}, partial: 0, full: 0 };
    entry.total += l.minutes;
    entry.bySource[l.source] = (entry.bySource[l.source] || 0) + l.minutes;
    if (l.partial) entry.partial += l.minutes; else entry.full += l.minutes;
    logsAgg[l.activityId] = entry;
  }

  const result = activities.map((a: typeof activities[number]) => {
    const target = a.weeklyTargetMinutes || 0;
    const plannedWeek = plannedMap[a.id] || 0; // total scheduled minutes in template week
    const agg = logsAgg[a.id] || { total: 0, bySource: {}, partial: 0, full: 0 };
    const done = agg.total;
    const remaining = Math.max(target - done, 0);
    const over = done > target ? done - target : 0;
    const percent = target > 0 ? Math.min(100, +((done / target) * 100).toFixed(2)) : null;
    const coveragePct = plannedWeek > 0 ? Math.min(100, +((done / plannedWeek) * 100).toFixed(2)) : null; // how much of planned schedule executed
    const plannedRemaining = Math.max(plannedWeek - done, 0);
    return {
      id: a.id,
      name: a.name,
      color: a.color,
      target,
      plannedMinutesWeek: plannedWeek,
      done,
      remaining,
      over,
      percent,
      plannedCoveragePercent: coveragePct,
      plannedRemaining,
      loggedBySource: agg.bySource,
      loggedPartialMinutes: agg.partial,
      loggedFullMinutes: agg.full
    };
  });

  return NextResponse.json({
    weekStart: from.toISOString().substring(0,10),
    weekEndExclusive: to.toISOString().substring(0,10),
    activities: result
  });
}

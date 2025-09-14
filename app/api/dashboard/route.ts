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

  // Fetch activities
  const activities = await prisma.activity.findMany({ where: { userId, active: true } });

  // Fetch logs for week
  const logs = await prisma.timeLog.findMany({
    where: { userId, date: { gte: from, lt: to } },
    select: { activityId: true, minutes: true }
  });

  // Aggregate minutes by activityId
  const minutesMap: Record<string, number> = {};
  for (const l of logs) {
    if (!l.activityId) continue;
    minutesMap[l.activityId] = (minutesMap[l.activityId] || 0) + l.minutes;
  }

  const result = activities.map((a: typeof activities[number]) => {
    const done = minutesMap[a.id] || 0;
    const target = a.weeklyTargetMinutes || 0;
    const remaining = Math.max(target - done, 0);
    const over = done > target ? done - target : 0;
    const percent = target > 0 ? Math.min(100, +( (done / target) * 100 ).toFixed(2)) : null;
    return {
      id: a.id,
      name: a.name,
      color: a.color,
      target,
      done,
      remaining,
      over,
      percent
    };
  });

  return NextResponse.json({ weekStart: from.toISOString().substring(0,10), weekEndExclusive: to.toISOString().substring(0,10), activities: result });
}

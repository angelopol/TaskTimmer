import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';
import { prisma } from '../../../../lib/prisma';

function startOfWeek(date: Date) { // Monday-based
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate()+diff);
  d.setUTCHours(0,0,0,0);
  return d;
}
function endOfWeek(date: Date) { const s = startOfWeek(date); const e = new Date(s); e.setUTCDate(e.getUTCDate()+7); return e; }

// Ensure this route is always dynamic (no static cache) in Next.js App Router
export const dynamic = 'force-dynamic';
export const revalidate = 0; // extra safeguard

export async function GET(req: Request){
  const session = await getServerSession(authOptions as any);
  if(!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session as any).userId;
  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get('weekStart');
  let refDate = weekStartParam ? new Date(weekStartParam) : new Date();
  if(isNaN(refDate.getTime())) return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
  const from = startOfWeek(refDate); const to = endOfWeek(refDate);
  // Aggregate minutes per segment & per activity within segment
  const grouped = await prisma.timeLog.groupBy({
    by: ['segmentId','activityId'],
    where: { userId, date: { gte: from, lt: to }, segmentId: { not: null } },
    _sum: { minutes: true }
  });
  const usage: Record<string, number> = {};
  const breakdown: Record<string, { activityId: string | null; minutes: number }[]> = {};
  for(const row of grouped){
    if(!row.segmentId) continue;
    const segId = row.segmentId;
    const mins = row._sum.minutes || 0;
    usage[segId] = (usage[segId] || 0) + mins;
    if(!breakdown[segId]) breakdown[segId] = [];
    breakdown[segId].push({ activityId: row.activityId, minutes: mins });
  }
  // Determine dominant (most logged minutes) activity per segment
  const dominant: Record<string, { activityId: string | null; minutes: number } | null> = {};
  for(const segId of Object.keys(breakdown)){
    const arr = breakdown[segId];
    if(!arr.length){ dominant[segId] = null; continue; }
    arr.sort((a,b)=> b.minutes - a.minutes);
    dominant[segId] = arr[0];
  }
  return new NextResponse(JSON.stringify({ from, to, usage, breakdown, dominant }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}
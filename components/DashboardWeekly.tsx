"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { IconCalendar } from './ui/icons';
import { useApiClient } from './useApiClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUnit } from './UnitProvider';
import { fmtMinutes, fmtHoursMinutes } from '../lib/time';

interface ActivityStat {
  id: string;
  name: string;
  color: string | null;
  target: number;
  plannedMinutesWeek: number;
  done: number;
  remaining: number;
  over: number;
  percent: number | null;
  plannedCoveragePercent: number | null;
  plannedRemaining: number;
  loggedBySource: Record<string, number>;
  loggedPartialMinutes: number;
  loggedFullMinutes: number;
}

interface DashboardResponse {
  weekStart: string;
  weekEndExclusive: string;
  activities: ActivityStat[];
}

export function DashboardWeekly() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { apiFetch } = useApiClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unit, setUnit } = useUnit();

  function toDateStr(d: Date) {
    return d.toISOString().substring(0,10);
  }
  function startOfWeek(date: Date) { // Monday
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setUTCDate(d.getUTCDate()+diff);
    d.setUTCHours(0,0,0,0);
    return d;
  }
  const todayWeekStart = toDateStr(startOfWeek(new Date()));
  const [weekStart, setWeekStart] = useState<string>(() => {
    const param = searchParams?.get('weekStart');
    if (param && !isNaN(new Date(param).getTime())) return param;
    return todayWeekStart;
  });
  // If URL has unit, override provider once; otherwise keep provider's choice
  useEffect(()=>{
    const qp = searchParams?.get('unit');
    if(qp === 'min' || qp === 'hr') setUnit(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToWeek(newWeekStart: string) {
    setWeekStart(newWeekStart);
    // Keep URL in sync without adding history entries
    const sp = new URLSearchParams(Array.from(searchParams?.entries?.() || []));
    sp.set('weekStart', newWeekStart);
    router.replace(`?${sp.toString()}`);
  }
  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return toDateStr(d);
  }
  const prevWeek = () => goToWeek(addDays(weekStart, -7));
  const nextWeek = () => goToWeek(addDays(weekStart, 7));
  const goToday = () => goToWeek(todayWeekStart);
  const nextIsFuture = addDays(weekStart, 7) > todayWeekStart; // simple string compare ok for YYYY-MM-DD

  const fmt = useMemo(()=> (m: number) => (unit === 'min' ? fmtMinutes(m) : fmtHoursMinutes(m)), [unit]);
  function setUnitAndSync(newUnit: 'min'|'hr'){
    setUnit(newUnit);
    const sp = new URLSearchParams(Array.from(searchParams?.entries?.() || []));
    sp.set('unit', newUnit);
    router.replace(`?${sp.toString()}`);
  }

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const url = weekStart ? `/api/dashboard?weekStart=${encodeURIComponent(weekStart)}` : '/api/dashboard';
        const resp = await apiFetch<DashboardResponse>(url);
        if (!aborted) {
          if (resp.ok && resp.data) {
            setData(resp.data);
            setError('');
          } else if (!resp.ok) {
            // If 401, apiFetch already triggered signOut; still surface a short error locally
            setError(resp.error || 'Failed to load dashboard');
          }
        }
      } catch (e:any) {
        if (!aborted) setError(e.message || 'Failed to load dashboard');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [weekStart, apiFetch]);

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tt-panel tt-panel-padding">
        <div>
          <h2 className="tt-heading-page mb-1">Weekly Dashboard</h2>
          <p className="text-xs tt-text-muted">Week {data.weekStart} to {data.weekEndExclusive}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={prevWeek} aria-label="Previous week">◀ Prev</Button>
            <Button size="sm" variant="ghost" onClick={goToday} aria-label="Current week">Today</Button>
            <Button size="sm" variant="ghost" onClick={nextWeek} aria-label="Next week" disabled={nextIsFuture}>Next ▶</Button>
          </div>
          <div className="flex items-center gap-1" aria-label="Units switch">
            <Button size="sm" variant={unit==='min' ? 'primary' : 'ghost'} onClick={()=>setUnitAndSync('min')}>Min</Button>
            <Button size="sm" variant={unit==='hr' ? 'primary' : 'ghost'} onClick={()=>setUnitAndSync('hr')}>Hours</Button>
          </div>
          <Link href="/schedule" aria-label="Go to weekly schedule" className="group">
            <Button asChild variant="primary" size="sm" leftIcon={<IconCalendar size={14} />}>Go to schedule</Button>
          </Link>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.activities.map(a => {
          const pct = a.percent ?? 0;
          const coverage = a.plannedCoveragePercent ?? 0;
          const planned = a.plannedMinutesWeek;
          const sources = Object.entries(a.loggedBySource).sort((x,y)=>y[1]-x[1]);
          return (
            <div key={a.id} className="tt-panel tt-panel-padding flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: a.color || '#999' }} />
                  {a.name}
                </h3>
                <span className="text-xs tt-text-muted">
                  {fmt(a.done)} / {fmt(a.target)}
                  {a.over>0 && (
                    <strong className="text-red-600 ml-1">+{fmt(a.over)}</strong>
                  )}
                </span>
              </div>
              <div className="space-y-2 mt-1 flex-1">
                {/* Target progress bar */}
                <div>
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${Math.min(100,pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Target {fmt(a.target)}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Planned coverage bar */}
                <div>
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100,coverage)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Planned {fmt(planned)}</span>
                    <span>{coverage.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Sources breakdown */}
                {sources.length > 0 && (
                  <div className="text-[11px] flex flex-wrap gap-1">
                    {sources.map(([k,v]) => (
                      <span key={k} className="tt-badge" data-size="sm">{k}: {fmt(v)}</span>
                    ))}
                    <span className="tt-badge" data-size="sm" data-variant="amber">Partial {fmt(a.loggedPartialMinutes)}</span>
                    <span className="tt-badge" data-size="sm" data-variant="green">Full {fmt(a.loggedFullMinutes)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

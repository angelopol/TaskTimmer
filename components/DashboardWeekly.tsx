"use client";
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useApiClient } from './useApiClient';
import { useUnit } from './UnitProvider';
import { useWeek } from './week/WeekContext';
import { fmtMinutes, fmtHoursMinutes, mondayOf } from '../lib/time';
import { CurrentActivityBar } from './CurrentActivityBar';
import { Button, buttonStyles, IconButton } from './ui/Button';
import { EmptyState, ErrorState, LoadingState } from './ui/Feedback';
import { UnitSwitch } from './ui/UnitSwitch';
import { IconAdd, IconCalendar, IconChevronLeft, IconChevronRight } from './ui/icons';

interface ActivityStat {
  id:string; name:string; color:string | null; target:number; plannedMinutesWeek:number;
  done:number; remaining:number; over:number; percent:number | null; plannedCoveragePercent:number | null;
}
interface DashboardResponse { activities:ActivityStat[]; weekStart:string; weekEndExclusive:string; }
export function DashboardWeekly() {
  const { apiFetch } = useApiClient();
  const { data:session } = useSession();
  const { unit, setUnit } = useUnit();
  const { weekStart, setWeekStart, gotoPrevWeek, gotoNextWeek, gotoThisWeek, weekRangeLabel } = useWeek();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const requested = searchParams.get('weekStart');
    if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !isNaN(Date.parse(requested))) setWeekStart(mondayOf(requested));
    const requestedUnit = searchParams.get('unit');
    if (requestedUnit === 'hr' || requestedUnit === 'min') setUnit(requestedUnit);
  }, [searchParams, setWeekStart, setUnit]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiFetch<DashboardResponse>('/api/dashboard?weekStart=' + weekStart).then(response => {
      if (!active) return;
      if (response.ok) setData(response.data); else setError(response.error || 'Your weekly overview could not be loaded.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [apiFetch, weekStart, refresh]);
  const reload = useCallback(() => setRefresh(v => v+1), []);
  useEffect(() => { window.addEventListener('timelog:created', reload); return () => window.removeEventListener('timelog:created', reload); }, [reload]);
  const fmt = unit === 'min' ? fmtMinutes : fmtHoursMinutes;
  const activities = data?.activities || [];
  const total = activities.reduce((sum, a) => sum+a.done, 0);
  const planned = activities.reduce((sum, a) => sum+a.plannedMinutesWeek, 0);
  const goals = activities.filter(a => a.target > 0);
  const completed = goals.filter(a => a.done >= a.target).length;
  const name = session?.user?.name?.split(' ')[0];
  return <div className="space-y-7">
    <header className="tt-page-header">
      <div><p className="tt-eyebrow mb-2">Your time, with intention</p><h1 className="tt-heading-page">{name ? 'Welcome back, ' + name : 'Your weekly overview'}</h1><p className="tt-text-muted mt-2">A little focus today. A clearer picture of your week.</p></div>
      <Link href="/logs" className={buttonStyles('secondary')}><IconAdd size={18} />Add time manually</Link>
    </header>
    <CurrentActivityBar />
    <section aria-labelledby="week-title" className="space-y-5">
      <div className="tt-page-header">
        <div><h2 id="week-title" className="text-lg font-semibold">Your week at a glance</h2><p className="tt-text-muted text-sm">{weekRangeLabel}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Choose a week" className="flex items-center gap-1">
            <IconButton icon={<IconChevronLeft size={18} />} label="Previous week" variant="ghost" onClick={gotoPrevWeek} />
            <Button variant="secondary" onClick={gotoThisWeek}>This week</Button>
            <IconButton icon={<IconChevronRight size={18} />} label="Next week" variant="ghost" onClick={gotoNextWeek} />
          </div><UnitSwitch />
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <LoadingState label="Loading your weekly progress…" /> : !activities.length ?
        <EmptyState title="Make room for what matters" description="Start with an activity: work, studying, exercise, or anything you want to spend time on. A weekly goal is optional.">
          <Link href="/activities" className={buttonStyles()}><IconAdd size={18} />Create your first activity</Link>
        </EmptyState> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ label:'Time on your activities', value:fmt(total), help:'Saved time this week' }, { label:'Time planned', value:fmt(planned), help:'In your weekly schedule' }, { label:'Weekly goals reached', value:goals.length ? completed + ' / ' + goals.length : 'No goals yet', help:goals.length ? 'Progress at your own pace' : 'Set an optional goal in Activities' }].map(stat =>
            <div key={stat.label} className="tt-panel tt-panel-padding"><p className="tt-text-muted text-sm">{stat.label}</p><p className="my-2 text-3xl font-semibold tracking-tight">{stat.value}</p><p className="tt-text-muted text-xs">{stat.help}</p></div>)}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2"><h3 className="text-lg font-semibold">Activity progress</h3><Link href="/activities" className="tt-link text-sm">Manage activities</Link></div>
        <div className="grid gap-4 md:grid-cols-2">
          {activities.map(activity => <article key={activity.id} className="tt-panel tt-panel-padding">
            <div className="flex items-start justify-between gap-4"><h4 className="flex min-w-0 items-center gap-2.5 font-semibold"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background:activity.color || '#6366f1' }} />{activity.name}</h4><span className="shrink-0 text-lg font-semibold tabular-nums">{fmt(activity.done)}</span></div>
            {activity.target > 0 ? <div className="mt-5">
              <div className="mb-2 flex justify-between gap-3 text-sm"><span className="tt-text-muted">Weekly goal · {fmt(activity.target)}</span><span className="font-medium">{Math.round(activity.percent || 0)}%</span></div>
              <div role="progressbar" aria-label={activity.name + ' weekly goal'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(activity.percent || 0))} aria-valuetext={fmt(activity.done) + ' of ' + fmt(activity.target)} className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-500" style={{ width:Math.min(100, activity.percent || 0) + '%' }} /></div>
              <p className="tt-text-muted mt-3 text-sm">{activity.remaining > 0 ? fmt(activity.remaining) + ' to reach your goal' : 'Goal reached. Nice work!'}</p>
            </div> : <p className="tt-text-muted mt-4 text-sm">No weekly goal. Every bit of time counts.</p>}
            {activity.plannedMinutesWeek > 0 && <p className="tt-text-muted mt-4 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">{fmt(activity.plannedMinutesWeek)} planned in your schedule</p>}
          </article>)}
        </div>
      </>}
    </section>
    <Link href="/schedule" className="tt-panel flex flex-wrap items-center gap-4 p-5 hover:border-indigo-400"><IconCalendar size={24} /><div className="flex-1"><p className="font-semibold">Make a little space for your priorities</p><p className="tt-text-muted text-sm">Plan your week with a simple, flexible schedule.</p></div><IconChevronRight size={20} /></Link>
  </div>;
}


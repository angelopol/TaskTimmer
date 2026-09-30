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
import { buttonStyles } from './ui/Button';
import { ActionBar } from './ui/Menu';
import { PageHeader } from './ui/PageHeader';
import { WeekNav } from './week/WeekNav';
import { EmptyState, ErrorState, LoadingState } from './ui/Feedback';
import { IconAdd, IconCalendar } from './ui/icons';

interface ActivityStat {
  id:string; name:string; color:string | null; target:number; plannedMinutesWeek:number;
  done:number; remaining:number; over:number; percent:number | null; plannedCoveragePercent:number | null;
}
interface DashboardResponse { activities:ActivityStat[]; weekStart:string; weekEndExclusive:string; }
export function DashboardWeekly() {
  const { apiFetch } = useApiClient();
  const { data:session } = useSession();
  const { unit, setUnit } = useUnit();
  const { weekStart, setWeekStart } = useWeek();
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
      if (response.ok) setData(response.data); else setError(response.error || 'Could not load your week.');
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
  const stats = [
    { label:'Tracked', value:fmt(total) },
    { label:'Planned', value:fmt(planned) },
    { label:'Goals met', value:goals.length ? completed + '/' + goals.length : '—' }
  ];
  return <div className="space-y-5">
    <PageHeader title={name ? 'Hi, ' + name : 'Overview'} />
    <CurrentActivityBar />
    <section aria-label="Your week" className="space-y-4">
      <div className="flex items-center gap-2">
        <WeekNav className="min-w-0 flex-1 sm:max-w-sm sm:flex-none" />
        <ActionBar className="ml-auto" actions={[
          { label:'Add time', icon:<IconAdd size={18} />, href:'/logs' },
          { label:'Plan week', icon:<IconCalendar size={18} />, href:'/schedule' }
        ]} />
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <LoadingState label="Loading your week…" /> : !activities.length ?
        <EmptyState title="No activities yet">
          <Link href="/activities" className={buttonStyles()}><IconAdd size={18} />Create an activity</Link>
        </EmptyState> : <>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map(stat => <div key={stat.label} className="tt-panel px-3 py-3 sm:px-5 sm:py-4">
            <p className="tt-text-muted truncate text-xs font-medium sm:text-sm">{stat.label}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{stat.value}</p>
          </div>)}
        </div>
        <div className="flex items-center justify-between gap-3"><h2 className="tt-heading-section">Activities</h2><Link href="/activities" className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">Manage</Link></div>
        <ul className="tt-list">
          {activities.map(activity => {
            const percent = Math.min(100, Math.round(activity.percent || 0));
            return <li key={activity.id} className="bg-[var(--surface)] px-4 py-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="tt-dot" style={{ background:activity.color || '#6366f1' }} />
                <h3 className="min-w-0 flex-1 truncate font-medium">{activity.name}</h3>
                <span className="shrink-0 text-sm tabular-nums"><strong className="font-semibold">{fmt(activity.done)}</strong>{activity.target > 0 && <span className="tt-text-muted"> / {fmt(activity.target)}</span>}</span>
              </div>
              {activity.target > 0 && <div className="mt-2 flex items-center gap-3 pl-[22px]">
                <div role="progressbar" aria-label={activity.name + ' weekly goal'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={fmt(activity.done) + ' of ' + fmt(activity.target)} className="tt-progress flex-1">
                  <div style={{ width:percent + '%', background:activity.done >= activity.target ? '#16a34a' : activity.color || '#6366f1' }} />
                </div>
                <span className="tt-text-muted w-9 shrink-0 text-right text-xs tabular-nums">{percent}%</span>
              </div>}
            </li>;
          })}
        </ul>
      </>}
    </section>
  </div>;
}

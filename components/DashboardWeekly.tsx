"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { IconCalendar } from './ui/icons';
import { useApiClient } from './useApiClient';

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

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const resp = await apiFetch<DashboardResponse>('/api/dashboard');
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
  }, []);

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
                <span className="text-xs tt-text-muted">{a.done} / {a.target} min {a.over>0 && <strong className="text-red-600 ml-1">+{a.over}</strong>}</span>
              </div>
              <div className="space-y-2 mt-1 flex-1">
                {/* Target progress bar */}
                <div>
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${Math.min(100,pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Target {a.target}m</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Planned coverage bar */}
                <div>
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100,coverage)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Planned {planned}m</span>
                    <span>{coverage.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Sources breakdown */}
                {sources.length > 0 && (
                  <div className="text-[11px] flex flex-wrap gap-1">
                    {sources.map(([k,v]) => (
                      <span key={k} className="tt-badge" data-size="sm">{k}: {v}m</span>
                    ))}
                    <span className="tt-badge" data-size="sm" data-variant="amber">Partial {a.loggedPartialMinutes}m</span>
                    <span className="tt-badge" data-size="sm" data-variant="green">Full {a.loggedFullMinutes}m</span>
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

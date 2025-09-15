"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

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

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        if (!aborted) setData(json);
      } catch (e:any) {
        if (!aborted) setError(e.message);
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold mb-1">Weekly Dashboard</h2>
          <p className="text-xs text-gray-500">Week {data.weekStart} to {data.weekEndExclusive}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/schedule"
            aria-label="Go to weekly schedule"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 dark:focus:ring-offset-gray-900 shadow-sm"
          >
            {/* icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Go to schedule</span>
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
            <div key={a.id} className="border rounded p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: a.color || '#999' }} />
                  {a.name}
                </h3>
                <span className="text-xs text-gray-500">{a.done} / {a.target} min {a.over>0 && <strong className="text-red-600 ml-1">+{a.over}</strong>}</span>
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
                  <div className="text-[11px] text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                    {sources.map(([k,v]) => (
                      <span key={k}>{k}: {v}m</span>
                    ))}
                    <span className="text-gray-500">Partial {a.loggedPartialMinutes}m · Full {a.loggedFullMinutes}m</span>
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

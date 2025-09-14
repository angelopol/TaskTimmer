"use client";
import React, { useEffect, useState } from 'react';

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
      <header>
        <h2 className="text-xl font-semibold mb-1">Weekly Dashboard</h2>
        <p className="text-xs text-gray-500">Week {data.weekStart} to {data.weekEndExclusive}</p>
      </header>
      <div className="space-y-4">
        {data.activities.map(a => {
          const pct = a.percent ?? 0;
          const coverage = a.plannedCoveragePercent ?? 0;
          const planned = a.plannedMinutesWeek;
          const sources = Object.entries(a.loggedBySource).sort((x,y)=>y[1]-x[1]);
          return (
            <div key={a.id} className="border rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: a.color || '#999' }} />
                  {a.name}
                </h3>
                <span className="text-xs text-gray-500">{a.done} / {a.target} min {a.over>0 && <strong className="text-red-600 ml-1">+{a.over}</strong>}</span>
              </div>
              <div className="space-y-2">
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

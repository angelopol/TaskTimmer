"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUnit } from '../UnitProvider';
import { fmtMinutes, fmtHoursMinutes } from '../../lib/time';

interface Activity { id: string; name: string; color: string | null; weeklyTargetMinutes?: number }
interface DashboardActivity { id: string; done: number }

export function StartActivityModal({ open, onClose, onStart }:{ open: boolean; onClose: ()=>void; onStart: (activityId?: string)=>void | Promise<void>; }){
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [q, setQ] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [weekDoneMap, setWeekDoneMap] = useState<Record<string, number>>({});
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<'any'|'has'|'none'>('any');
  const [usedThisWeekOnly, setUsedThisWeekOnly] = useState(false);
  const { unit } = useUnit();

  useEffect(()=>{ setMounted(true); }, []);
  useEffect(()=>{
    if(!open) return;
    // load favorites
    try { const raw = localStorage.getItem('tt_fav_activities'); if(raw){ setFavorites(JSON.parse(raw)); } } catch {}
    // load activities
    (async()=>{
      setLoading(true);
      try {
        const [actRes, dashRes] = await Promise.all([
          fetch('/api/activities', { cache: 'no-store' }),
          (async()=>{
            // compute local Monday ISO (YYYY-MM-DD)
            const now = new Date();
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diff = (d.getDay() === 0 ? -6 : 1 - d.getDay());
            d.setDate(d.getDate()+diff);
            d.setHours(0,0,0,0);
            const pad = (n:number)=> String(n).padStart(2,'0');
            const weekStart = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
            return fetch(`/api/dashboard?weekStart=${encodeURIComponent(weekStart)}`, { cache: 'no-store' });
          })()
        ]);
        const [actData, dashData] = await Promise.all([actRes.json(), dashRes.json()]);
        if(actRes.ok){ setActivities(actData.activities || []); }
        if(dashRes.ok){
          const map: Record<string, number> = {};
          (dashData.activities as DashboardActivity[]).forEach(a=>{ map[a.id] = a.done || 0; });
          setWeekDoneMap(map);
        }
      } finally { setLoading(false); }
    })();
  }, [open]);

  useEffect(()=>{ try { localStorage.setItem('tt_fav_activities', JSON.stringify(favorites)); } catch {} }, [favorites]);

  const favSet = useMemo(()=> new Set(favorites), [favorites]);
  const availableColors = useMemo(()=>{
    const s = new Set<string>();
    activities.forEach(a=>{ if(a.color){ s.add(a.color); } });
    return Array.from(s);
  }, [activities]);
  const filtered = useMemo(()=>{
    const term = q.trim().toLowerCase();
    let list = term ? activities.filter(a=> a.name.toLowerCase().includes(term)) : activities.slice();
    if(colorFilter){ list = list.filter(a=> a.color === colorFilter); }
    if(targetFilter !== 'any'){
      list = list.filter(a => (a.weeklyTargetMinutes || 0) > 0 === (targetFilter === 'has'));
    }
    if(usedThisWeekOnly){ list = list.filter(a => (weekDoneMap[a.id] || 0) > 0); }
    // sort: favorites first, then used this week desc, then name
    list.sort((a,b)=> (
      (favSet.has(a.id)?-1:0) - (favSet.has(b.id)?-1:0)
      || ((weekDoneMap[b.id]||0) - (weekDoneMap[a.id]||0))
      || a.name.localeCompare(b.name)
    ));
    return list;
  }, [activities, q, favSet, colorFilter, targetFilter, usedThisWeekOnly, weekDoneMap]);

  function toggleFavorite(id: string){
    setFavorites(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }

  if(!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(92vw,640px)] max-h-[80vh] overflow-hidden rounded-lg shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold">Start Activity</h3>
          <button className="tt-badge" onClick={onClose}>Close</button>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input className="tt-input flex-1" placeholder="Filter activities..." value={q} onChange={e=>setQ(e.target.value)} />
              <button className="tt-badge" onClick={()=>onStart(undefined)}>Start unassigned</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Color:</span>
                <button className={`tt-badge ${!colorFilter?'':'opacity-60'}`} onClick={()=>setColorFilter(null)}>All</button>
                {availableColors.map(c=> (
                  <button key={c} className={`tt-badge ${colorFilter===c?'':'opacity-60'}`} onClick={()=>setColorFilter(c)}>
                    <span className="inline-block w-3 h-3 rounded-full mr-1 align-middle" style={{ backgroundColor: c }} />
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Target:</span>
                <button className={`tt-badge ${targetFilter==='any'?'':'opacity-60'}`} onClick={()=>setTargetFilter('any')}>Any</button>
                <button className={`tt-badge ${targetFilter==='has'?'':'opacity-60'}`} onClick={()=>setTargetFilter('has')}>Has</button>
                <button className={`tt-badge ${targetFilter==='none'?'':'opacity-60'}`} onClick={()=>setTargetFilter('none')}>None</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Recent:</span>
                <button className={`tt-badge ${usedThisWeekOnly?'':'opacity-60'}`} onClick={()=>setUsedThisWeekOnly(v=>!v)}>Used this week</button>
              </div>
              {(colorFilter || targetFilter!=='any' || usedThisWeekOnly) && (
                <button className="tt-badge" data-variant="amber" onClick={()=>{ setColorFilter(null); setTargetFilter('any'); setUsedThisWeekOnly(false); }}>Clear</button>
              )}
            </div>
          </div>
          {loading && <div className="text-sm">Loading...</div>}
          {!loading && (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {filtered.map(a=> {
                const target = a.weeklyTargetMinutes || 0;
                const done = weekDoneMap[a.id] || 0;
                const fmt = (m:number)=> unit==='min' ? fmtMinutes(m) : fmtHoursMinutes(m);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color || '#999' }} />
                        <span className="truncate font-medium">{a.name}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        <span className="mr-2">Target: {fmt(target)}</span>
                        <span>This week: {fmt(done)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className={`tt-badge ${favSet.has(a.id)?'':'opacity-60'}`} onClick={()=>toggleFavorite(a.id)} title="Favorite">★</button>
                      <button className="tt-badge" data-variant="green" onClick={()=>onStart(a.id)}>Start</button>
                    </div>
                  </div>
                );
              })}
              {!filtered.length && <div className="text-xs text-gray-500">No activities match your filter.</div>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

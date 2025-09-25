"use client";
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useApiClient } from '../useApiClient';
import { minutesToHHMM, hhmmToMinutes, WEEKDAY_NAMES_SHORT, isoDate, combineDateAndTime, mondayOf, fmtMinutes, fmtHoursMinutes } from '../../lib/time';
import { useWeek } from '../week/WeekContext';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; notes: string | null; activity?: Activity | null; }

const SOURCES = ['PLANNED','ADHOC','MAKEUP'] as const;

type Source = typeof SOURCES[number];

// Small reusable banner showing the active week range derived from weekStart (Monday) -> Sunday
function ActiveWeekBanner({ weekStart }: { weekStart: string }){
  // compute Sunday
  const [y,m,d] = weekStart.split('-').map(Number);
  const monday = new Date(y, m-1, d, 0,0,0,0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+6, 0,0,0,0);
  const pad = (n:number)=> n.toString().padStart(2,'0');
  const endLabel = `${pad(sunday.getDate())}/${pad(sunday.getMonth()+1)}`;
  const startLabel = `${pad(monday.getDate())}/${pad(monday.getMonth()+1)}`;
  return (
    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <span className="font-medium">Active Week:</span>
      <span className="font-mono">{startLabel} – {endLabel}</span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">(Mon→Sun)</span>
    </div>
  );
}

export default function LogTimeForm(){
  const { weekStart, setWeekStart, gotoPrevWeek, gotoNextWeek, gotoThisWeek } = useWeek();
  const { unit, setUnit } = useUnit();
  const { addToast } = useToast();
  const todayISO = isoDate(new Date());
  const [date, setDate] = useState(todayISO);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [activityId, setActivityId] = useState<string>('');
  const [segmentId, setSegmentId] = useState<string>('');
  const [source, setSource] = useState<Source>('PLANNED');
  const [partial, setPartial] = useState(false);
  const [comment, setComment] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [limit, setLimit] = useState(12);
  const [offset, setOffset] = useState(0);
  const [filterActivity, setFilterActivity] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('logs_order');
      if(stored === 'asc' || stored === 'desc') return stored;
    }
    return 'desc';
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);
  const [autoSelectEnabled, setAutoSelectEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem('logs_auto_select_segments');
      if (v === '0') return false; if (v === '1') return true;
    }
    return true;
  });
  const [userEditedTime, setUserEditedTime] = useState(false);
  // Removed debug load counter (loadCount)
  const { apiFetch } = useApiClient();
  const lastLoadedWeekRef = useRef<string | null>(null); // last fully loaded weekStart
  const loadingWeekRef = useRef<string | null>(null); // week currently in-flight

  // Prevent ping-pong updates between date and weekStart
  const lastSyncRef = useRef<{ date?: string; weekStart?: string }>({});
  // When date changes, align weekStart if needed
  useEffect(()=>{
    const monday = mondayOf(date);
    if(monday !== weekStart){
      if(lastSyncRef.current.date === date && lastSyncRef.current.weekStart === weekStart){
        return; // already processed this combination
      }
      lastSyncRef.current = { date, weekStart };
      setWeekStart(monday);
    }
  }, [date, weekStart, setWeekStart]);

  // When weekStart changes, ensure date is within that week (otherwise set to monday)
  useEffect(()=>{
    const currentMonday = mondayOf(date);
    if(currentMonday !== weekStart){
      if(lastSyncRef.current.date === date && lastSyncRef.current.weekStart === weekStart){
        return; // already adjusted
      }
      lastSyncRef.current = { date: weekStart, weekStart };
      setDate(weekStart);
    }
  }, [weekStart, date]);

  function resetToSegmentTimes(){
    if(!segmentId) return;
    const seg = segments.find(s=>s.id===segmentId);
    if(!seg) return;
    setStart(minutesToHHMM(seg.startMinute));
    setEnd(minutesToHHMM(seg.endMinute));
    setUserEditedTime(false);
  }

  async function loadAll(){
    // Prevent starting a new load if the exact same week is already in-flight
    if(loadingWeekRef.current === weekStart){
      return;
    }
    loadingWeekRef.current = weekStart;
    setLoading(true); setError(null);
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    if(filterActivity) qs.set('activityId', filterActivity);
    if(filterSource) qs.set('source', filterSource);
    if(order) qs.set('order', order);
    // weekStart basado en la fecha seleccionada para que siempre veas la semana de esa fecha
  qs.set('weekStart', weekStart);
    const [actRes, segRes, logsRes] = await Promise.all([
      apiFetch('/api/activities'),
      apiFetch('/api/schedule/segments'),
      apiFetch('/api/logs?'+qs.toString())
    ]);
    const problems: string[] = [];
    if(actRes.ok){ setActivities((actRes.data as any)?.activities || []); } else { problems.push(`activities: ${actRes.error}`); }
    if(segRes.ok){ setSegments((segRes.data as any)?.segments || []); } else { problems.push(`segments: ${segRes.error}`); }
    if(logsRes.ok){
      setRecentLogs((logsRes.data as any)?.logs || []);
      setTotalLogs((logsRes.data as any)?.total || 0);
    } else { problems.push(`logs: ${logsRes.error}`); }
    if(problems.length === 3){
      setError('All requests failed');
    } else if(problems.length){
      setError(problems.join(' | '));
    } else { setError(null); }
    // Mark week loaded (only after finishing; even if partial errors we consider it attempted)
    lastLoadedWeekRef.current = weekStart;
    loadingWeekRef.current = null;
    setLoading(false);
  }
  useEffect(()=>{ loadAll(); }, [limit, offset, filterActivity, filterSource, order, date]);
  // Always attempt to load when weekStart changes (guard inside loadAll prevents redundant in-flight duplicates)
  useEffect(()=>{ if(lastLoadedWeekRef.current !== weekStart){ loadAll(); } }, [weekStart]);

  // Al cambiar la fecha, reiniciar offset a 0 (nueva semana)
  useEffect(()=>{ setOffset(0); }, [date]);

  // Listen for external creation events (e.g., from WeeklyScheduleTable modal)
  useEffect(()=>{
    function handler(){ loadAll(); }
    if(typeof window !== 'undefined'){
      window.addEventListener('timelog:created', handler as any);
    }
    return ()=>{
      if(typeof window !== 'undefined'){
        window.removeEventListener('timelog:created', handler as any);
      }
    };
  }, []);

  // Filter segments for selected date's weekday
  const weekday = useMemo(()=>{
    const dt = new Date(date + 'T00:00:00Z');
    const day = dt.getUTCDay(); // 0=Sun..6=Sat; convert to 1..7 Mon..Sun
    return day === 0 ? 7 : day; // Sunday->7
  }, [date]);

  // Segments matching selected date's weekday. If an activity is selected, we show:
  //  - segments with no activity (neutral placeholders)
  //  - segments whose activityId matches the selected activity
  const segmentsForDay = useMemo(()=> {
    const base = segments.filter(s=>s.weekday===weekday);
    if(!activityId) return base;
    return base.filter(s=> !s.activityId || s.activityId === activityId);
  }, [segments, weekday, activityId]);

  // Auto-select segment when exactly one candidate remains after filtering (if enabled)
  useEffect(()=>{
    if(!autoSelectEnabled){ setAutoSelected(false); return; }
    if(segmentsForDay.length === 1){
      const only = segmentsForDay[0];
      if(only.id !== segmentId){
        setSegmentId(only.id);
        if(!userEditedTime){
          setStart(minutesToHHMM(only.startMinute));
          setEnd(minutesToHHMM(only.endMinute));
        }
        if(only.activityId) setActivityId(only.activityId);
        setSource('PLANNED');
        setAutoSelected(true);
      } else {
        setAutoSelected(true);
      }
    } else {
      if(segmentId && !segmentsForDay.some(s=>s.id===segmentId)){
        setSegmentId('');
      }
      setAutoSelected(false);
    }
  }, [segmentsForDay, segmentId, autoSelectEnabled, userEditedTime]);

  // Reset manual edit flag when changing date or activity
  useEffect(()=>{ setUserEditedTime(false); }, [date, activityId]);

  function onSelectSegment(id: string){
    setSegmentId(id);
    if(!id){ return; }
    const seg = segments.find(s=>s.id===id);
    if(seg){
      if(!userEditedTime){
        setStart(minutesToHHMM(seg.startMinute));
        setEnd(minutesToHHMM(seg.endMinute));
      }
      if(seg.activityId) setActivityId(seg.activityId);
      setSource('PLANNED');
    }
  }

  async function submit(e: React.FormEvent){
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const startedAt = combineDateAndTime(date, start);
      const endedAt = combineDateAndTime(date, end);
      if(hhmmToMinutes(end) <= hhmmToMinutes(start)) throw new Error('End must be after Start');
      const body = {
        activityId: activityId || null,
        segmentId: segmentId || null,
        date: date,
        startedAt,
        endedAt,
        partial,
        source,
        comment: comment.trim() || null
      };
  const res = await apiFetch('/api/logs', { method: 'POST', json: body });
  if(!res.ok) throw new Error(res.error || 'Save failed');
      await loadAll();
      if(typeof window !== 'undefined'){
        window.dispatchEvent(new CustomEvent('timelog:created'));
      }
  addToast({ type:'success', message:'Created log' });
      setStart('09:00'); setEnd('10:00'); setPartial(false); setComment(''); setSegmentId('');
  } catch(e:any){ setError(e.message); addToast({ type:'error', message: e.message || 'Failed to create log' }); }
    finally { setSaving(false); }
  }

  async function startEdit(log: any){
    setEditingLogId(log.id);
    // populate form fields for convenience
    const dateISO = log.date.substring(0,10);
    setDate(dateISO);
    setStart(log.startedAt.substring(11,16));
    setEnd(log.endedAt.substring(11,16));
    setActivityId(log.activityId || '');
    setSegmentId(log.segmentId || '');
    setSource(log.source);
    setPartial(!!log.partial);
    setComment(log.comment || '');
  }

  async function cancelEdit(){
    setEditingLogId(null);
    setComment('');
  }

  async function saveEdit(e: React.FormEvent){
    e.preventDefault(); if(!editingLogId) return; setEditSaving(true); setError(null);
    try {
      const startedAt = combineDateAndTime(date, start);
      const endedAt = combineDateAndTime(date, end);
      if(hhmmToMinutes(end) <= hhmmToMinutes(start)) throw new Error('End must be after Start');
      const body = {
        activityId: activityId || null,
        segmentId: segmentId || null,
        date,
        startedAt,
        endedAt,
        partial,
        source,
        comment: comment.trim() || null
      };
  const res = await apiFetch(`/api/logs?id=${editingLogId}`, { method:'PATCH', json: body });
  if(!res.ok) throw new Error(res.error || 'Update failed');
      await loadAll();
      if(typeof window !== 'undefined'){
        window.dispatchEvent(new CustomEvent('timelog:created'));
      }
  addToast({ type:'success', message:'Updated log' });
      setEditingLogId(null);
      setComment('');
  } catch(e:any){ setError(e.message); addToast({ type:'error', message: e.message || 'Failed to update log' }); }
    finally { setEditSaving(false); }
  }

  async function removeLog(id: string){
    if(pendingDeleteId !== id){
      setPendingDeleteId(id);
      setTimeout(()=>{ setPendingDeleteId(p=> p===id ? null : p); }, 4000);
      return;
    }
    try {
  const res = await apiFetch(`/api/logs?id=${id}`, { method:'DELETE' });
  if(!res.ok) throw new Error(res.error || 'Delete failed');
      await loadAll();
      if(typeof window !== 'undefined'){
        window.dispatchEvent(new CustomEvent('timelog:created'));
      }
  addToast({ type:'success', message:'Deleted log' });
      if(editingLogId === id) setEditingLogId(null);
  } catch(e:any){ setError(e.message); addToast({ type:'error', message: e.message || 'Failed to delete log' }); }
  }

  return (
  <div className="space-y-6">
      {/* Active week banner */}
      <ActiveWeekBanner weekStart={weekStart} />
      <div className="flex items-center gap-3">
        <h1 className="tt-heading-page mr-auto">Log Time</h1>
        <div className="flex items-center gap-1 text-[10px]">
          <button type="button" onClick={()=>{ gotoPrevWeek(); }} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">◀</button>
          <button type="button" onClick={()=>{ gotoThisWeek(); setDate(isoDate(new Date())); }} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">Hoy</button>
          <button type="button" onClick={()=>{ gotoNextWeek(); }} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">▶</button>
        </div>
        <div className="flex items-center gap-1 ml-2" aria-label="Units switch">
          <button type="button" onClick={()=>setUnit('min')} className={`tt-badge ${unit==='min' ? '' : 'opacity-60'}`}>Min</button>
          <button type="button" onClick={()=>setUnit('hr')} className={`tt-badge ${unit==='hr' ? '' : 'opacity-60'}`}>Hours</button>
        </div>
        {/* Removed load counter badge, spinner inline cluster, and manual Reload button */}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm">Loading...</div>}
      <div className="grid gap-8 md:grid-cols-2 items-start">
      {!loading && (
        <form onSubmit={editingLogId ? saveEdit : submit} className="tt-panel tt-panel-padding space-y-4">
          <div className="tt-form-grid text-xs">
            <label className="space-y-1 tt-form-span-2">
              <span className="tt-label">Date</span>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="tt-input" />
            </label>
            <label className="space-y-1">
              <span className="tt-label">Start</span>
              <input type="time" value={start} onChange={e=>{ setStart(e.target.value); setUserEditedTime(true); }} required className="tt-input" />
            </label>
            <label className="space-y-1">
              <span className="tt-label">End</span>
              <input type="time" value={end} onChange={e=>{ setEnd(e.target.value); setUserEditedTime(true); }} required className="tt-input" />
            </label>
            <label className="space-y-1 tt-form-span-3">
              <span className="tt-label">Activity</span>
              <select value={activityId} onChange={e=>{ setActivityId(e.target.value); setSegmentId(''); setUserEditedTime(false); }} className="tt-input">
                <option value="">-- None --</option>
                {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {!activities.length && !loading && !error && (
                <div className="text-[10px] text-amber-600 mt-1">No activities loaded. Create one in Activities page.</div>
              )}
            </label>
            <label className="space-y-1 tt-form-span-3">
              <span className="tt-label flex items-center gap-2">Segment <span className="text-[10px] font-normal text-gray-400">(optional)</span></span>
              <select value={segmentId} onChange={e=>onSelectSegment(e.target.value)} className="tt-input">
                <option value="">-- None --</option>
                {segmentsForDay.map(s=> <option key={s.id} value={s.id}>{minutesToHHMM(s.startMinute)}-{minutesToHHMM(s.endMinute)} {s.activity?.name || ''}</option>)}
              </select>
              {autoSelected && (
                <span className="relative group inline-flex items-center mt-1 tt-badge" data-variant="blue">
                  auto
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white px-2 py-1 rounded text-[10px] z-10 shadow">
                    Selected automatically because it is the only matching segment for date & activity
                  </span>
                </span>
              )}
            </label>
            <div className="tt-form-span-3 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={autoSelectEnabled} onChange={e=>{ setAutoSelectEnabled(e.target.checked); if(typeof window !== 'undefined'){ window.localStorage.setItem('logs_auto_select_segments', e.target.checked ? '1':'0'); } if(!e.target.checked) setAutoSelected(false); }} className="h-3 w-3" />
                <span>Auto-select segment</span>
              </label>
              {userEditedTime && <span className="tt-badge" data-variant="amber">custom time</span>}
              {userEditedTime && segmentId && (
                <button type="button" onClick={resetToSegmentTimes} className="tt-badge" data-variant="blue">
                  Reset segment times
                </button>
              )}
            </div>
            <label className="space-y-1">
              <span className="tt-label">Source</span>
              <select value={source} onChange={e=>setSource(e.target.value as Source)} className="tt-input">
                {SOURCES.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1 flex items-end gap-2">
              <span className="tt-label">Partial</span>
              <input type="checkbox" checked={partial} onChange={e=>setPartial(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="space-y-1 tt-form-span-3">
              <span className="tt-label">Comment</span>
              <input type="text" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional comment" className="tt-input" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            {editingLogId && (
              <button type="button" onClick={cancelEdit} className="text-xs px-2 py-1 rounded border dark:border-gray-600">Cancel</button>
            )}
            <button disabled={editingLogId ? editSaving : saving} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
              {editingLogId ? (editSaving ? 'Updating...' : 'Update Log') : (saving ? 'Saving...' : 'Add Log')}
            </button>
          </div>
        </form>
      )}

      {!loading && (
        <div className="tt-panel tt-panel-padding space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="text-sm font-medium mr-auto">This Week Logs</h2>
            <div className="flex flex-col text-[10px] gap-1">
              <label className="flex flex-col gap-0.5">
                <span className="uppercase tracking-wide text-gray-500">Activity</span>
                <select value={filterActivity} onChange={e=>{ setOffset(0); setFilterActivity(e.target.value); }} className="border rounded px-1 py-0.5 dark:bg-gray-950 dark:border-gray-700">
                  <option value="">All</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col text-[10px] gap-1">
              <label className="flex flex-col gap-0.5">
                <span className="uppercase tracking-wide text-gray-500">Source</span>
                <select value={filterSource} onChange={e=>{ setOffset(0); setFilterSource(e.target.value); }} className="border rounded px-1 py-0.5 dark:bg-gray-950 dark:border-gray-700">
                  <option value="">All</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col text-[10px] gap-1">
              <label className="flex flex-col gap-0.5">
                <span className="uppercase tracking-wide text-gray-500">Limit</span>
                <select value={limit} onChange={e=>{ setOffset(0); setLimit(Number(e.target.value)); }} className="border rounded px-1 py-0.5 dark:bg-gray-950 dark:border-gray-700">
                  {[12,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col text-[10px] gap-1">
              <label className="flex flex-col gap-0.5">
                <span className="uppercase tracking-wide text-gray-500">Order</span>
                <select value={order} onChange={e=>{ const val = e.target.value as 'asc' | 'desc'; setOffset(0); setOrder(val); if(typeof window !== 'undefined'){ window.localStorage.setItem('logs_order', val); } }} className="border rounded px-1 py-0.5 dark:bg-gray-950 dark:border-gray-700">
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>Total: {totalLogs}</span>
            <div className="flex gap-2 items-center">
              <button type="button" disabled={offset===0} onClick={()=>setOffset(o=>Math.max(0,o-limit))} className="px-2 py-0.5 border rounded disabled:opacity-40 dark:border-gray-600">Prev</button>
              <span>{Math.floor(offset/limit)+1} / {Math.max(1, Math.ceil(totalLogs/limit))}</span>
              <button type="button" disabled={offset+limit >= totalLogs} onClick={()=>setOffset(o=> o+limit)} className="px-2 py-0.5 border rounded disabled:opacity-40 dark:border-gray-600">Next</button>
            </div>
          </div>
          <div className="space-y-1 text-xs max-h-[520px] overflow-auto pr-1">
            {recentLogs.map(l => {
              const act = l.activity as Activity | undefined;
              const mins = Math.round((new Date(l.endedAt).getTime()-new Date(l.startedAt).getTime())/60000);
              return (
                <div key={l.id} className={`flex flex-wrap gap-2 items-center border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 ${editingLogId===l.id ? 'ring-1 ring-blue-400' : ''}`}>
                  <span className="font-mono">{l.startedAt.substring(11,16)}-{l.endedAt.substring(11,16)}</span>
                  <span className="tt-badge" data-size="sm">{unit==='min' ? fmtMinutes(mins) : fmtHoursMinutes(mins)}</span>
                  {act && (
                    <span className="tt-badge" data-size="sm">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: act.color || '#666' }} />
                      <span className="leading-none">{act.name}</span>
                    </span>
                  )}
                  {l.source !== 'PLANNED' && <span className="tt-badge" data-size="sm" data-variant="blue">{l.source}</span>}
                  {l.partial && <span className="tt-badge" data-size="sm" data-variant="amber">partial</span>}
                  {l.comment && <span className="truncate max-w-[160px] text-gray-500">{l.comment}</span>}
                  <div className="ml-auto flex gap-1">
                    {pendingDeleteId === l.id ? (
                      <>
                        <button onClick={()=>removeLog(l.id)} className="tt-badge" data-variant="red">Confirm?</button>
                        <button onClick={()=>setPendingDeleteId(null)} className="tt-badge" data-variant="neutral">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>startEdit(l)} className="tt-badge" data-size="sm">Edit</button>
                        <button onClick={()=>removeLog(l.id)} className="tt-badge" data-size="sm" data-variant="red">Del</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {recentLogs.length===0 && !loading && (
              <div className="text-xs text-gray-500">
                {(filterActivity || filterSource)
                  ? 'No logs match the selected filters for this week.'
                  : 'No logs in this week yet.'}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

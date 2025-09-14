"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { minutesToHHMM, hhmmToMinutes, WEEKDAY_NAMES_SHORT, isoDate, combineDateAndTime } from '../../lib/time';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; notes: string | null; activity?: Activity | null; }

const SOURCES = ['PLANNED','ADHOC','MAKEUP'] as const;

type Source = typeof SOURCES[number];

export default function LogTimeForm(){
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

  function resetToSegmentTimes(){
    if(!segmentId) return;
    const seg = segments.find(s=>s.id===segmentId);
    if(!seg) return;
    setStart(minutesToHHMM(seg.startMinute));
    setEnd(minutesToHHMM(seg.endMinute));
    setUserEditedTime(false);
  }

  async function loadAll(){
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', String(limit));
      qs.set('offset', String(offset));
      if(filterActivity) qs.set('activityId', filterActivity);
      if(filterSource) qs.set('source', filterSource);
      if(order) qs.set('order', order);
      const [actRes, segRes, logsRes] = await Promise.all([
        fetch('/api/activities').then(r=>r.json()),
        fetch('/api/schedule/segments').then(r=>r.json()),
        fetch('/api/logs?'+qs.toString()).then(r=>r.json())
      ]);
      if(actRes.error) throw new Error(actRes.error);
      if(segRes.error) throw new Error(segRes.error);
      if(logsRes.error) throw new Error(logsRes.error);
      setActivities(actRes.activities || []);
      setSegments(segRes.segments || []);
      setRecentLogs(logsRes.logs || []);
      setTotalLogs(logsRes.total || 0);
    } catch(e:any){ setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ loadAll(); }, [limit, offset, filterActivity, filterSource, order]);

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
      const res = await fetch('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Save failed');
      // Insert into recent logs local list
  // refetch to maintain ordering and counts
  await loadAll();
      // Reset minimal fields (keep date to speed input)
      setStart('09:00'); setEnd('10:00'); setPartial(false); setComment(''); setSegmentId('');
    } catch(e:any){ setError(e.message); }
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
  const res = await fetch(`/api/logs?id=${editingLogId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Update failed');
  await loadAll();
      setEditingLogId(null);
      setComment('');
    } catch(e:any){ setError(e.message); }
    finally { setEditSaving(false); }
  }

  async function removeLog(id: string){
    if(pendingDeleteId !== id){
      setPendingDeleteId(id);
      setTimeout(()=>{ setPendingDeleteId(p=> p===id ? null : p); }, 4000);
      return;
    }
    try {
      const res = await fetch(`/api/logs?id=${id}`, { method:'DELETE' });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Delete failed');
      await loadAll();
      if(editingLogId === id) setEditingLogId(null);
    } catch(e:any){ setError(e.message); }
  }

  return (
  <div className="space-y-6">
      <h1 className="text-lg font-semibold">Log Time</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm">Loading...</div>}
      <div className="grid gap-8 md:grid-cols-2 items-start">
      {!loading && (
        <form onSubmit={editingLogId ? saveEdit : submit} className="space-y-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1 col-span-2">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Date</span>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Start</span>
              <input type="time" value={start} onChange={e=>{ setStart(e.target.value); setUserEditedTime(true); }} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">End</span>
              <input type="time" value={end} onChange={e=>{ setEnd(e.target.value); setUserEditedTime(true); }} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-3">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Activity</span>
              <select value={activityId} onChange={e=>{ setActivityId(e.target.value); setSegmentId(''); setUserEditedTime(false); }} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
                <option value="">-- None --</option>
                {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-3">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-2">Segment <span className="text-[10px] font-normal text-gray-400">(optional)</span></span>
              <select value={segmentId} onChange={e=>onSelectSegment(e.target.value)} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
                <option value="">-- None --</option>
                {segmentsForDay.map(s=> <option key={s.id} value={s.id}>{minutesToHHMM(s.startMinute)}-{minutesToHHMM(s.endMinute)} {s.activity?.name || ''}</option>)}
              </select>
              {autoSelected && (
                <span className="relative group inline-flex items-center mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 cursor-help">
                  auto
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white px-2 py-1 rounded text-[10px] z-10 shadow">
                    Selected automatically because it is the only matching segment for date & activity
                  </span>
                </span>
              )}
            </label>
            <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={autoSelectEnabled} onChange={e=>{ setAutoSelectEnabled(e.target.checked); if(typeof window !== 'undefined'){ window.localStorage.setItem('logs_auto_select_segments', e.target.checked ? '1':'0'); } if(!e.target.checked) setAutoSelected(false); }} className="h-3 w-3" />
                <span>Auto-select segment</span>
              </label>
              {userEditedTime && <span className="text-[10px] text-amber-600">custom time</span>}
              {userEditedTime && segmentId && (
                <button type="button" onClick={resetToSegmentTimes} className="text-[10px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                  Reset segment times
                </button>
              )}
            </div>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Source</span>
              <select value={source} onChange={e=>setSource(e.target.value as Source)} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
                {SOURCES.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1 flex items-end gap-2">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Partial</span>
              <input type="checkbox" checked={partial} onChange={e=>setPartial(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-3">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Comment</span>
              <input type="text" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional comment" className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
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
        <div className="md:border md:border-gray-200 md:dark:border-gray-700 md:rounded md:p-4 md:bg-white md:dark:bg-gray-900 md:shadow-sm space-y-3">
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
            {recentLogs.map(l => (
              <div key={l.id} className={`flex flex-wrap gap-2 items-center border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 ${editingLogId===l.id ? 'ring-1 ring-blue-400' : ''}`}>
                <span className="font-mono">{l.startedAt.substring(11,16)}-{l.endedAt.substring(11,16)}</span>
                <span className="text-[10px] text-gray-500">{Math.round((new Date(l.endedAt).getTime()-new Date(l.startedAt).getTime())/60000)}m</span>
                {l.source !== 'PLANNED' && <span className="px-1 rounded bg-gray-100 dark:bg-gray-800">{l.source}</span>}
                {l.partial && <span className="text-amber-600">partial</span>}
                {l.comment && <span className="truncate max-w-[160px] text-gray-500">{l.comment}</span>}
                <div className="ml-auto flex gap-1">
                  {pendingDeleteId === l.id ? (
                    <>
                      <button onClick={()=>removeLog(l.id)} className="px-1 text-xs text-red-700 bg-red-100 dark:bg-red-900/40 rounded">Confirm?</button>
                      <button onClick={()=>setPendingDeleteId(null)} className="px-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>startEdit(l)} className="px-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>
                      <button onClick={()=>removeLog(l.id)} className="px-1 text-xs text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/30">Del</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {recentLogs.length===0 && !loading && <div className="text-xs text-gray-500">No logs yet</div>}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

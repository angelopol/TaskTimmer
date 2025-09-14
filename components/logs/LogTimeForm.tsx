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

  async function loadAll(){
    setLoading(true); setError(null);
    try {
      const [actRes, segRes, logsRes] = await Promise.all([
        fetch('/api/activities').then(r=>r.json()),
        fetch('/api/schedule/segments').then(r=>r.json()),
        fetch('/api/logs').then(r=>r.json())
      ]);
      if(actRes.error) throw new Error(actRes.error);
      if(segRes.error) throw new Error(segRes.error);
      if(logsRes.error) throw new Error(logsRes.error);
      setActivities(actRes.activities || []);
      setSegments(segRes.segments || []);
      setRecentLogs(logsRes.logs || []);
    } catch(e:any){ setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ loadAll(); }, []);

  // Filter segments for selected date's weekday
  const weekday = useMemo(()=>{
    const dt = new Date(date + 'T00:00:00Z');
    const day = dt.getUTCDay(); // 0=Sun..6=Sat; convert to 1..7 Mon..Sun
    return day === 0 ? 7 : day; // Sunday->7
  }, [date]);

  const segmentsForDay = useMemo(()=> segments.filter(s=>s.weekday===weekday), [segments, weekday]);

  function onSelectSegment(id: string){
    setSegmentId(id);
    if(!id){ return; }
    const seg = segments.find(s=>s.id===id);
    if(seg){
      setStart(minutesToHHMM(seg.startMinute));
      setEnd(minutesToHHMM(seg.endMinute));
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
      setRecentLogs(l => [...l, data.log]);
      // Reset minimal fields (keep date to speed input)
      setStart('09:00'); setEnd('10:00'); setPartial(false); setComment(''); setSegmentId('');
    } catch(e:any){ setError(e.message); }
    finally { setSaving(false); }
  }

  return (
  <div className="space-y-6">
      <h1 className="text-lg font-semibold">Log Time</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm">Loading...</div>}
      {!loading && (
        <form onSubmit={submit} className="space-y-4 max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1 col-span-2">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Date</span>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Start</span>
              <input type="time" value={start} onChange={e=>setStart(e.target.value)} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">End</span>
              <input type="time" value={end} onChange={e=>setEnd(e.target.value)} required className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
            </label>
            <label className="space-y-1 col-span-2 sm:col-span-3">
              <span className="block text-[11px] uppercase tracking-wide text-gray-500">Activity</span>
              <select value={activityId} onChange={e=>setActivityId(e.target.value)} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
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
            </label>
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
            <button disabled={saving} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : 'Add Log'}</button>
          </div>
        </form>
      )}

      {!loading && recentLogs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2">This Week Logs</h2>
          <div className="space-y-1 text-xs">
            {recentLogs.slice().reverse().slice(0,12).map(l => (
              <div key={l.id} className="flex gap-2 items-center border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900">
                <span className="font-mono">{l.startedAt.substring(11,16)}-{l.endedAt.substring(11,16)}</span>
                {l.source !== 'PLANNED' && <span className="px-1 rounded bg-gray-100 dark:bg-gray-800">{l.source}</span>}
                {l.partial && <span className="text-amber-600">partial</span>}
                {l.comment && <span className="truncate max-w-[160px] text-gray-500">{l.comment}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

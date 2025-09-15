"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../ThemeProvider';
import { minutesToHHMM, hhmmToMinutes, WEEKDAY_NAMES_SHORT } from '../../lib/time';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; notes: string | null; activity?: Activity | null; }

interface FormState {
  id?: string;
  weekday: number;
  start: string; // HH:MM
  end: string;   // HH:MM
  activityId: string | '';
  notes: string;
}

const weekdayNames = [...WEEKDAY_NAMES_SHORT];

export default function ScheduleSegmentsClient(){
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterWeekday, setFilterWeekday] = useState<number | 'all'>('all');
  const [pendingDeleteSegmentId, setPendingDeleteSegmentId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true); setError(null);
    try {
      const [segRes, actRes] = await Promise.all([
        fetch('/api/schedule/segments').then(r=>r.json()),
        fetch('/api/activities').then(r=>r.json())
      ]);
      if(segRes.error) throw new Error(segRes.error);
      if(actRes.error) throw new Error(actRes.error);
      setSegments(segRes.segments || []);
      setActivities(actRes.activities || []);
    } catch(e:any){ setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ loadAll(); }, []);

  const grouped = useMemo(()=>{
    const map: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of segments) map[s.weekday].push(s);
    return map;
  }, [segments]);

  function startCreate(weekday: number){
    setEditing({ weekday, start: '09:00', end: '10:00', activityId: '', notes: '' });
  }
  function startEdit(s: Segment){
    setEditing({ id: s.id, weekday: s.weekday, start: minutesToHHMM(s.startMinute), end: minutesToHHMM(s.endMinute), activityId: s.activityId || '', notes: s.notes || '' });
  }
  function reset(){ setEditing(null); }

  async function submit(e: React.FormEvent){
    e.preventDefault(); if(!editing) return; setSaving(true); setError(null);
    try {
      const body = {
        weekday: editing.weekday,
        startMinute: hhmmToMinutes(editing.start),
        endMinute: hhmmToMinutes(editing.end),
        activityId: editing.activityId || null,
        notes: editing.notes.trim() || null
      };
      let res;
      if(editing.id){
        res = await fetch(`/api/schedule/segments?id=${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        res = await fetch('/api/schedule/segments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if(!res.ok){
        if(data.error === 'Overlap with existing segment') throw new Error('Overlap with another segment');
        throw new Error(data.error || 'Save failed');
      }
      await loadAll();
      reset();
    } catch(e:any){ setError(e.message || 'Save error'); }
    finally { setSaving(false); }
  }

  async function remove(id: string){
    if(pendingDeleteSegmentId !== id){
      setPendingDeleteSegmentId(id);
      setTimeout(()=>{
        setPendingDeleteSegmentId(curr => curr === id ? null : curr);
      }, 4000);
      return;
    }
    try {
      const res = await fetch(`/api/schedule/segments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Delete failed');
      setSegments(s => s.filter(x=>x.id!==id));
      setPendingDeleteSegmentId(null);
    } catch(e:any){ setError(e.message); }
  }

  const displayWeekdays = (filterWeekday === 'all') ? [1,2,3,4,5,6,7] : [filterWeekday];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <h1 className="text-lg font-semibold">Schedule Segments</h1>
        <select value={filterWeekday} onChange={e=>setFilterWeekday(e.target.value==='all'?'all':Number(e.target.value))} className="border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700">
          <option value="all">All days</option>
          {weekdayNames.map((n,i)=>(<option key={i} value={i+1}>{n}</option>))}
        </select>
        {editing && <button onClick={reset} className="text-xs underline ml-2">Cancel</button>}
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm">Loading...</div>}
      {!loading && displayWeekdays.map(wd => (
        <div key={wd} className="border rounded-md p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-sm">{weekdayNames[wd-1]}</h2>
            {!editing && <button onClick={()=>startCreate(wd)} className="text-xs px-2 py-1 border rounded hover:bg-gray-100 dark:hover:bg-gray-800">Add</button>}
          </div>
          <div className="space-y-2">
            {grouped[wd].map(seg => (
              <div key={seg.id} className="flex flex-wrap items-center gap-2 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                <span className="font-mono whitespace-nowrap">{minutesToHHMM(seg.startMinute)}-{minutesToHHMM(seg.endMinute)}</span>
                {seg.activity && <span className="px-1 rounded bg-gray-100 dark:bg-gray-800" style={{borderLeft: seg.activity.color ? '4px solid '+seg.activity.color : undefined}}>{seg.activity.name}</span>}
                {seg.notes && <span className="italic text-gray-500 truncate max-w-[120px] sm:max-w-[160px]">{seg.notes}</span>}
                <div className="ml-auto flex gap-1">
                  <button onClick={()=>startEdit(seg)} className="px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>
                  <button onClick={()=>remove(seg.id)} className={"px-1 rounded " + (pendingDeleteSegmentId===seg.id ? 'bg-red-600 text-white animate-pulse' : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30')}>{pendingDeleteSegmentId===seg.id? 'Confirm' : 'Del'}</button>
                </div>
              </div>
            ))}
            {grouped[wd].length===0 && <div className="text-xs text-gray-500">No segments</div>}
          </div>
        </div>
      ))}

      {editing && (
        <form onSubmit={submit} className="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-4 w-full max-w-md shadow-xl space-y-3">
            <h3 className="font-medium text-sm mb-1">{editing.id ? 'Edit Segment' : 'New Segment'}</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1 col-span-2">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">Weekday</span>
                <select value={editing.weekday} onChange={e=>setEditing({...editing, weekday:Number(e.target.value)})} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
                  {weekdayNames.map((n,i)=>(<option key={i} value={i+1}>{n}</option>))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">Start</span>
                <input required type="time" value={editing.start} onChange={e=>setEditing({...editing, start:e.target.value})} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">End</span>
                <input required type="time" value={editing.end} onChange={e=>setEditing({...editing, end:e.target.value})} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" />
              </label>
              <label className="space-y-1 col-span-2">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">Activity (optional)</span>
                <select value={editing.activityId} onChange={e=>setEditing({...editing, activityId:e.target.value})} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700">
                  <option value="">-- None --</option>
                  {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 col-span-2">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">Notes</span>
                <input maxLength={200} type="text" value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} className="w-full border rounded p-1 dark:bg-gray-950 dark:border-gray-700" placeholder="Optional notes" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={reset} className="text-xs px-2 py-1 border rounded dark:border-gray-600">Cancel</button>
              <button disabled={saving} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

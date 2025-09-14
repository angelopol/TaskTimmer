"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { minutesToHHMM, WEEKDAY_NAMES_LONG, combineDateAndTime } from '../../lib/time';
import { useToast } from '../toast/ToastProvider';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; activity?: Activity | null; }

const SOURCES = ['PLANNED','ADHOC','MAKEUP'] as const;
type Source = typeof SOURCES[number];

// We will produce a consolidated table:
// Rows = unique time ranges across week (merged identical adjacent minute ranges from segments definition)
// Each cell = activity name or LIBRE (empty) if no segment or segment with null activity.

export default function WeeklyScheduleTable(){
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Modal state
  const [open, setOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [useFullRange, setUseFullRange] = useState(true);
  const [startHHMM, setStartHHMM] = useState('');
  const [endHHMM, setEndHHMM] = useState('');
  const [activityId, setActivityId] = useState<string>('');
  const [partial, setPartial] = useState(false);
  const [source, setSource] = useState<Source>('PLANNED');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const { addToast } = useToast();
  const [segmentLoggedMinutes, setSegmentLoggedMinutes] = useState<Record<string, number>>({});
  const [usageUpdating, setUsageUpdating] = useState(false);
  const [hasLoadedUsage, setHasLoadedUsage] = useState(false);

  // Fetch logged minutes per segment (current week) after load & after creation
  async function refreshSegmentUsage(){
    setUsageUpdating(true);
    try {
      if(!segments.length){
        setSegmentLoggedMinutes({});
        return;
      }
      const ts = Date.now();
      const res = await fetch(`/api/segments/usage?ts=${ts}`, { cache: 'no-store' });
      const data = await res.json();
      if(res.ok){
        setSegmentLoggedMinutes(data.usage || {});
        setHasLoadedUsage(true);
      }
    } catch {
      // swallow for now; could add toast/addToast({type:'error', message:'Usage refresh failed'})
    } finally {
      setUsageUpdating(false);
    }
  }

  useEffect(()=>{
    (async ()=>{
      try {
        setLoading(true);
        const [segRes, actRes] = await Promise.all([
          fetch('/api/schedule/segments', { cache: 'no-store' }),
          fetch('/api/activities', { cache: 'no-store' })
        ]);
        const segData = await segRes.json();
        if(!segRes.ok) throw new Error(segData.error || 'Failed to load segments');
        const segs = segData.segments || [];
        setSegments(segs);
        const actData = await actRes.json();
        if(!actRes.ok) throw new Error(actData.error || 'Failed to load activities');
        setActivities(actData.activities || []);
        // Fetch usage immediately (avoid waiting for next tick)
        if(segs.length){
          try {
            const ts = Date.now();
            const usageRes = await fetch(`/api/segments/usage?ts=${ts}`, { cache: 'no-store' });
            const usageData = await usageRes.json();
            if(usageRes.ok){
              setSegmentLoggedMinutes(usageData.usage || {});
              setHasLoadedUsage(true);
            }
          } catch {/* ignore usage error on first load */}
        }
      } catch(e:any){ setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // When a new log is created elsewhere listen to event to refresh usage map
  useEffect(()=>{
    function handler(){ refreshSegmentUsage(); }
    if(typeof window !== 'undefined') window.addEventListener('timelog:created', handler as any);
    return ()=> { if(typeof window !== 'undefined') window.removeEventListener('timelog:created', handler as any); };
  }, [segments]);

  // Build unique boundaries
  const rows = useMemo(()=>{
    if(segments.length===0) return [] as { start: number; end: number; }[];
    const boundaries = new Set<number>();
    for(const s of segments){
      boundaries.add(s.startMinute); boundaries.add(s.endMinute);
    }
    const sorted = Array.from(boundaries).sort((a,b)=>a-b);
    const intervals: { start:number; end:number; }[] = [];
    for(let i=0;i<sorted.length-1;i++){
      const start = sorted[i]; const end = sorted[i+1];
      if(end>start) intervals.push({ start, end });
    }
    return intervals;
  }, [segments]);

  // Map for quick lookup: weekday -> list of segments
  const byDay = useMemo(()=>{
    const map: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of segments) map[s.weekday].push(s);
    return map;
  }, [segments]);

  function cellActivity(weekday:number, start:number, end:number){
    // Find segment that fully covers this interval
    const seg = byDay[weekday].find(s=> s.startMinute <= start && s.endMinute >= end);
    if(!seg) return { seg: null, name: 'LIBRE', color: null };
    if(!seg.activityId) return { seg, name: 'LIBRE', color: null };
    return { seg, name: seg.activity?.name || 'UNKNOWN', color: seg.activity?.color || null };
  }

  function weekDateForWeekday(weekday:number){
    // weekday 1..7 Monday..Sunday -> compute date (YYYY-MM-DD) for current week
    const now = new Date();
    const day = now.getDay(); // 0 Sun .. 6 Sat
    // compute Monday
    const diffToMonday = (day === 0 ? -6 : 1 - day); // if Sunday (0) -> -6 days
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const target = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (weekday-1));
    return target.toISOString().substring(0,10);
  }

  function openModal(seg: Segment){
    setSelectedSegment(seg);
    setUseFullRange(true);
    setStartHHMM(minutesToHHMM(seg.startMinute));
    setEndHHMM(minutesToHHMM(seg.endMinute));
    setActivityId(seg.activityId || '');
    setPartial(false);
    setSource('PLANNED');
    setComment('');
    setModalError(null);
    setOpen(true);
  }

  function closeModal(){
    if(saving) return;
    setOpen(false);
    setSelectedSegment(null);
  }

  async function submitModal(e: React.FormEvent){
    e.preventDefault(); if(!selectedSegment) return; setSaving(true); setModalError(null);
    try {
      // Validate times inside segment
      const startMin = parseInt(startHHMM.slice(0,2))*60 + parseInt(startHHMM.slice(3));
      const endMin = parseInt(endHHMM.slice(0,2))*60 + parseInt(endHHMM.slice(3));
      if(endMin <= startMin) throw new Error('End must be after start');
      if(startMin < selectedSegment.startMinute || endMin > selectedSegment.endMinute){
        throw new Error('Time range must stay within segment bounds');
      }
      const date = weekDateForWeekday(selectedSegment.weekday);
      const startedAt = combineDateAndTime(date, startHHMM);
      const endedAt = combineDateAndTime(date, endHHMM);
      const body = {
        activityId: activityId || null,
        segmentId: selectedSegment.id,
        date,
        startedAt,
        endedAt,
        partial,
        source,
        comment: comment.trim() || null
      };
      const res = await fetch('/api/logs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Save failed');
      // Emit custom event for other components (e.g., LogTimeForm) to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('timelog:created'));
      }
      closeModal();
      addToast({ message:'Log created', type:'success'});
      refreshSegmentUsage();
    } catch(e:any){ setModalError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Weekly Schedule Table</h2>
      {loading && <div className="text-sm">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded">
          <table className="text-xs min-w-full border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">Actividad</th>
                {WEEKDAY_NAMES_LONG.map((d,i)=>(
                  <th key={d} className="px-2 py-2 font-medium text-left">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>{
                const label = `${minutesToHHMM(r.start)} - ${minutesToHHMM(r.end)}`;
                return (
                  <tr key={r.start+"-"+r.end} className="even:bg-white odd:bg-gray-50 dark:even:bg-gray-900 dark:odd:bg-gray-950">
                    <td className="px-2 py-1 font-mono text-[11px] sticky left-0 bg-inherit whitespace-nowrap">{label}</td>
                    {Array.from({length:7}, (_,idx)=> idx+1).map(day => {
                      const act = cellActivity(day, r.start, r.end);
                      const bg = act.name==='LIBRE' ? '' : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer';
                      return (
                        <td key={day} className={`relative px-2 py-1 whitespace-nowrap ${act.seg ? bg : ''}`}
                          onClick={()=> act.seg && openModal(act.seg)}
                        >
                          <span className="font-medium" style={ act.color ? { color: act.color } : undefined }>
                            {act.name}
                          </span>
                          {act.seg && act.seg.activityId && (
                            <span className={`block text-[9px] mt-0.5 text-gray-500 ${usageUpdating ? 'opacity-60' : ''}`}>
                              {!hasLoadedUsage ? '…' : (usageUpdating ? 'updating…' : `${segmentLoggedMinutes[act.seg.id] ? segmentLoggedMinutes[act.seg.id] : 0}m / ${(act.seg.endMinute - act.seg.startMinute)}m`)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length===0 && (
                <tr><td colSpan={8} className="text-center py-6 text-gray-500">No segments configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {open && selectedSegment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg w-full max-w-md p-4 space-y-4">
            <div className="flex items-start">
              <h3 className="text-sm font-semibold mr-auto">Log segment</h3>
              <button onClick={closeModal} className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>Segment: {minutesToHHMM(selectedSegment.startMinute)} - {minutesToHHMM(selectedSegment.endMinute)}</div>
              <div>Weekday: {WEEKDAY_NAMES_LONG[selectedSegment.weekday-1]}</div>
              <div>Planned Activity: {selectedSegment.activity?.name || '—'}</div>
            </div>
            {modalError && <div className="text-xs text-red-600">{modalError}</div>}
            <form onSubmit={submitModal} className="space-y-3">
              <label className="block text-[11px] space-y-1">
                <span className="uppercase tracking-wide text-gray-500">Activity</span>
                <select value={activityId} onChange={e=>setActivityId(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700">
                  <option value="">-- None --</option>
                  {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={useFullRange} onChange={e=>{ setUseFullRange(e.target.checked); if(e.target.checked && selectedSegment){ setStartHHMM(minutesToHHMM(selectedSegment.startMinute)); setEndHHMM(minutesToHHMM(selectedSegment.endMinute)); } }} className="h-3 w-3" />
                <span>Use full segment range</span>
              </label>
              {!useFullRange && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[11px]">
                    <span className="uppercase tracking-wide text-gray-500">Start</span>
                    <input type="time" required value={startHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setStartHHMM(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="uppercase tracking-wide text-gray-500">End</span>
                    <input type="time" required value={endHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setEndHHMM(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={partial} onChange={e=>setPartial(e.target.checked)} className="h-3 w-3" />
                  <span>Partial flag</span>
                </label>
                <label className="text-[11px] flex items-center gap-1">
                  <span>Source</span>
                  <select value={source} onChange={e=>setSource(e.target.value as Source)} className="border rounded px-1 py-0.5 text-[11px] dark:bg-gray-950 dark:border-gray-700">
                    {SOURCES.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-[11px]">
                <span className="uppercase tracking-wide text-gray-500">Comment</span>
                <input type="text" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional comment" className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} disabled={saving} className="text-xs px-2 py-1 rounded border dark:border-gray-600 disabled:opacity-50">Cancel</button>
                <button disabled={saving} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : 'Log Time'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../ThemeProvider';
import { minutesToHHMM, hhmmToMinutes, WEEKDAY_NAMES_SHORT } from '../../lib/time';
import { useToast } from '../toast/ToastProvider';
import { Button, IconButton } from '../../components/ui/Button';
import { IconAdd, IconEdit, IconTrash, IconClose, IconSave } from '../../components/ui/icons';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; notes: string | null; activity?: Activity | null; effectiveFrom: string; effectiveTo: string | null; }

interface FormState {
  id?: string;
  weekday: number;
  start: string; // HH:MM
  end: string;   // HH:MM
  activityId: string | '';
  notes: string;
  // Versioning UI (only used when editing existing segment)
  versioningMode?: 'now' | 'next-week' | 'custom-week';
  effectiveFromDate?: string; // YYYY-MM-DD when custom-week
}

const weekdayNames = [...WEEKDAY_NAMES_SHORT];

export default function ScheduleSegmentsClient(){
  const { addToast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterWeekday, setFilterWeekday] = useState<number | 'all'>('all');
  const [pendingDeleteSegmentId, setPendingDeleteSegmentId] = useState<string | null>(null);
  // Using global toast provider now
  // const [toasts, setToasts] = useState<{id:string; msg:string;}[]>([]);
  const [showFuture, setShowFuture] = useState(true);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(()=>{ setPortalEl(document.body); },[]);
  useEffect(()=>{
    if(!editing) return; const prev = document.body.style.overflow; document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow=prev; };
  },[editing]);

  // Replaced by global toast (addToast)

  const loadAll = async () => {
    setLoading(true); setError(null);
    try {
      const [segRes, actRes] = await Promise.all([
        fetch('/api/schedule/segments?mode=all').then(r=>r.json()),
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

  const todayMid = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; }, []);
  const activeSegments = useMemo(()=> segments.filter(s => {
    const ef = new Date(s.effectiveFrom); ef.setHours(0,0,0,0);
    if(ef > todayMid) return false;
    if(!s.effectiveTo) return true;
    const et = new Date(s.effectiveTo); et.setHours(0,0,0,0);
    return et >= todayMid;
  }), [segments, todayMid]);
  const futureSegments = useMemo(()=> segments.filter(s => {
    const ef = new Date(s.effectiveFrom); ef.setHours(0,0,0,0);
    return ef > todayMid;
  }), [segments, todayMid]);

  const futureByWeekday = useMemo(()=>{
    const m: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of futureSegments) m[s.weekday].push(s);
    return m;
  }, [futureSegments]);

  const grouped = useMemo(()=>{
    const map: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of activeSegments) map[s.weekday].push(s);
    return map;
  }, [activeSegments]);

  // Determine which active segments have at least one future overlapping version
  const activeHasFuture: Record<string, { date: string }> = useMemo(()=>{
    const result: Record<string,{date:string}> = {};
    for(const f of futureSegments){
      const fEf = new Date(f.effectiveFrom).toISOString().slice(0,10);
      for(const a of activeSegments){
        if(a.weekday !== f.weekday) continue;
        // overlap in minutes
        if(f.startMinute < a.endMinute && f.endMinute > a.startMinute){
          result[a.id] = result[a.id] ? (result[a.id].date < fEf ? result[a.id] : {date:fEf}) : {date:fEf};
        }
      }
    }
    return result;
  }, [futureSegments, activeSegments]);

  // Build quick diff between an active segment and earliest overlapping future
  function diffSummary(active: Segment, futures: Segment[]): string | null {
    if(!futures.length) return null;
    const sorted = [...futures].sort((a,b)=> new Date(a.effectiveFrom).getTime()-new Date(b.effectiveFrom).getTime());
    const f = sorted[0];
    const parts:string[] = [];
    if(active.startMinute !== f.startMinute || active.endMinute !== f.endMinute){
      if(active.startMinute !== f.startMinute) parts.push(`start ${minutesToHHMM(active.startMinute)}→${minutesToHHMM(f.startMinute)}`);
      if(active.endMinute !== f.endMinute) parts.push(`end ${minutesToHHMM(active.endMinute)}→${minutesToHHMM(f.endMinute)}`);
    }
    if(active.activityId !== f.activityId){
      const oldAct = activities.find(a=>a.id===active.activityId)?.name || (active.activityId? 'set':'none');
      const newAct = activities.find(a=>a.id===f.activityId)?.name || (f.activityId? 'set':'none');
      parts.push(`activity ${oldAct}→${newAct}`);
    }
    if((active.notes||'') !== (f.notes||'')) parts.push('notes changed');
    if(!parts.length) return 'No changes in future version';
    return parts.join(', ');
  }

  function startCreate(weekday: number){
    setEditing({ weekday, start: '09:00', end: '10:00', activityId: '', notes: '' });
  }
  function startEdit(s: Segment){
    setEditing({ id: s.id, weekday: s.weekday, start: minutesToHHMM(s.startMinute), end: minutesToHHMM(s.endMinute), activityId: s.activityId || '', notes: s.notes || '', versioningMode: 'now', effectiveFromDate: '' });
  }
  function reset(){ setEditing(null); }

  async function submit(e: React.FormEvent){
    e.preventDefault(); if(!editing) return; setSaving(true); setError(null);
    try {
      const body: any = {
        weekday: editing.weekday,
        startMinute: hhmmToMinutes(editing.start),
        endMinute: hhmmToMinutes(editing.end),
        activityId: editing.activityId || null,
        notes: editing.notes.trim() || null
      };
      if(editing.id){
        // Append versioning fields only in edit mode
        body.versioningMode = editing.versioningMode || 'now';
        if(editing.versioningMode === 'custom-week' && editing.effectiveFromDate){
          body.effectiveFromDate = editing.effectiveFromDate;
        }
      }
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
      if(editing.id && data.mode === 'versioned' && data.newEffectiveFrom){
  addToast({ message: `Scheduled future version (${data.newEffectiveFrom})`, type: 'success' });
      } else if(editing.id && data.mode === 'now') {
  addToast({ message: 'Updated segment', type: 'success' });
      } else if(!editing.id){
  addToast({ message: 'Created segment', type: 'success' });
      }
      await loadAll();
      reset();
  } catch(e:any){ setError(e.message || 'Save error'); addToast({ message: e.message || 'Failed to save segment', type: 'error' }); }
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
  } catch(e:any){ setError(e.message); addToast({ message: e.message || 'Failed to delete segment', type: 'error' }); }
  }

  const displayWeekdays = (filterWeekday === 'all') ? [1,2,3,4,5,6,7] : [filterWeekday];

  return (
    <div className="space-y-6 relative">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {/* Local toast system removed in favor of global provider */}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <h1 className="tt-heading-page text-lg">Schedule Segments</h1>
        <select value={filterWeekday} onChange={e=>setFilterWeekday(e.target.value==='all'?'all':Number(e.target.value))} className="border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700">
          <option value="all">All days</option>
          {weekdayNames.map((n,i)=>(<option key={i} value={i+1}>{n}</option>))}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={showFuture} onChange={e=>setShowFuture(e.target.checked)} />
          <span>Show future versions</span>
        </label>
  {editing && <Button variant="subtle" size="sm" onClick={reset} leftIcon={<IconClose className="w-3.5 h-3.5" />}>Cancel</Button>}
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="text-sm">Loading...</div>}
      {!loading && displayWeekdays.map(wd => (
        <div key={wd} className="tt-panel tt-panel-padding pt-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-sm tt-text-muted">{weekdayNames[wd-1]}</h2>
            {!editing && (
              <Button size="sm" variant="secondary" onClick={()=>startCreate(wd)} leftIcon={<IconAdd className="w-3.5 h-3.5" />}>Add</Button>
            )}
          </div>
          <div className="space-y-2">
            {grouped[wd].map(seg => {
              const futureInfo = activeHasFuture[seg.id];
              const futureStackFull = futureByWeekday[wd].filter(f => f.startMinute < seg.endMinute && f.endMinute > seg.startMinute);
              const futureStack = showFuture ? futureStackFull : [];
              const editDisabled = futureStack.length > 0;
              const diff = diffSummary(seg, futureStackFull);
              return (
                <div key={seg.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white/70 dark:bg-gray-900/70">
                    <span className="font-mono whitespace-nowrap">{minutesToHHMM(seg.startMinute)}-{minutesToHHMM(seg.endMinute)}</span>
                    {seg.activity && <span className="px-1 rounded bg-gray-100 dark:bg-gray-800" style={{borderLeft: seg.activity.color ? '4px solid '+seg.activity.color : undefined}}>{seg.activity.name}</span>}
                    {seg.notes && <span className="italic text-gray-500 truncate max-w-[120px] sm:max-w-[160px]">{seg.notes}</span>}
                    {futureInfo && (
                      <span className="text-[10px] px-1 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" title={`Future version scheduled for ${futureInfo.date}${diff? '\n'+diff:''}`}>Replaced {futureInfo.date}</span>
                    )}
                    <div className="ml-auto flex gap-1 items-center">
                      <IconButton
                        size="sm"
                        variant="subtle"
                        disabled={editDisabled}
                        onClick={()=>!editDisabled && startEdit(seg)}
                        icon={<IconEdit className="w-3.5 h-3.5" />}
                        label="Edit segment"
                        className={editDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                      />
                      <IconButton
                        size="sm"
                        variant={pendingDeleteSegmentId===seg.id ? 'danger' : 'subtle'}
                        onClick={()=>remove(seg.id)}
                        icon={<IconTrash className="w-3.5 h-3.5" />}
                        label={pendingDeleteSegmentId===seg.id? 'Confirm delete' : 'Delete segment'}
                        className={pendingDeleteSegmentId===seg.id ? 'animate-pulse' : ''}
                      />
                    </div>
                  </div>
                  {futureStack.length>0 && (
                    <div className="ml-4 border-l border-dashed border-gray-300 dark:border-gray-700 pl-3 space-y-1">
                      {futureStack.sort((a,b)=>a.startMinute-b.startMinute).map(f => (
                        <div key={f.id} className="flex flex-wrap items-center gap-2 text-[10px] border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30" title={diffSummary(seg,[f]) || undefined}>
                          <span className="font-mono">{minutesToHHMM(f.startMinute)}-{minutesToHHMM(f.endMinute)}</span>
                          {f.activity && <span className="px-1 rounded bg-gray-100 dark:bg-gray-800" style={{borderLeft: f.activity.color ? '4px solid '+f.activity.color : undefined}}>{f.activity.name}</span>}
                          <span className="text-indigo-700 dark:text-indigo-300">Future {new Date(f.effectiveFrom).toISOString().slice(0,10)}</span>
                          <div className="ml-auto flex gap-1">
                            <IconButton
                              size="sm"
                              variant="subtle"
                              onClick={()=>startEdit(f)}
                              icon={<IconEdit className="w-3 h-3" />}
                              label="Edit future segment"
                              className="hover:bg-indigo-100 dark:hover:bg-indigo-800/40"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {grouped[wd].length===0 && <div className="text-xs text-gray-500">No segments</div>}
          </div>
        </div>
      ))}

      {editing && portalEl && createPortal(
        <form onSubmit={submit} className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-4 w-full max-w-md shadow-xl space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
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
              {editing.id && (
                <div className="col-span-2 space-y-2 mt-1 border-t pt-2 border-gray-200 dark:border-gray-700">
                  <span className="block text-[11px] uppercase tracking-wide text-gray-500">Versioning</span>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input type="radio" name="versioning" value="now" checked={(editing.versioningMode||'now')==='now'} onChange={()=>setEditing({...editing, versioningMode:'now'})} />
                      <span>Update current template now (no history)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input type="radio" name="versioning" value="next-week" checked={editing.versioningMode==='next-week'} onChange={()=>setEditing({...editing, versioningMode:'next-week'})} />
                      <span>Apply starting next week ({(() => { const d = new Date(); const jsDay=d.getDay(); const days=((8-jsDay)%7)||7; d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); })()})</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer text-[11px]">
                      <input type="radio" name="versioning" value="custom-week" checked={editing.versioningMode==='custom-week'} onChange={()=>setEditing({...editing, versioningMode:'custom-week'})} />
                      <span className="flex flex-col gap-1">
                        <span>Apply starting custom week (Monday)</span>
                        {editing.versioningMode==='custom-week' && (
                          <input type="date" value={editing.effectiveFromDate||''} onChange={e=>setEditing({...editing, effectiveFromDate:e.target.value})} className="border rounded p-1 dark:bg-gray-950 dark:border-gray-700 text-[11px]" />
                        )}
                      </span>
                    </label>
                    {editing.versioningMode==='custom-week' && editing.effectiveFromDate && (()=>{ const d=new Date(editing.effectiveFromDate+'T00:00:00'); if(isNaN(d.getTime())) return <p className="text-red-600 text-[10px]">Invalid date</p>; if(d.getDay()!==1) return <p className="text-red-600 text-[10px]">Date must be a Monday</p>; return null; })()}
                    <p className="text-[10px] text-gray-500 leading-snug">Future versions keep the current template active until the Sunday before the new start.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="subtle" size="sm" onClick={reset} leftIcon={<IconClose className="w-3.5 h-3.5" />}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving} leftIcon={<IconSave className="w-3.5 h-3.5" />} loading={saving}>{saving ? 'Saving' : 'Save'}</Button>
            </div>
          </div>
        </form>, portalEl)}
    </div>
  );
}

"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { minutesToHHMM, hhmmToMinutes, WEEKDAY_NAMES_LONG } from '../../lib/time';
import { useToast } from '../toast/ToastProvider';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { DayPicker } from '../ui/DayPicker';
import { IconAdd, IconEdit, IconTrash } from '../ui/icons';

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

const weekdayNames = [...WEEKDAY_NAMES_LONG];

export default function ScheduleSegmentsClient(){
  const { addToast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay() || 7);
  const [pendingDeleteSegmentId, setPendingDeleteSegmentId] = useState<string | null>(null);
  // Using global toast provider now
  // const [toasts, setToasts] = useState<{id:string; msg:string;}[]>([]);
  const [showFuture, setShowFuture] = useState(true);

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
    for (const day of Object.values(map)) day.sort((a,b)=>a.startMinute-b.startMinute);
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
    setError(null);
    setEditing({ weekday, start: '09:00', end: '10:00', activityId: '', notes: '' });
  }
  function startEdit(s: Segment){
    setError(null);
    setEditing({ id: s.id, weekday: s.weekday, start: minutesToHHMM(s.startMinute), end: minutesToHHMM(s.endMinute), activityId: s.activityId || '', notes: s.notes || '', versioningMode: 'now', effectiveFromDate: '' });
  }
  function reset(){ setEditing(null); }

  async function submit(e: React.FormEvent){
    e.preventDefault(); if(!editing) return; setSaving(true); setError(null);
    try {
      if (hhmmToMinutes(editing.end) <= hhmmToMinutes(editing.start)) throw new Error('Choose an end time after the start time.');
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
        if(data.error === 'Overlap with existing segment') throw new Error('This overlaps another block.');
        throw new Error(data.error || 'Save failed');
      }
      if(editing.id && data.mode === 'versioned' && data.newEffectiveFrom){
  addToast({ message: `Change scheduled from ${data.newEffectiveFrom}.`, type: 'success' });
      } else if(editing.id && data.mode === 'now') {
  addToast({ message: 'Block updated.', type: 'success' });
      } else if(!editing.id){
  addToast({ message: 'Block added.', type: 'success' });
      }
      await loadAll();
      reset();
  } catch(e:any){ setError(e.message || 'Save error'); addToast({ message: e.message || 'Failed to save segment', type: 'error' }); }
    finally { setSaving(false); }
  }

  async function remove(id: string){
    if (saving) return;
    if(pendingDeleteSegmentId !== id){
      setPendingDeleteSegmentId(id);
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/schedule/segments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Delete failed');
      setSegments(s => s.filter(x=>x.id!==id));
      setPendingDeleteSegmentId(null);
      addToast({ message: 'Block deleted.', type: 'success' });
  } catch(e:any){ setError(e.message); addToast({ message: e.message || 'Failed to delete segment', type: 'error' }); }
    finally { setSaving(false); }
  }

  const nextMonday = (() => { const d = new Date(); const days = ((8-d.getDay())%7)||7; d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); })();
  const customDateError = editing?.versioningMode === 'custom-week' && editing.effectiveFromDate ? (() => {
    const d = new Date(editing.effectiveFromDate + 'T00:00:00');
    if(isNaN(d.getTime())) return 'Invalid date';
    return d.getDay() !== 1 ? 'Choose a Monday' : null;
  })() : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <DayPicker className="min-w-0 flex-1 !mx-0 !px-0 sm:hidden" value={selectedDay} onChange={setSelectedDay} />
        <p className="tt-text-muted hidden flex-1 text-sm sm:block">Blocks repeat every week.</p>
        <Menu label="Routine options" items={[{ label:'Show upcoming changes', checked:showFuture, onSelect:() => setShowFuture(v => !v) }]} />
        <Button className="max-sm:hidden" leftIcon={<IconAdd size={18} />} onClick={() => startCreate(selectedDay)}>Add block</Button>
      </div>
      {!editing && error && <ErrorState message={error} onRetry={loadAll} />}
      {loading ? <LoadingState label="Loading your routine…" /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[1,2,3,4,5,6,7].map(wd => (
          <section key={wd} className={'space-y-1.5 ' + (wd === selectedDay ? '' : 'max-sm:hidden')}>
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold">{weekdayNames[wd-1]}</h3>
              <Button variant="ghost" className="!min-h-8 !px-2 text-xs" leftIcon={<IconAdd size={14} />} onClick={()=>startCreate(wd)} aria-label={'Add time block for ' + weekdayNames[wd-1]}>Add</Button>
            </div>
            <ul className="tt-list">
              {grouped[wd].map(seg => {
                const futureInfo = activeHasFuture[seg.id];
                const futureStackFull = futureByWeekday[wd].filter(f => f.startMinute < seg.endMinute && f.endMinute > seg.startMinute);
                const futureStack = showFuture ? futureStackFull : [];
                const editDisabled = futureStackFull.length > 0;
                const diff = diffSummary(seg, futureStackFull);
                return (
                  <li key={seg.id}>
                    <div className="flex items-center pr-1">
                      <button type="button" className="tt-row tt-row-button min-w-0 flex-1" disabled={editDisabled} onClick={()=>startEdit(seg)}
                        title={editDisabled ? 'An upcoming change exists. Edit that one instead.' : undefined}>
                        <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ background:seg.activity?.color || 'var(--line-strong)' }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{seg.activity?.name || 'Open block'}</span>
                          <span className="tt-text-muted block truncate text-xs tabular-nums">{minutesToHHMM(seg.startMinute)}–{minutesToHHMM(seg.endMinute)}{seg.notes ? ' · ' + seg.notes : ''}</span>
                        </span>
                        {futureInfo && <span className="tt-badge shrink-0" data-variant="blue" title={diff || undefined}>Changes {futureInfo.date.slice(5)}</span>}
                      </button>
                      <Menu label="Block options" items={[
                        { label:'Edit', icon:<IconEdit size={17} />, disabled:editDisabled, onSelect:() => startEdit(seg) },
                        { label:'Delete', icon:<IconTrash size={17} />, danger:true, onSelect:() => { setError(null); setPendingDeleteSegmentId(seg.id); } }
                      ]} />
                    </div>
                    {futureStack.sort((a,b)=>a.startMinute-b.startMinute).map(f => (
                      <button key={f.id} type="button" onClick={()=>startEdit(f)} title={diffSummary(seg,[f]) || undefined}
                        className="flex w-full items-center gap-3 border-t border-dashed border-[var(--line)] bg-[var(--accent-soft)] py-2 pl-8 pr-4 text-left text-xs">
                        <span className="font-semibold text-[var(--accent-ink)]">From {new Date(f.effectiveFrom).toISOString().slice(0,10)}</span>
                        <span className="tt-text-muted min-w-0 flex-1 truncate tabular-nums">{minutesToHHMM(f.startMinute)}–{minutesToHHMM(f.endMinute)} · {f.activity?.name || 'Open block'}</span>
                        <IconEdit size={14} className="shrink-0 opacity-70" />
                      </button>
                    ))}
                  </li>
                );
              })}
              {grouped[wd].length===0 && <li className="tt-text-muted px-4 py-3 text-sm">No blocks.</li>}
            </ul>
          </section>
        ))}
      </div>}
      <button type="button" className="tt-fab sm:hidden" aria-label="Add block" onClick={() => startCreate(selectedDay)}><IconAdd size={24} /></button>

      <Dialog open={!!editing} onClose={reset} title={editing?.id ? 'Edit block' : 'New block'} busy={saving}>
      {editing && <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="tt-label">Day</span>
              <select value={editing.weekday} onChange={e=>setEditing({...editing, weekday:Number(e.target.value)})} className="tt-input">
                {weekdayNames.map((n,i)=>(<option key={i} value={i+1}>{n}</option>))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="tt-label">Start</span><input required type="time" value={editing.start} onChange={e=>setEditing({...editing, start:e.target.value})} className="tt-input" /></label>
              <label><span className="tt-label">End</span><input required type="time" value={editing.end} onChange={e=>setEditing({...editing, end:e.target.value})} className="tt-input" /></label>
            </div>
            <label className="block">
              <span className="tt-label">Activity</span>
              <select value={editing.activityId} onChange={e=>setEditing({...editing, activityId:e.target.value})} className="tt-input">
                <option value="">Open block (no activity)</option>
                {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="tt-label">Note</span>
              <input maxLength={200} type="text" value={editing.notes} onChange={e=>setEditing({...editing, notes:e.target.value})} className="tt-input" placeholder="Optional" />
            </label>
            {editing.id && (
              <fieldset className="space-y-1 border-t border-[var(--line)] pt-3">
                <legend className="tt-label pt-3">Apply change</legend>
                <label className="tt-check !min-h-10"><input type="radio" name="versioning" value="now" checked={(editing.versioningMode||'now')==='now'} onChange={()=>setEditing({...editing, versioningMode:'now'})} />Now</label>
                <label className="tt-check !min-h-10"><input type="radio" name="versioning" value="next-week" checked={editing.versioningMode==='next-week'} onChange={()=>setEditing({...editing, versioningMode:'next-week'})} />From next week ({nextMonday})</label>
                <label className="tt-check !min-h-10"><input type="radio" name="versioning" value="custom-week" checked={editing.versioningMode==='custom-week'} onChange={()=>setEditing({...editing, versioningMode:'custom-week'})} />From a chosen Monday</label>
                {editing.versioningMode==='custom-week' && <div className="pl-7">
                  <input type="date" aria-label="Start date for the schedule change" required value={editing.effectiveFromDate||''} onChange={e=>setEditing({...editing, effectiveFromDate:e.target.value})} className="tt-input" aria-invalid={!!customDateError} />
                  {customDateError && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{customDateError}</p>}
                </div>}
              </fieldset>
            )}
            {error && <ErrorState message={error} />}
            <div className="flex gap-2 pt-1 sm:justify-end">
              <Button variant="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={reset}>Cancel</Button>
              <Button type="submit" className="flex-1 sm:flex-none" loading={saving}>Save</Button>
            </div>
        </form>}
      </Dialog>
      <Dialog open={!!pendingDeleteSegmentId} onClose={() => setPendingDeleteSegmentId(null)} title="Delete block?" busy={saving}>
        <p className="tt-text-muted">It is removed from your routine. Logged time is kept.</p>
        {error && <div className="mt-4"><ErrorState message={error} /></div>}
        <div className="mt-5 flex gap-2 sm:justify-end">
          <Button disabled={saving} variant="secondary" className="flex-1 sm:flex-none" onClick={() => setPendingDeleteSegmentId(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1 sm:flex-none" loading={saving} onClick={() => pendingDeleteSegmentId && remove(pendingDeleteSegmentId)}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

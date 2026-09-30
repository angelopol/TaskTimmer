"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../useApiClient';
import { useWeek } from '../week/WeekContext';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';
import { CurrentActivityBar } from '../CurrentActivityBar';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '../ui/Feedback';
import { UnitSwitch } from '../ui/UnitSwitch';
import { IconChevronLeft, IconChevronRight, IconEdit, IconTrash } from '../ui/icons';
import { combineDateAndTime, hhmmToMinutes, minutesToHHMM, mondayOf, fmtHoursMinutes, fmtMinutes } from '../../lib/time';

interface Activity { id:string; name:string; color:string | null; }
interface Segment { id:string; weekday:number; startMinute:number; endMinute:number; activityId:string | null; activity?:Activity | null; }
type Source = 'PLANNED' | 'ADHOC' | 'MAKEUP';
interface Log { id:string; activityId:string | null; activity?:Activity | null; segmentId:string | null; startedAt:string; endedAt:string | null; minutes:number; source:Source; partial:boolean; comment:string | null; }
const sourceLabels:Record<Source,string> = { PLANNED:'Scheduled', ADHOC:'Unplanned', MAKEUP:'Catch-up' };
const localDate = (date:Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
const localTime = (date:Date) => String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
const newForm = () => ({ date:localDate(new Date()), start:'09:00', end:'10:00', activityId:'', segmentId:'', source:'ADHOC' as Source, partial:false, comment:'' });

export default function LogTimeForm() {
  const { apiFetch } = useApiClient();
  const { addToast } = useToast();
  const { unit } = useUnit();
  const { weekStart, setWeekStart, gotoPrevWeek, gotoNextWeek, gotoThisWeek, weekRangeLabel } = useWeek();
  const [form, setForm] = useState(newForm);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Log | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const PAGE_SIZE = 10;
  const reload = useCallback(() => setRefresh(value => value+1), []);
  const selectedMonday = form.date ? mondayOf(form.date) : weekStart;
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch<{ activities:Activity[] }>('/api/activities'), apiFetch<{ segments:Segment[] }>('/api/schedule/segments?weekStart=' + selectedMonday)]).then(([a, s]) => {
      if (!active) return;
      if (a.ok) setActivities(a.data?.activities || []);
      if (s.ok) setSegments(s.data?.segments || []);
      setOptionsError(!a.ok || !s.ok ? 'Some activity or schedule options could not be loaded.' : '');
    });
    return () => { active = false; };
  }, [apiFetch, selectedMonday, refresh]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ weekStart, limit:String(PAGE_SIZE), offset:String(offset), order });
    if (filter) query.set('activityId', filter);
    if (sourceFilter) query.set('source', sourceFilter);
    apiFetch<{ logs:Log[]; total:number }>('/api/logs?' + query).then(response => {
      if (!active) return;
      if (response.ok && response.data) {
        if (offset > 0 && response.data.total <= offset) { setOffset(Math.max(0, offset-PAGE_SIZE)); return; }
        setLogs(response.data.logs); setTotal(response.data.total);
      } else setError(response.error || 'Your time log could not be loaded.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [apiFetch, weekStart, offset, filter, sourceFilter, order, refresh]);
  useEffect(() => { window.addEventListener('timelog:created', reload); return () => window.removeEventListener('timelog:created', reload); }, [reload]);
  const update = <K extends keyof typeof form>(key:K, value:typeof form[K]) => setForm(previous => ({ ...previous, [key]:value }));
  const weekday = new Date(form.date + 'T12:00:00').getDay() || 7;
  const matchingSegments = segments.filter(segment => segment.weekday === weekday && (!form.activityId || !segment.activityId || segment.activityId === form.activityId));
  const duration = hhmmToMinutes(form.end) - hhmmToMinutes(form.start);
  function pickSegment(id:string) {
    const segment = segments.find(item => item.id === id);
    setForm(previous => ({ ...previous, segmentId:id, ...(segment ? { activityId:segment.activityId || previous.activityId, start:minutesToHHMM(segment.startMinute), end:minutesToHHMM(segment.endMinute), source:'PLANNED' as Source } : {}) }));
  }
  function beginEdit(log:Log) {
    if (!log.endedAt) return;
    setEditing(log.id); setFormError('');
    setForm({ date:localDate(new Date(log.startedAt)), start:localTime(new Date(log.startedAt)), end:localTime(new Date(log.endedAt)), activityId:log.activityId || '', segmentId:log.segmentId || '', source:log.source, partial:log.partial, comment:log.comment || '' });
    requestAnimationFrame(() => { formHeading.current?.focus(); formHeading.current?.scrollIntoView({ block:'center' }); });
  }
  function cancelEdit() { setEditing(null); setForm(newForm()); setFormError(''); }
  async function save(event:React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!Number.isFinite(duration) || duration <= 0) { setFormError('Choose an end time after the start time, on the same day.'); return; }
    setSaving(true); setFormError('');
    const response = await apiFetch('/api/logs' + (editing ? '?id=' + editing : ''), { method:editing ? 'PATCH' : 'POST', json:{
      date:form.date, startedAt:combineDateAndTime(form.date, form.start), endedAt:combineDateAndTime(form.date, form.end),
      activityId:form.activityId || null, segmentId:form.segmentId || null, source:form.source, partial:form.partial, comment:form.comment.trim() || null
    } });
    setSaving(false);
    if (!response.ok) { setFormError(response.error || 'Could not save your time. Please try again.'); return; }
    addToast({ type:'success', message:editing ? 'Time entry updated.' : fmtHoursMinutes(duration) + ' added to your time log.' });
    setWeekStart(mondayOf(form.date)); setOffset(0); setEditing(null);
    setForm(previous => ({ ...previous, comment:'' }));
    window.dispatchEvent(new Event('timelog:created'));
  }
  async function remove() {
    if (!deleting || saving) return;
    setSaving(true); setDeleteError('');
    const response = await apiFetch('/api/logs?id=' + deleting.id, { method:'DELETE' });
    setSaving(false);
    if (!response.ok) { setDeleteError(response.error || 'Could not delete this entry.'); return; }
    if (editing === deleting.id) cancelEdit();
    setDeleting(null); window.dispatchEvent(new Event('timelog:created'));
    addToast({ type:'success', message:'Time entry deleted.' });
  }
  return <div className="space-y-7">
    <header><p className="tt-eyebrow mb-2">A record of your day</p><h1 className="tt-heading-page">Your time log</h1><p className="tt-text-muted mt-2">Track something now, or add time you have already spent.</p></header>
    <CurrentActivityBar />
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="tt-panel tt-panel-padding">
        <h2 ref={formHeading} tabIndex={-1} className="text-xl font-semibold tracking-tight">{editing ? 'Edit time entry' : 'Add time manually'}</h2>
        <p className="tt-text-muted mb-6 mt-1 text-sm">Forgot to start the timer? Add it here.</p>
        {optionsError && <div className="mb-4"><ErrorState message={optionsError} onRetry={reload} /></div>}
        <form onSubmit={save} className="space-y-5">
          <label className="block"><span className="tt-label">Activity</span><select className="tt-input" value={form.activityId} onChange={e => setForm({ ...form, activityId:e.target.value, segmentId:'' })}><option value="">Without an activity</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
          {!activities.length && !optionsError && <p className="tt-text-muted text-sm"><Link className="tt-link" href="/activities">Create an activity</Link> to organize your time.</p>}
          <label className="block"><span className="tt-label">Date</span><input type="date" required className="tt-input" value={form.date} onChange={e => setForm({ ...form, date:e.target.value, segmentId:'' })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label><span className="tt-label">Start time</span><input type="time" required className="tt-input" value={form.start} onChange={e => update('start', e.target.value)} /></label>
            <label><span className="tt-label">End time</span><input type="time" required className="tt-input" value={form.end} onChange={e => update('end', e.target.value)} /></label>
          </div>
          <p className="tt-badge" data-variant="blue" role="status">{duration > 0 ? 'Duration: ' + fmtHoursMinutes(duration) : 'End time must be after start time'}</p>
          <label className="block"><span className="tt-label">Note <span className="tt-text-muted font-normal">(optional)</span></span><textarea className="tt-input" rows={2} maxLength={200} placeholder="What did you work on?" value={form.comment} onChange={e => update('comment', e.target.value)} /></label>
          <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <summary className="text-sm font-semibold">Schedule and entry options</summary>
            <div className="mt-4 space-y-4">
              <label className="block"><span className="tt-label">Scheduled time block</span><select className="tt-input" value={form.segmentId} onChange={e => pickSegment(e.target.value)}><option value="">Not linked to a schedule</option>{matchingSegments.map(segment => <option key={segment.id} value={segment.id}>{minutesToHHMM(segment.startMinute)} – {minutesToHHMM(segment.endMinute)} {segment.activity?.name || ''}</option>)}</select></label>
              <label className="block"><span className="tt-label">Type of time</span><select className="tt-input" value={form.source} onChange={e => update('source', e.target.value as Source)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.partial} onChange={e => update('partial', e.target.checked)} />Only part of the planned time was completed</label>
            </div>
          </details>
          {formError && <ErrorState message={formError} />}
          <div className="flex gap-3">{editing && <Button variant="secondary" disabled={saving} onClick={cancelEdit}>Cancel edit</Button>}<Button type="submit" loading={saving} className="flex-1">{editing ? 'Save changes' : 'Save time entry'}</Button></div>
        </form>
      </section>
      <section aria-labelledby="entries-title" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="entries-title" className="text-xl font-semibold tracking-tight">Saved entries</h2><UnitSwitch /></div>
        <div className="tt-panel p-4">
          <div className="flex items-center justify-between gap-1"><IconButton variant="ghost" icon={<IconChevronLeft />} label="Previous week" onClick={() => { setOffset(0); gotoPrevWeek(); }} /><p className="text-center text-sm font-semibold">{weekRangeLabel}</p><IconButton variant="ghost" icon={<IconChevronRight />} label="Next week" onClick={() => { setOffset(0); gotoNextWeek(); }} /></div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="min-w-0 flex-1"><span className="sr-only">Filter entries by activity</span><select className="tt-input" value={filter} onChange={e => { setOffset(0); setFilter(e.target.value); }}><option value="">All activities</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
            <Button variant="ghost" onClick={() => { setOffset(0); gotoThisWeek(); }}>This week</Button>
          </div>
          <details className="mt-3"><summary className="tt-text-muted text-sm">More filters</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label><span className="tt-label">Type of time</span><select className="tt-input" value={sourceFilter} onChange={e => { setOffset(0); setSourceFilter(e.target.value); }}><option value="">All types</option>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="tt-label">Sort by</span><select className="tt-input" value={order} onChange={e => { setOffset(0); setOrder(e.target.value); }}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
          </div></details>
        </div>
        {loading ? <LoadingState label="Loading time entries…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !logs.length ?
          <EmptyState title={filter || sourceFilter ? 'No entries match these filters' : 'A fresh page for this week'} description={filter || sourceFilter ? 'Try another activity, type, or week.' : 'Start a timer or save a manual entry. Your time will appear here.'}>
            {(filter || sourceFilter) && <Button variant="secondary" onClick={() => { setFilter(''); setSourceFilter(''); setOffset(0); }}>Clear filters</Button>}
          </EmptyState> : <>
          <p className="tt-text-muted text-sm" role="status">{total} {total === 1 ? 'entry' : 'entries'} this week</p>
          <div className="space-y-3">{logs.map(log => <article key={log.id} className="tt-panel p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="tt-text-muted mb-1 text-xs">{new Date(log.startedAt).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' })}</p><h3 className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background:log.activity?.color || '#94a3b8' }} />{log.activity?.name || 'Unassigned activity'}</h3></div><span className="shrink-0 font-semibold tabular-nums">{log.endedAt ? unit === 'hr' ? fmtHoursMinutes(log.minutes) : fmtMinutes(log.minutes) : 'Running'}</span></div>
            <p className="tt-text-muted mt-2 text-sm">{localTime(new Date(log.startedAt))} – {log.endedAt ? localTime(new Date(log.endedAt)) : 'Now'} <span className="mx-1">·</span> {sourceLabels[log.source]}{log.partial ? ' · Partially completed' : ''}</p>
            {log.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{log.comment}</p>}
            {log.endedAt && <div className="mt-3 flex justify-end gap-1"><Button variant="ghost" leftIcon={<IconEdit size={16} />} onClick={() => beginEdit(log)} aria-label={'Edit time entry for ' + (log.activity?.name || 'unassigned activity')}>Edit</Button><IconButton variant="ghost" icon={<IconTrash size={17} />} label="Delete time entry" onClick={() => { setDeleteError(''); setDeleting(log); }} /></div>}
          </article>)}</div>
          {total > PAGE_SIZE && <nav aria-label="Time log pages" className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value-PAGE_SIZE))}>Previous</Button><span className="tt-text-muted text-sm">{offset+1}–{Math.min(offset+PAGE_SIZE, total)} of {total}</span><Button variant="secondary" disabled={offset+PAGE_SIZE >= total} onClick={() => setOffset(value => value+PAGE_SIZE)}>Next</Button></nav>}
        </>}
      </section>
    </div>
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete this time entry?" busy={saving}>
      <p className="tt-text-muted">This removes the entry and its time from your weekly progress. This action cannot be undone.</p>
      {deleteError && <div className="mt-4"><ErrorState message={deleteError} /></div>}
      <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={saving} onClick={() => setDeleting(null)}>Keep entry</Button><Button variant="danger" loading={saving} onClick={remove}>Delete entry</Button></div>
    </Dialog>
  </div>;
}

"use client";
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../useApiClient';
import { useWeek } from '../week/WeekContext';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';
import { CurrentActivityBar } from '../CurrentActivityBar';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '../ui/Feedback';
import { Menu } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { WeekNav } from '../week/WeekNav';
import { IconAdd, IconChevronLeft, IconChevronRight, IconEdit, IconFilter, IconLog, IconTrash } from '../ui/icons';
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
  const { weekStart, setWeekStart } = useWeek();
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
  const [formOpen, setFormOpen] = useState(false);
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
    setFormOpen(true);
  }
  function openNew() { setEditing(null); setForm(previous => ({ ...newForm(), activityId:previous.activityId })); setFormError(''); setFormOpen(true); }
  function cancelEdit() { setEditing(null); setForm(newForm()); setFormError(''); setFormOpen(false); }
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
    setWeekStart(mondayOf(form.date)); setOffset(0); setEditing(null); setFormOpen(false);
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
  const fmt = unit === 'hr' ? fmtHoursMinutes : fmtMinutes;
  const dayLabel = (iso:string) => new Date(iso).toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'short' });
  const filtered = !!(filter || sourceFilter);
  const groups = logs.reduce<{ day:string; items:Log[] }[]>((list, log) => {
    const day = dayLabel(log.startedAt), last = list[list.length-1];
    if (last?.day === day) last.items.push(log); else list.push({ day, items:[log] });
    return list;
  }, []);
  return <div className="space-y-4">
    <PageHeader title="Time log" mobile={false}>
      <Button leftIcon={<IconAdd size={18} />} onClick={openNew}>Add time</Button>
    </PageHeader>
    <CurrentActivityBar />
    <section aria-labelledby="entries-title" className="space-y-3">
      <h2 id="entries-title" className="sr-only">Saved entries</h2>
      <WeekNav onChange={() => setOffset(0)} className="sm:max-w-sm" />
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1 sm:max-w-xs"><span className="sr-only">Filter by activity</span>
          <select className="tt-input tt-input-sm" value={filter} onChange={e => { setOffset(0); setFilter(e.target.value); }}><option value="">All activities</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select>
        </label>
        <Menu label="Filter and sort" triggerClassName="!min-h-9 !px-3"
          trigger={<span className="relative flex items-center gap-1.5"><IconFilter size={17} /><span className="max-sm:sr-only">Filters</span>{sourceFilter && <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-indigo-600" />}</span>}
          items={[
            { heading:'Type of time' },
            { label:'All types', checked:!sourceFilter, onSelect:() => { setOffset(0); setSourceFilter(''); } },
            ...Object.entries(sourceLabels).map(([value, label]) => ({ label, checked:sourceFilter === value, onSelect:() => { setOffset(0); setSourceFilter(value); } })),
            'separator', { heading:'Sort' },
            { label:'Newest first', checked:order === 'desc', onSelect:() => { setOffset(0); setOrder('desc'); } },
            { label:'Oldest first', checked:order === 'asc', onSelect:() => { setOffset(0); setOrder('asc'); } }
          ]} />
        {!loading && !error && total > 0 && <span className="tt-text-muted ml-auto shrink-0 text-xs" role="status">{total} {total === 1 ? 'entry' : 'entries'}</span>}
      </div>
      {loading ? <LoadingState label="Loading time entries…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !logs.length ?
        <EmptyState title={filtered ? 'No matching entries' : 'Nothing logged this week'} icon={<IconLog size={24} />}>
          {filtered
            ? <Button variant="secondary" onClick={() => { setFilter(''); setSourceFilter(''); setOffset(0); }}>Clear filters</Button>
            : <Button variant="secondary" leftIcon={<IconAdd size={18} />} onClick={openNew}>Add time</Button>}
        </EmptyState> : <>
        <div className="space-y-3">{groups.map(group => <div key={group.day}>
          <h3 className="tt-text-muted mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide">{group.day}</h3>
          <ul className="tt-list">{group.items.map(log => <li key={log.id} className="flex items-center pr-1">
            <button type="button" disabled={!log.endedAt} onClick={() => beginEdit(log)} className="tt-row tt-row-button min-w-0 flex-1 disabled:!cursor-default disabled:!opacity-100" aria-label={'Edit entry for ' + (log.activity?.name || 'unassigned activity')}>
              <span aria-hidden="true" className="tt-dot" style={{ background:log.activity?.color || '#94a3b8' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{log.activity?.name || 'Unassigned'}</span>
                <span className="tt-text-muted block truncate text-xs tabular-nums">
                  {localTime(new Date(log.startedAt))}–{log.endedAt ? localTime(new Date(log.endedAt)) : 'now'} · {sourceLabels[log.source]}{log.partial ? ' · Partial' : ''}{log.comment ? ' · ' + log.comment : ''}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{log.endedAt ? fmt(log.minutes) : <span className="tt-badge" data-variant="green">Running</span>}</span>
            </button>
            {log.endedAt ? <Menu label="Entry options" items={[
              { label:'Edit', icon:<IconEdit size={17} />, onSelect:() => beginEdit(log) },
              { label:'Delete', icon:<IconTrash size={17} />, danger:true, onSelect:() => { setDeleteError(''); setDeleting(log); } }
            ]} /> : <span className="w-11 shrink-0" />}
          </li>)}</ul>
        </div>)}</div>
        {total > PAGE_SIZE && <nav aria-label="Time log pages" className="flex items-center justify-between gap-3">
          <IconButton variant="secondary" icon={<IconChevronLeft size={18} />} label="Previous page" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value-PAGE_SIZE))} />
          <span className="tt-text-muted text-sm tabular-nums">{offset+1}–{Math.min(offset+PAGE_SIZE, total)} of {total}</span>
          <IconButton variant="secondary" icon={<IconChevronRight size={18} />} label="Next page" disabled={offset+PAGE_SIZE >= total} onClick={() => setOffset(value => value+PAGE_SIZE)} />
        </nav>}
      </>}
    </section>
    <button type="button" className="tt-fab sm:hidden" aria-label="Add time" onClick={openNew}><IconAdd size={24} /></button>
    <Dialog open={formOpen} onClose={cancelEdit} title={editing ? 'Edit entry' : 'Add time'} busy={saving}>
      {optionsError && <div className="mb-4"><ErrorState message={optionsError} onRetry={reload} /></div>}
      <form onSubmit={save} className="space-y-4">
        <label className="block"><span className="tt-label">Activity</span><select className="tt-input" value={form.activityId} onChange={e => setForm({ ...form, activityId:e.target.value, segmentId:'' })}><option value="">No activity</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
        {!activities.length && !optionsError && <p className="tt-text-muted text-sm"><Link className="tt-link" href="/activities">Create an activity</Link> to organize your time.</p>}
        <label className="block"><span className="tt-label">Date</span><input type="date" required className="tt-input" value={form.date} onChange={e => setForm({ ...form, date:e.target.value, segmentId:'' })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="tt-label">Start</span><input type="time" required className="tt-input" value={form.start} onChange={e => update('start', e.target.value)} /></label>
          <label><span className="tt-label">End</span><input type="time" required className="tt-input" value={form.end} onChange={e => update('end', e.target.value)} /></label>
        </div>
        <p className="tt-badge" data-variant={duration > 0 ? 'blue' : 'red'} role="status">{duration > 0 ? fmtHoursMinutes(duration) : 'End must be after start'}</p>
        <label className="block"><span className="tt-label">Note</span><input className="tt-input" maxLength={200} placeholder="Optional" value={form.comment} onChange={e => update('comment', e.target.value)} /></label>
        <details className="rounded-xl border border-[var(--line)] px-4 py-1">
          <summary className="flex min-h-10 items-center text-sm font-semibold">More options</summary>
          <div className="space-y-3 pb-3 pt-2">
            <label className="block"><span className="tt-label">Scheduled block</span><select className="tt-input" value={form.segmentId} onChange={e => pickSegment(e.target.value)}><option value="">Not linked</option>{matchingSegments.map(segment => <option key={segment.id} value={segment.id}>{minutesToHHMM(segment.startMinute)}–{minutesToHHMM(segment.endMinute)} {segment.activity?.name || ''}</option>)}</select></label>
            <label className="block"><span className="tt-label">Type of time</span><select className="tt-input" value={form.source} onChange={e => update('source', e.target.value as Source)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="tt-check"><input type="checkbox" checked={form.partial} onChange={e => update('partial', e.target.checked)} />Partially completed</label>
          </div>
        </details>
        {formError && <ErrorState message={formError} />}
        <div className="flex gap-2 pt-1 sm:justify-end">
          <Button variant="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={cancelEdit}>Cancel</Button>
          <Button type="submit" loading={saving} className="flex-1 sm:flex-none">{editing ? 'Save' : 'Add entry'}</Button>
        </div>
      </form>
    </Dialog>
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete entry?" busy={saving}>
      <p className="tt-text-muted">This removes the entry and its time. It cannot be undone.</p>
      {deleteError && <div className="mt-4"><ErrorState message={deleteError} /></div>}
      <div className="mt-5 flex gap-2 sm:justify-end">
        <Button variant="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button>
        <Button variant="danger" className="flex-1 sm:flex-none" loading={saving} onClick={remove}>Delete</Button>
      </div>
    </Dialog>
  </div>;
}

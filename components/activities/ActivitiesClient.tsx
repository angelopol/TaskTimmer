"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../useApiClient';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';
import { fmtMinutes, fmtHoursMinutes } from '../../lib/time';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '../ui/Feedback';
import { UnitSwitch } from '../ui/UnitSwitch';
import { IconAdd, IconEdit, IconTrash } from '../ui/icons';

interface Activity { id:string; name:string; color:string | null; weeklyTargetMinutes:number; }
const palette = [{ value:'#6366f1', name:'Indigo' }, { value:'#0d9488', name:'Teal' }, { value:'#d97706', name:'Amber' }, { value:'#e11d48', name:'Rose' }, { value:'#7c3aed', name:'Violet' }, { value:'#0284c7', name:'Sky blue' }];
const blank = { name:'', color:'#6366f1', hours:0, minutes:0 };
export default function ActivitiesClient() {
  const { apiFetch } = useApiClient();
  const { addToast } = useToast();
  const { unit } = useUnit();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const response = await apiFetch<{ activities:Activity[] }>('/api/activities');
    if (response.ok) setItems(response.data?.activities || []);
    else setError(response.error || 'Your activities could not be loaded.');
    setLoading(false);
  }, [apiFetch]);
  useEffect(() => { load(); }, [load]);
  function edit(activity?:Activity) {
    setFormError('');
    setForm(activity ? { name:activity.name, color:activity.color || '#6366f1', hours:Math.floor(activity.weeklyTargetMinutes/60), minutes:activity.weeklyTargetMinutes%60 } : blank);
    setEditing(activity || 'new');
  }
  async function save(event:React.FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setFormError('');
    const creating = editing === 'new';
    const id = editing && editing !== 'new' ? editing.id : '';
    const response = await apiFetch<{ activity:Activity }>('/api/activities' + (creating ? '' : '?id=' + id), {
      method:creating ? 'POST' : 'PATCH', json:{ name:form.name.trim(), color:form.color, weeklyTargetMinutes:form.hours*60 + form.minutes }
    });
    setSaving(false);
    if (!response.ok || !response.data) { setFormError(response.error || 'Could not save this activity. Please try again.'); return; }
    const saved = response.data.activity;
    setItems(previous => creating ? [...previous, saved] : previous.map(item => item.id === saved.id ? saved : item));
    setEditing(null);
    addToast({ type:'success', message:creating ? 'Activity created. You are ready to start tracking.' : 'Activity updated.' });
  }
  async function remove() {
    if (!deleting || saving) return;
    setSaving(true); setFormError('');
    const response = await apiFetch('/api/activities?id=' + deleting.id, { method:'DELETE' });
    setSaving(false);
    if (!response.ok) { setFormError(response.error || 'Could not delete this activity.'); return; }
    setItems(previous => previous.filter(item => item.id !== deleting.id));
    setDeleting(null); addToast({ type:'success', message:'Activity deleted. Your saved time logs have been kept.' });
  }
  const filtered = items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="space-y-7">
    <header className="tt-page-header"><div><p className="tt-eyebrow mb-2">What matters to you</p><h1 className="tt-heading-page">Your activities</h1><p className="tt-text-muted mt-2">Give your time a purpose. Work, learn, move, or take a break.</p></div>
      <Button size="md" leftIcon={<IconAdd size={18} />} onClick={() => edit()}>New activity</Button></header>
    {items.length > 0 && <div className="flex flex-wrap items-end justify-between gap-4">
      <label className="w-full sm:max-w-sm"><span className="tt-label">Find an activity</span><input type="search" className="tt-input" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} /></label><UnitSwitch />
    </div>}
    {loading ? <LoadingState label="Loading your activities…" /> : error ? <ErrorState message={error} onRetry={load} /> : !items.length ?
      <EmptyState title="Start with something you care about" description="Try “Studying”, “Exercise”, or “Personal project”. You can add a weekly goal or simply track your time.">
        <Button onClick={() => edit()} leftIcon={<IconAdd size={18} />}>Create your first activity</Button>
      </EmptyState> : !filtered.length ?
      <EmptyState title="No matching activities" description="Try a different name, or clear your search to see all your activities."><Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button></EmptyState> :
      <><p className="tt-text-muted text-sm" role="status">{filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(activity => <article key={activity.id} className="tt-panel flex flex-col overflow-hidden">
          <div className="h-1.5" aria-hidden="true" style={{ background:activity.color || '#6366f1' }} />
          <div className="flex flex-1 flex-col p-6">
            <h2 className="text-lg font-semibold">{activity.name}</h2>
            <p className="tt-text-muted mt-3 text-sm">{activity.weeklyTargetMinutes > 0 ? 'Weekly goal' : 'Track at your own pace'}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{activity.weeklyTargetMinutes > 0 ? (unit === 'hr' ? fmtHoursMinutes(activity.weeklyTargetMinutes) : fmtMinutes(activity.weeklyTargetMinutes)) : 'No goal set'}</p>
            <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Button variant="secondary" leftIcon={<IconEdit size={16} />} onClick={() => edit(activity)} aria-label={'Edit ' + activity.name}>Edit activity</Button>
              <IconButton variant="ghost" icon={<IconTrash size={18} />} label={'Delete ' + activity.name} onClick={() => { setFormError(''); setDeleting(activity); }} />
            </div>
          </div>
        </article>)}
      </div></>}
    <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Create an activity' : 'Edit activity'} description="Make it easy to recognize the things you spend time on." busy={saving}>
      <form onSubmit={save} className="space-y-5">
        <label className="block"><span className="tt-label">Activity name</span><input autoFocus required minLength={2} maxLength={60} className="tt-input" placeholder="For example, Learning Spanish" value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} /></label>
        <fieldset><legend className="tt-label">Color</legend><div className="flex flex-wrap items-center gap-2">
          {palette.map(color => <button key={color.value} type="button" aria-label={color.name} aria-pressed={form.color === color.value} onClick={() => setForm({ ...form, color:color.value })} className={'flex h-11 w-11 items-center justify-center rounded-xl border-2 ' + (form.color === color.value ? 'border-indigo-600 dark:border-indigo-300' : 'border-transparent')}><span className="h-7 w-7 rounded-full" style={{ background:color.value }} /></button>)}
          <label><span className="sr-only">Custom activity color</span><input type="color" className="rounded-lg" value={form.color} onChange={e => setForm({ ...form, color:e.target.value })} /></label>
        </div></fieldset>
        <fieldset><legend className="tt-label">Weekly goal <span className="tt-text-muted font-normal">(optional)</span></legend><p id="goal-help" className="tt-text-muted mb-3 text-sm">Leave at zero to track time without a target.</p>
          <div className="grid grid-cols-2 gap-4">
            <label><span className="tt-label">Hours</span><input type="number" min={0} max={1666} step={1} required aria-describedby="goal-help" className="tt-input" value={form.hours} onChange={e => setForm({ ...form, hours:Number(e.target.value) })} /></label>
            <label><span className="tt-label">Minutes</span><input type="number" min={0} max={59} step={1} required className="tt-input" value={form.minutes} onChange={e => setForm({ ...form, minutes:Number(e.target.value) })} /></label>
          </div>
        </fieldset>
        {formError && <ErrorState message={formError} />}
        <div className="flex justify-end gap-3 pt-2"><Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={saving}>{editing === 'new' ? 'Create activity' : 'Save changes'}</Button></div>
      </form>
    </Dialog>
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete this activity?" busy={saving}>
      <p className="tt-text-muted mb-5"><strong className="text-slate-900 dark:text-white">{deleting?.name}</strong> will be removed. Existing time logs will be kept without an assigned activity.</p>
      {formError && <ErrorState message={formError} />}
      <div className="mt-5 flex justify-end gap-3"><Button variant="secondary" disabled={saving} onClick={() => setDeleting(null)}>Keep activity</Button><Button variant="danger" loading={saving} onClick={remove}>Delete activity</Button></div>
    </Dialog>
  </div>;
}


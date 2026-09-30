"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../useApiClient';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';
import { fmtMinutes, fmtHoursMinutes } from '../../lib/time';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { Dialog } from '../ui/Dialog';
import { EmptyState, ErrorState, LoadingState } from '../ui/Feedback';
import { IconAdd, IconEdit, IconLayers, IconSearch, IconTrash } from '../ui/icons';

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
    addToast({ type:'success', message:creating ? 'Activity created.' : 'Activity updated.' });
  }
  async function remove() {
    if (!deleting || saving) return;
    setSaving(true); setFormError('');
    const response = await apiFetch('/api/activities?id=' + deleting.id, { method:'DELETE' });
    setSaving(false);
    if (!response.ok) { setFormError(response.error || 'Could not delete this activity.'); return; }
    setItems(previous => previous.filter(item => item.id !== deleting.id));
    setDeleting(null); addToast({ type:'success', message:'Activity deleted.' });
  }
  const filtered = items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const fmt = unit === 'hr' ? fmtHoursMinutes : fmtMinutes;
  return <div className="space-y-4">
    <PageHeader title="Activities" mobile={false}>
      <Button leftIcon={<IconAdd size={18} />} onClick={() => edit()}>New activity</Button>
    </PageHeader>
    {items.length > 6 && <label className="relative block sm:max-w-sm"><span className="sr-only">Find an activity</span>
      <IconSearch size={18} className="tt-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
      <input type="search" className="tt-input !pl-10" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
    </label>}
    {loading ? <LoadingState label="Loading your activities…" /> : error ? <ErrorState message={error} onRetry={load} /> : !items.length ?
      <EmptyState title="No activities yet" icon={<IconLayers size={24} />}>
        <Button onClick={() => edit()} leftIcon={<IconAdd size={18} />}>Create activity</Button>
      </EmptyState> : !filtered.length ?
      <EmptyState title="No matches"><Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button></EmptyState> :
      <ul className="tt-list">
        {filtered.map(activity => <li key={activity.id} className="flex items-center pr-1">
          <button type="button" className="tt-row tt-row-button min-w-0 flex-1" onClick={() => edit(activity)} aria-label={'Edit ' + activity.name}>
            <span aria-hidden="true" className="h-8 w-1.5 shrink-0 rounded-full" style={{ background:activity.color || '#6366f1' }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{activity.name}</span>
              <span className="tt-text-muted block text-xs">{activity.weeklyTargetMinutes > 0 ? fmt(activity.weeklyTargetMinutes) + ' / week' : 'No goal'}</span>
            </span>
          </button>
          <Menu label={'Options for ' + activity.name} items={[
            { label:'Edit', icon:<IconEdit size={17} />, onSelect:() => edit(activity) },
            { label:'Delete', icon:<IconTrash size={17} />, danger:true, onSelect:() => { setFormError(''); setDeleting(activity); } }
          ]} />
        </li>)}
      </ul>}
    <button type="button" className="tt-fab sm:hidden" aria-label="New activity" onClick={() => edit()}><IconAdd size={24} /></button>
    <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New activity' : 'Edit activity'} busy={saving}>
      <form onSubmit={save} className="space-y-4">
        <label className="block"><span className="tt-label">Activity name</span><input autoFocus required minLength={2} maxLength={60} className="tt-input" placeholder="e.g. Learning Spanish" value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} /></label>
        <fieldset><legend className="tt-label">Color</legend><div className="flex flex-wrap items-center gap-2">
          {palette.map(color => <button key={color.value} type="button" aria-label={color.name} aria-pressed={form.color === color.value} onClick={() => setForm({ ...form, color:color.value })} className={'flex h-11 w-11 items-center justify-center rounded-xl border-2 ' + (form.color === color.value ? 'border-indigo-600 dark:border-indigo-300' : 'border-transparent')}><span className="h-7 w-7 rounded-full" style={{ background:color.value }} /></button>)}
          <label><span className="sr-only">Custom activity color</span><input type="color" className="rounded-lg" value={form.color} onChange={e => setForm({ ...form, color:e.target.value })} /></label>
        </div></fieldset>
        <fieldset><legend className="tt-label">Weekly goal <span className="tt-text-muted font-normal">(optional)</span></legend>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="tt-label">Hours</span><input type="number" min={0} max={1666} step={1} required className="tt-input" value={form.hours} onChange={e => setForm({ ...form, hours:Number(e.target.value) })} /></label>
            <label><span className="tt-label">Minutes</span><input type="number" min={0} max={59} step={1} required className="tt-input" value={form.minutes} onChange={e => setForm({ ...form, minutes:Number(e.target.value) })} /></label>
          </div>
        </fieldset>
        {formError && <ErrorState message={formError} />}
        <div className="flex gap-2 pt-1 sm:justify-end"><Button variant="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" className="flex-1 sm:flex-none" loading={saving}>{editing === 'new' ? 'Create' : 'Save'}</Button></div>
      </form>
    </Dialog>
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete activity?" busy={saving}>
      <p className="tt-text-muted mb-5"><strong className="text-[var(--ink)]">{deleting?.name}</strong> will be removed. Its time logs are kept.</p>
      {formError && <ErrorState message={formError} />}
      <div className="mt-5 flex gap-2 sm:justify-end"><Button variant="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" className="flex-1 sm:flex-none" loading={saving} onClick={remove}>Delete</Button></div>
    </Dialog>
  </div>;
}


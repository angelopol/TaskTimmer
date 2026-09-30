"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../useApiClient';
import { Dialog } from '../ui/Dialog';
import { Button, buttonStyles } from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { IconChevronRight } from '../ui/icons';

interface Activity { id:string; name:string; color:string | null; }
export function StartActivityModal({ open, onClose, onStart }: { open:boolean; onClose:()=>void; onStart:(id?:string)=>void | Promise<void> }) {
  const { apiFetch } = useApiClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setSearch(''); setError(''); setLoading(true);
    apiFetch<{ activities:Activity[] }>('/api/activities').then(response => {
      if (!active) return;
      if (response.ok) setActivities(response.data?.activities || []);
      else setError(response.error || 'We could not load your activities.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [open, retry, apiFetch]);
  async function start(id?:string) {
    if (pending) return;
    setPending(id || 'unassigned');
    try { await onStart(id); } finally { setPending(null); }
  }
  const filtered = activities.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <Dialog open={open} onClose={onClose} title="What are you working on?" description="Choose an activity. Your timer starts right away." busy={!!pending}>
    <div className="space-y-5">
      <label className="block"><span className="tt-label">Find an activity</span>
        <input autoFocus className="tt-input" type="search" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} />
      </label>
      {loading ? <LoadingState label="Loading activities…" /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v+1)} /> :
        <div className="space-y-2">
          {filtered.map(activity => <button key={activity.id} disabled={!!pending} onClick={() => start(activity.id)}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-600 dark:hover:bg-slate-800">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background:activity.color || '#6366f1' }} />
            <span className="min-w-0 flex-1 break-words font-medium">{activity.name}</span>
            <span className="tt-text-muted text-sm">{pending === activity.id ? 'Starting…' : 'Start'}</span><IconChevronRight />
          </button>)}
          {!filtered.length && <div className="py-5 text-center"><p className="tt-text-muted text-sm">{activities.length ? 'No activities match your search.' : 'Create an activity to keep your time organized.'}</p>
            {!activities.length && <Link onClick={onClose} className={buttonStyles('secondary') + ' mt-4'} href="/activities">Create an activity</Link>}
          </div>}
        </div>}
      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="ghost" className="w-full" loading={pending === 'unassigned'} disabled={!!pending} onClick={() => start()}>Start without an activity</Button>
        <p className="tt-text-muted mt-2 text-center text-xs">You can assign it to an activity in your time log later.</p>
      </div>
    </div>
  </Dialog>;
}


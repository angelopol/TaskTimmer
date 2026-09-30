"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../useApiClient';
import { Dialog } from '../ui/Dialog';
import { Button, buttonStyles } from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { IconPlay, IconSearch } from '../ui/icons';

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
  return <Dialog open={open} onClose={onClose} title="Start a timer" busy={!!pending}>
    <div className="space-y-4">
      {activities.length > 6 && <label className="relative block"><span className="sr-only">Find an activity</span>
        <IconSearch size={18} className="tt-text-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="tt-input !pl-10" type="search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
      </label>}
      {loading ? <LoadingState label="Loading activities…" /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v+1)} /> :
        filtered.length ? <div className="tt-list">
          {filtered.map(activity => <button key={activity.id} disabled={!!pending} onClick={() => start(activity.id)} className="tt-row tt-row-button !pr-4">
            <span aria-hidden="true" className="tt-dot" style={{ background:activity.color || '#6366f1' }} />
            <span className="min-w-0 flex-1 truncate font-medium">{activity.name}</span>
            {pending === activity.id ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <IconPlay size={16} className="tt-text-muted" />}
          </button>)}
        </div> : <div className="py-4 text-center"><p className="tt-text-muted text-sm">{activities.length ? 'No matches.' : 'No activities yet.'}</p>
          {!activities.length && <Link onClick={onClose} className={buttonStyles('secondary') + ' mt-3'} href="/activities">Create an activity</Link>}
        </div>}
      <Button variant="ghost" className="w-full" loading={pending === 'unassigned'} disabled={!!pending} onClick={() => start()}>Start without an activity</Button>
    </div>
  </Dialog>;
}

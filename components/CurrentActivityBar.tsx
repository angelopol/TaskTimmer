"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { StartActivityModal } from './activities/StartActivityModal';
import { useToast } from './toast/ToastProvider';
import { Button } from './ui/Button';
import { IconPlay, IconStop } from './ui/icons';
import { ErrorState } from './ui/Feedback';

interface Current { id:string; startedAt:string; activity:{ id:string; name:string; color:string | null } | null }
export function CurrentActivityBar() {
  const { apiFetch } = useApiClient();
  const { addToast } = useToast();
  const [current, setCurrent] = useState<Current | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const mutation = useRef(false);
  const refresh = useCallback(async () => {
    const response = await apiFetch<{ active:Current | null }>('/api/logs/current');
    if (mutation.current) return;
    if (response.ok) { setCurrent(response.data?.active || null); setError(''); }
    else setError('Could not check your timer.');
    setLoading(false);
  }, [apiFetch]);
  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(tick); clearInterval(poll); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  async function start(activityId?:string) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true);
    const date = new Date();
    const pad = (n:number) => String(n).padStart(2, '0');
    const response = await apiFetch<{ log:Current }>('/api/logs/start', { method:'POST', json:{
      activityId:activityId || null, clientNow:date.toISOString(),
      clientDate:date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate())
    } });
    mutation.current = false; setBusy(false);
    if (response.ok && response.data) {
      setCurrent(response.data.log); setNow(Date.now()); setOpen(false); setError('');
      addToast({ type:'success', message:'Timer started.' });
    } else {
      addToast({ type:'error', message:response.status === 409 ? 'A timer is already running.' : response.error || 'Could not start the timer.' });
      refresh();
    }
  }
  async function stop() {
    if (mutation.current) return;
    mutation.current = true; setBusy(true);
    const response = await apiFetch('/api/logs/terminate', { method:'POST' });
    mutation.current = false; setBusy(false);
    if (response.ok) {
      setCurrent(null); setError('');
      window.dispatchEvent(new Event('timelog:created'));
      addToast({ type:'success', message:'Timer stopped and saved.' });
    } else { addToast({ type:'error', message:response.error || 'Could not stop the timer. Please try again.' }); refresh(); }
  }
  const seconds = current ? Math.max(0, Math.floor((now-new Date(current.startedAt).getTime())/1000)) : 0;
  const elapsed = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60].map(n => String(n).padStart(2,'0')).join(':');
  const color = current?.activity?.color || '#6366f1';
  return <section aria-label="Activity timer" className="space-y-2">
    <div className={'tt-panel flex items-center gap-3 p-3 pl-4 ' + (current ? '!border-indigo-300 dark:!border-indigo-800' : '')}>
      <span aria-hidden="true" className="relative flex h-3 w-3 shrink-0">
        {current && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background:color }} />}
        <span className="relative h-3 w-3 rounded-full" style={{ background:current ? color : 'var(--line-strong)' }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{loading ? 'Checking timer…' : current ? current.activity?.name || 'Unassigned' : 'No timer running'}</p>
        {current && <p className="tt-text-muted font-mono text-sm tabular-nums" aria-label={'Elapsed time ' + elapsed}>{elapsed}</p>}
      </div>
      <Button size="md" className="!px-4" disabled={loading || !!error} loading={busy} onClick={current ? stop : () => setOpen(true)} variant={current ? 'secondary' : 'primary'}
        leftIcon={current ? <IconStop size={16} /> : <IconPlay size={16} />}>
        {current ? 'Stop' : 'Start'}
      </Button>
    </div>
    {error && <ErrorState message={error} onRetry={refresh} />}
    <StartActivityModal open={open} onClose={() => setOpen(false)} onStart={start} />
  </section>;
}

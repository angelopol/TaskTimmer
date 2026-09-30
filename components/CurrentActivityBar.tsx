"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { StartActivityModal } from './activities/StartActivityModal';
import { useToast } from './toast/ToastProvider';
import { Button } from './ui/Button';
import { IconClock } from './ui/icons';
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
    else setError('Your timer could not be checked. Try again before starting a new one.');
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
      addToast({ type:'success', message:'Timer started. You can leave this page and keep tracking.' });
    } else {
      addToast({ type:'error', message:response.status === 409 ? 'A timer is already running. We have refreshed its status.' : response.error || 'Could not start the timer.' });
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
      addToast({ type:'success', message:'Timer stopped. Your time has been saved.' });
    } else { addToast({ type:'error', message:response.error || 'Could not stop the timer. Please try again.' }); refresh(); }
  }
  const seconds = current ? Math.max(0, Math.floor((now-new Date(current.startedAt).getTime())/1000)) : 0;
  const elapsed = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60].map(n => String(n).padStart(2,'0')).join(':');
  return <section aria-label="Activity timer" className="space-y-3">
    <div className={'tt-panel tt-panel-padding flex flex-wrap items-center gap-5 ' + (current ? '!border-indigo-300 dark:!border-indigo-700' : '')}>
      <span className="tt-empty-icon !mb-0 shrink-0"><IconClock size={26} /></span>
      <div className="min-w-0 flex-1">
        <p className="tt-eyebrow">{current ? 'Timer running' : 'One thing at a time'}</p>
        <h2 className="mt-1 text-lg font-semibold">{loading ? 'Checking your timer…' : current ? current.activity?.name || 'Unassigned activity' : 'Ready when you are'}</h2>
        <p className="tt-text-muted mt-1 text-sm">{current ? 'Your time is saved when you stop the timer.' : 'Choose an activity and focus. We will keep track of the time.'}</p>
      </div>
      {current && <span className="font-mono text-3xl font-medium tracking-tight tabular-nums" aria-label={'Elapsed time ' + elapsed}>{elapsed}</span>}
      <Button size="md" className="w-full sm:w-auto" disabled={loading || !!error} loading={busy} onClick={current ? stop : () => setOpen(true)} variant={current ? 'secondary' : 'primary'}>
        {current ? 'Stop & save' : 'Start timer'}
      </Button>
    </div>
    {error && <ErrorState message={error} onRetry={refresh} />}
    <StartActivityModal open={open} onClose={() => setOpen(false)} onStart={start} />
  </section>;
}


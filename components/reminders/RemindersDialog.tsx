"use client";
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiClient } from '../useApiClient';
import { useToast } from '../toast/ToastProvider';
import { Dialog } from '../ui/Dialog';
import { Button, IconButton } from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { IconBell, IconCopy } from '../ui/icons';
import { setPendingToken } from './tokenHandoff';

interface Status { connected:boolean; prefix:string | null; createdAt:string | null; lastUsedAt:string | null; lastSyncedAt:string | null; stored:number; }

export function CopyField({ label, value }: { label:string; value:string }) {
  const { addToast } = useToast();
  return <div>
    <span className="tt-label">{label}</span>
    <div className="flex items-center gap-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-sm">{value}</code>
      <IconButton variant="ghost" className="!min-h-9 !w-9" icon={<IconCopy size={16} />} label={'Copy ' + label.toLowerCase()}
        onClick={() => navigator.clipboard.writeText(value).then(() => addToast({ type:'success', message:label + ' copied.' }), () => addToast({ type:'error', message:'Copy failed. Select the text instead.' }))} />
    </div>
  </div>;
}

const when = (iso:string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'Never';

/** Connect Apple Reminders through an iOS Shortcut. Reminders are read-only in TaskTimmer. */
export function RemindersDialog({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const { apiFetch } = useApiClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    const res = await apiFetch<Status>('/api/integrations/reminders');
    if (res.ok) setStatus(res.data); else setError(res.error || 'Could not load the connection.');
  }, [apiFetch]);
  useEffect(() => { if (open) { setToken(null); setConfirming(false); setStatus(null); load(); } }, [open, load]);
  async function generate() {
    setBusy(true);
    const res = await apiFetch<{ token:string }>('/api/integrations/reminders', { method:'POST' });
    setBusy(false);
    if (!res.ok || !res.data) { setError(res.error || 'Could not create a token.'); return; }
    setToken(res.data.token); setPendingToken(res.data.token); load();
  }
  async function disconnect() {
    setBusy(true);
    const res = await apiFetch('/api/integrations/reminders', { method:'DELETE' });
    setBusy(false); setConfirming(false);
    if (!res.ok) { setError(res.error || 'Could not disconnect.'); return; }
    setToken(null); setPendingToken(null); load();
    window.dispatchEvent(new Event('reminders:changed'));
    addToast({ type:'success', message:'Apple Reminders disconnected.' });
  }
  const endpoint = typeof window === 'undefined' ? '' : window.location.origin + '/api/ingest/reminders';
  return <Dialog open={open} onClose={onClose} title="Apple Reminders" busy={busy}>
    {!status && !error ? <LoadingState label="Loading…" /> : <div className="space-y-4">
      {error && <ErrorState message={error} onRetry={load} />}
      {status && <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
        <span className="tt-empty-icon !mb-0 !h-10 !w-10 shrink-0"><IconBell size={20} /></span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{status.connected ? 'Connected · read only' : 'Not connected'}</p>
          <p className="tt-text-muted">{status.connected ? `Last sync: ${when(status.lastSyncedAt)} · ${status.stored} reminders` : 'A daily iPhone Shortcut sends your reminders here.'}</p>
        </div>
      </div>}
      {token ? <div className="space-y-3">
        <p className="tt-badge" data-variant="amber">Copy this token now. It will not be shown again.</p>
        <CopyField label="Token" value={token} />
        <CopyField label="URL" value={endpoint} />
        <p className="tt-text-muted text-sm">Next: build the Shortcut and its daily automation. The guide keeps this token while it is open.</p>
      </div> : status?.connected && <p className="tt-text-muted text-sm">Token <code className="font-mono">{status.prefix}-••••-••••-••••</code> · created {when(status.createdAt)} · last used {when(status.lastUsedAt)}</p>}
      {confirming ? <div className="tt-error flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1">Revoke the token and remove the synced reminders?</p>
        <Button variant="secondary" className="!min-h-9" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button variant="danger" className="!min-h-9" loading={busy} onClick={disconnect}>Disconnect</Button>
      </div> : status && <div className="flex gap-2 pt-1 sm:justify-end">
        {status.connected && <Button variant="secondary" className="flex-1 sm:flex-none" disabled={busy} onClick={() => setConfirming(true)}>Disconnect</Button>}
        <Button className="flex-1 sm:flex-none" loading={busy} onClick={generate}>{status.connected ? 'New token' : 'Connect'}</Button>
      </div>}
      {status?.connected && !token && <p className="tt-text-muted text-xs">A new token replaces the current one; update it in your Shortcut.</p>}
      <Link href="/integrations/reminders" onClick={onClose} className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-indigo-600 hover:bg-[var(--surface-2)] dark:text-indigo-300">
        Open setup guide →
      </Link>
    </div>}
  </Dialog>;
}

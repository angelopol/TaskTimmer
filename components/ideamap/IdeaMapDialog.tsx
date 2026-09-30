"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../useApiClient';
import { useToast } from '../toast/ToastProvider';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ErrorState, LoadingState } from '../ui/Feedback';
import { IdeaMapBadge } from './IdeaMapTaskList';

interface Status { connected:boolean; name:string | null; email:string | null; connectedAt:string | null; lastUsedAt:string | null; webUrl:string }
const when = (iso:string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'Never';

/** Connect / disconnect IdeaMap. Connecting leaves TaskTimmer for IdeaMap's consent screen and comes back. */
export function IdeaMapDialog({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const { apiFetch } = useApiClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    setError('');
    const res = await apiFetch<Status>('/api/integrations/ideamap');
    if (res.ok) setStatus(res.data); else setError(res.error || 'Could not load the connection.');
  }, [apiFetch]);
  useEffect(() => { if (open) { setStatus(null); setConfirming(false); load(); } }, [open, load]);
  async function disconnect() {
    setBusy(true);
    const res = await apiFetch('/api/integrations/ideamap', { method:'DELETE' });
    setBusy(false); setConfirming(false);
    if (!res.ok) { setError(res.error || 'Could not disconnect.'); return; }
    window.dispatchEvent(new Event('ideamap:changed'));
    addToast({ type:'success', message:'IdeaMap disconnected.' });
    load();
  }
  return <Dialog open={open} onClose={onClose} title="IdeaMap" busy={busy}>
    {!status && !error ? <LoadingState label="Loading…" /> : <div className="space-y-4">
      {error && <ErrorState message={error} onRetry={load} />}
      {status && <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
        <span className="tt-empty-icon !mb-0 !h-10 !w-10 shrink-0"><IdeaMapBadge className="!h-6 !px-1.5 !text-xs" /></span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{status.connected ? 'Connected' : 'Not connected'}</p>
          <p className="tt-text-muted truncate">{status.connected ? `${status.name} · ${status.email}` : 'See your assigned Idealo tasks in the Schedule and update their status here.'}</p>
        </div>
      </div>}
      {status?.connected && <p className="tt-text-muted text-xs">Connected {when(status.connectedAt)} · last used {when(status.lastUsedAt)}</p>}
      {status && !status.connected && <ul className="tt-text-muted list-disc space-y-1 pl-5 text-sm">
        <li>Tasks assigned to you, from every IdeaMap project.</li>
        <li>Complete them or change their status; IdeaMap updates at once.</li>
        <li>Your role in each project still decides what you can change.</li>
      </ul>}
      {confirming ? <div className="tt-error flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1">Disconnect IdeaMap? Its tasks will stop showing here.</p>
        <Button variant="secondary" className="!min-h-9" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button variant="danger" className="!min-h-9" loading={busy} onClick={disconnect}>Disconnect</Button>
      </div> : status && <div className="flex gap-2 pt-1 sm:justify-end">
        {status.connected
          ? <>
              <a href={status.webUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--line-strong)] px-3.5 text-sm font-semibold hover:bg-[var(--surface-2)] sm:flex-none">Open IdeaMap ↗</a>
              <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setConfirming(true)}>Disconnect</Button>
            </>
          : <Button className="flex-1 sm:flex-none" loading={busy} onClick={() => { setBusy(true); window.location.assign('/api/integrations/ideamap/connect'); }}>Connect IdeaMap</Button>}
      </div>}
    </div>}
  </Dialog>;
}

"use client";
import React, { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { fmtHoursMinutes } from '../lib/time';
import { useUnit } from './UnitProvider';
import { StartActivityModal } from './activities/StartActivityModal';
import { useToast } from './toast/ToastProvider';

interface Current { id: string; startedAt: string; elapsedMinutes: number; activity: { id: string; name: string; color: string | null } | null }

export function CurrentActivityBar(){
  const { apiFetch } = useApiClient();
  const { unit } = useUnit();
  const { addToast } = useToast();
  const [current, setCurrent] = useState<Current | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(()=>{ (async()=>{ const r = await apiFetch<{ active: Current|null }>('/api/logs/current'); if(r.ok) setCurrent(r.data?.active || null); })(); }, [apiFetch]);

  async function start(activityId?: string){
    const r = await apiFetch<{ log:any }>('/api/logs/start', { method:'POST', json: { activityId: activityId || null } });
    if(r.ok && r.data){ const log = (r.data as any).log; setCurrent({ id: log.id, startedAt: log.startedAt, elapsedMinutes: 0, activity: log.activity || null }); setOpen(false); addToast({ type:'success', message:'Started activity' }); }
    else if(r.status===409){ addToast({ type:'info', message:'Already active' }); }
    else { addToast({ type:'error', message: r.error || 'Failed to start' }); }
  }
  async function stop(){ const r = await apiFetch('/api/logs/terminate', { method:'POST' }); if(r.ok){ setCurrent(null); addToast({ type:'success', message:'Stopped activity' }); } else { addToast({ type:'error', message: (r as any).error || 'Failed to stop' }); } }

  return (
    <div className="tt-panel tt-panel-padding flex items-center justify-between gap-3">
      {current ? (
        <>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: current.activity?.color || '#999' }} />
            <div className="leading-tight">
              <div className="font-medium">Current: {current.activity?.name || 'Unassigned'}</div>
              {(() => { const started = new Date(current.startedAt); const mins = Math.max(0, Math.round((Date.now()-started.getTime())/60000)); return <div className="text-xs tt-text-muted">Started at {started.toLocaleTimeString()} • Elapsed ~ {unit==='min' ? `${mins} min` : fmtHoursMinutes(mins)}</div>; })()}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="tt-badge" data-variant="red" onClick={stop}>Terminate</button>
          </div>
        </>
      ) : (
        <div className="w-full flex items-center justify-between gap-2">
          <span className="text-sm tt-text-muted">No activity in progress</span>
          <div className="flex gap-2">
            <button className="tt-badge" onClick={()=>setOpen(true)}>Start…</button>
          </div>
        </div>
      )}
      <StartActivityModal open={open} onClose={()=>setOpen(false)} onStart={start} />
    </div>
  );
}

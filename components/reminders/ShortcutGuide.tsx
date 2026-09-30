"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../useApiClient';
import { useToast } from '../toast/ToastProvider';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { IconBell, IconCheck, IconCopy } from '../ui/icons';
import { CopyField } from './RemindersDialog';
import { getPendingToken, setPendingToken } from './tokenHandoff';

interface Status { connected:boolean; prefix:string | null; lastSyncedAt:string | null; stored:number; }
type Part = 'shortcut' | 'automation';
const SHORTCUT_NAME = 'TaskTimmer Reminders';
const PROGRESS_KEY = 'tt_reminders_guide';

/** iOS action name, with the Spanish label shown on Spanish-language iPhones. */
function Action({ en, es }: { en:string; es:string }) {
  return <strong className="font-semibold text-[var(--ink)]">{en} <span className="tt-text-muted font-normal">({es})</span></strong>;
}

function CopyChip({ value, label }: { value:string; label?:string }) {
  const { addToast } = useToast();
  return <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => addToast({ type:'success', message:(label || value) + ' copied.' }), () => {})}
    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-2 py-0.5 align-middle font-mono text-[13px] active:scale-95" aria-label={'Copy ' + (label || value)}>
    <span className="truncate">{value}</span><IconCopy size={12} className="shrink-0 opacity-60" />
  </button>;
}

interface Step { id:string; title:string; body:React.ReactNode }

export default function ShortcutGuide() {
  const { apiFetch } = useApiClient();
  const [part, setPart] = useState<Part>('shortcut');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [origin, setOrigin] = useState('');

  const load = useCallback(async () => {
    const res = await apiFetch<Status>('/api/integrations/reminders');
    if (res.ok) setStatus(res.data);
  }, [apiFetch]);
  useEffect(() => {
    setOrigin(window.location.origin);
    setToken(getPendingToken());
    try { setDone(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')); } catch {}
    load();
    // Coming back from the Shortcuts app refreshes the sync status.
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [load]);
  function toggle(id:string) {
    setDone(previous => {
      const next = { ...previous, [id]:!previous[id] };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  async function issue() {
    setIssuing(true);
    const res = await apiFetch<{ token:string }>('/api/integrations/reminders', { method:'POST' });
    setIssuing(false);
    if (res.ok && res.data) { setToken(res.data.token); setPendingToken(res.data.token); load(); }
  }

  const endpoint = origin + '/api/ingest/reminders';
  const bearer = 'Bearer ' + (token || 'YOUR-TOKEN');
  const synced = !!status?.lastSyncedAt;

  const shortcutSteps: Step[] = [
    { id:'token', title:'Get your token', body: token
      ? <div className="space-y-3"><p className="tt-badge" data-variant="amber">Shown only while this page is open. It is already filled in below.</p><CopyField label="Token" value={token} /></div>
      : <div className="space-y-2">
          <p>{status?.connected ? <>You already have a token (<code className="font-mono">{status.prefix}-…</code>). If it is not in your Shortcut yet, create a new one; the old one stops working.</> : 'Create the token your Shortcut will use to send reminders.'}</p>
          <Button loading={issuing} onClick={issue}>{status?.connected ? 'Create new token' : 'Create token'}</Button>
        </div> },
    { id:'new', title:'Create the Shortcut', body: <>
      <p>Open the Shortcuts app, tap <strong>+</strong> and name it <CopyChip value={SHORTCUT_NAME} />.</p>
      <a href="shortcuts://" className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-[var(--surface-2)] px-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300">Open Shortcuts ↗</a>
    </> },
    { id:'range', title:'Set the date range', body: <ol className="list-decimal space-y-1.5 pl-5">
      <li>Add <Action en="Date" es="Fecha" /> → <em>Current Date</em>.</li>
      <li>Add <Action en="Adjust Date" es="Ajustar fecha" /> → <strong>Subtract 7 days</strong>. Long-press the result → Rename → <CopyChip value="From" />.</li>
      <li>Add another <Action en="Adjust Date" es="Ajustar fecha" /> → <strong>Add 35 days</strong> to <em>Date</em>. Rename → <CopyChip value="To" />.</li>
    </ol> },
    { id:'find', title:'Find the reminders', body: <>
      <p>Add <Action en="Find Reminders" es="Buscar recordatorios" />, choose <strong>All</strong> criteria and add two filters:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        <li><em>Due Date</em> · <strong>is after</strong> · From</li>
        <li><em>Due Date</em> · <strong>is before</strong> · To</li>
      </ul>
      <p className="mt-1.5">Sort by Due Date and turn <strong>Limit</strong> off. Don’t filter out completed ones; they show crossed out.</p>
    </> },
    { id:'repeat', title:'Loop over each reminder', body: <>
      <p>Add <Action en="Repeat with Each" es="Repetir con cada" /> on <em>Reminders</em>. Put the next two actions <strong>inside</strong> the loop.</p>
    </> },
    { id:'format', title:'Format the due date', body: <p>
      Add <Action en="Format Date" es="Formatear fecha" /> with <em>Repeat Item › Due Date</em>. Set <strong>Date Format: ISO 8601</strong> and turn on <strong>Include ISO 8601 Time</strong>.
    </p> },
    { id:'dict', title:'Build a dictionary', body: <>
      <p>Add <Action en="Dictionary" es="Diccionario" /> with these <strong>Text</strong> keys (tap to copy):</p>
      <dl className="mt-2 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
        {[['title', 'Repeat Item › Title'], ['due', 'Formatted Date'], ['list', 'Repeat Item › List'], ['completed', 'Repeat Item › Is Completed'], ['notes', 'Repeat Item › Notes (optional)'], ['priority', 'Repeat Item › Priority (optional)']].map(([key, value]) =>
          <div key={key} className="flex items-center gap-3 px-3 py-2"><dt className="w-24 shrink-0"><CopyChip value={key} /></dt><dd className="tt-text-muted min-w-0 text-[13px]">{value}</dd></div>)}
      </dl>
    </> },
    { id:'combine', title:'Join the results', body: <p>
      After <em>End Repeat</em>, add <Action en="Combine Text" es="Combinar texto" /> with <em>Repeat Results</em> and <strong>New Lines</strong>.
    </p> },
    { id:'send', title:'Send it to TaskTimmer', body: <>
      <p>Add <Action en="Get Contents of URL" es="Obtener contenido de URL" /> and paste the URL:</p>
      <div className="my-2"><CopyField label="URL" value={endpoint} /></div>
      <p>Tap <strong>Show More</strong>:</p>
      <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
        <li>Method: <strong>POST</strong></li>
        <li>Headers → Add: <CopyChip value="Authorization" /> = <CopyChip value={bearer} label="Authorization value" /></li>
        <li>Request Body: <strong>JSON</strong> → add a <strong>Text</strong> field <CopyChip value="reminders" /> = <em>Combined Text</em></li>
      </ul>
      {!token && <p className="tt-badge mt-2" data-variant="amber">Replace YOUR-TOKEN with the token from step 1.</p>}
    </> },
    { id:'run', title:'Run it once', body: <>
      <p>Tap ▶︎. Allow access to <strong>Reminders</strong>, and when asked about sending data to this site choose <strong>Always Allow</strong>, or the daily automation will stop to ask.</p>
      <div className={'mt-3 flex items-center gap-3 rounded-xl p-3 text-sm ' + (synced ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-[var(--surface-2)]')}>
        {synced ? <IconCheck size={18} /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />}
        <span className="min-w-0 flex-1">{synced ? `Received ${status!.stored} reminders · ${new Date(status!.lastSyncedAt!).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' })}` : 'Waiting for the first sync…'}</span>
        <Button variant="ghost" className="!min-h-8 !px-2 text-xs" onClick={load}>Refresh</Button>
      </div>
    </> }
  ];

  const automationSteps: Step[] = [
    { id:'a-new', title:'New automation', body: <p>In Shortcuts, open the <strong>Automation</strong> <span className="tt-text-muted">(Automatización)</span> tab and tap <strong>+</strong>.</p> },
    { id:'a-time', title:'Every day at a set time', body: <p>
      Choose <Action en="Time of Day" es="Hora del día" />, pick a time (for example <strong>06:00</strong>) and select <strong>Daily</strong>.
    </p> },
    { id:'a-run', title:'Run without asking', body: <p>
      Select <Action en="Run Immediately" es="Ejecutar inmediatamente" />. Turn off <em>Notify When Run</em> if you don’t want a banner.
    </p> },
    { id:'a-pick', title:'Pick your Shortcut', body: <p>
      Tap <strong>Next</strong>, choose <CopyChip value={SHORTCUT_NAME} /> and tap <strong>Done</strong>. For fresher data, add a second automation at another time; syncing twice never duplicates.
    </p> }
  ];

  const steps = part === 'shortcut' ? shortcutSteps : automationSteps;
  const count = (list:Step[]) => list.filter(step => done[step.id]).length;
  const shortcutComplete = count(shortcutSteps) === shortcutSteps.length || synced;

  return <div className="mx-auto max-w-2xl space-y-4">
    <PageHeader title="Apple Reminders setup" />
    <div className="tt-panel flex items-center gap-3 p-3 pl-4 text-sm">
      <span className="tt-empty-icon !mb-0 !h-9 !w-9 shrink-0"><IconBell size={18} /></span>
      <p className="min-w-0 flex-1">A daily iPhone Shortcut sends your reminders here. They are <strong>read only</strong> in TaskTimmer.</p>
    </div>
    <div className="tt-segmented flex w-full" role="tablist" aria-label="Setup part">
      {([['shortcut', '1 · Shortcut', shortcutSteps], ['automation', '2 · Automation', automationSteps]] as const).map(([id, label, list]) =>
        <button key={id} type="button" role="tab" aria-selected={part === id} aria-pressed={part === id} className="flex-1" onClick={() => { setPart(id); window.scrollTo({ top:0 }); }}>
          {label} <span className="tt-text-muted ml-1 text-xs tabular-nums">{count(list)}/{list.length}</span>
        </button>)}
    </div>
    {part === 'automation' && !shortcutComplete && <p className="tt-badge" data-variant="amber">Finish part 1 first: the automation runs that Shortcut.</p>}
    <ol className="space-y-2" role="tabpanel">
      {steps.map((step, index) => {
        const checked = !!done[step.id];
        return <li key={step.id} className={'tt-panel p-4 transition-opacity ' + (checked ? 'opacity-60' : '')}>
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => toggle(step.id)} aria-pressed={checked} aria-label={(checked ? 'Mark not done: ' : 'Mark done: ') + step.title}
              className={'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ' + (checked ? 'bg-emerald-500 text-white' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]')}>
              {checked ? <IconCheck size={15} strokeWidth={3} /> : index + 1}
            </button>
            <div className="min-w-0 flex-1 space-y-1 text-[15px] leading-relaxed">
              <h2 className="font-semibold leading-7">{step.title}</h2>
              {!checked && <div className="tt-text-muted">{step.body}</div>}
            </div>
          </div>
        </li>;
      })}
    </ol>
    <div className="flex gap-2">
      {part === 'shortcut'
        ? <Button className="flex-1" onClick={() => { setPart('automation'); window.scrollTo({ top:0 }); }}>Next: daily automation →</Button>
        : <Button variant="secondary" className="flex-1" onClick={() => { setPart('shortcut'); window.scrollTo({ top:0 }); }}>← Back to the Shortcut</Button>}
    </div>
  </div>;
}

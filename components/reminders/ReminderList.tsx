"use client";
import React, { useState } from 'react';
import { minutesToHHMM } from '../../lib/time';
import { useToast } from '../toast/ToastProvider';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { IconBell, IconCheck, IconChevronRight } from '../ui/icons';
import type { DayReminder } from './useWeekReminders';

/** Resolves to an error message, or null when the change was accepted. */
type OnComplete = (reminder:DayReminder, completed:boolean) => Promise<string | null>;

const priorityLabel = ['None', 'Low', 'Medium', 'High'];
function when(r:DayReminder) {
  if (!r.day) return 'No date';
  const date = new Date(r.day + 'T12:00:00').toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
  return date + ' · ' + (r.minute === null ? 'All day' : minutesToHHMM(r.minute));
}
/** Completed here but not yet delivered to the iPhone. */
const waiting = (r:DayReminder) => r.completed && !r.completionSentAt;

/** Complete / undo with feedback. Completing is queued: the iPhone applies it on the Shortcut's next run. */
function useComplete(onComplete?:OnComplete) {
  const { addToast } = useToast();
  return async (reminder:DayReminder) => {
    if (!onComplete) return;
    const next = !reminder.completed;
    const error = await onComplete(reminder, next);
    addToast(error ? { type:'error', message:error }
      : { type:'success', message:next ? 'Marked done. It reaches your iPhone the next time your Shortcut runs.' : 'Reminder reopened.' });
  };
}

function ReminderDetails({ reminder, onClose, onToggle }: { reminder:DayReminder | null; onClose:()=>void; onToggle?:(r:DayReminder)=>Promise<void> }) {
  const r = reminder;
  const [busy, setBusy] = useState(false);
  const locked = !!r && r.completed && !!r.completionSentAt; // already on the iPhone: undo only there
  return <Dialog open={!!r} onClose={onClose} title="Reminder">
    {r && <div className="space-y-4">
      <h3 className={'break-words text-lg font-semibold leading-snug ' + (r.completed ? 'tt-text-muted line-through' : '')}>
        {r.priority > 0 && !r.completed && <span className="mr-1.5 font-bold text-amber-600 dark:text-amber-400">{'!'.repeat(r.priority)}</span>}{r.title}
      </h3>
      <dl className="tt-list text-sm">
        {[['When', when(r)], ['List', r.list], ['Priority', r.priority ? priorityLabel[r.priority] : null], ['Flagged', r.flagged ? 'Yes' : null],
          ['Status', r.completed ? (waiting(r) ? 'Done · sends to your iPhone on the next sync' : 'Done') : null]]
          .filter(([, value]) => value)
          .map(([label, value]) => <div key={label} className="flex items-baseline gap-3 px-4 py-2.5"><dt className="tt-text-muted w-20 shrink-0">{label}</dt><dd className="min-w-0 flex-1 break-words font-medium">{value}</dd></div>)}
      </dl>
      <section aria-label="Notes">
        <h4 className="tt-label">Notes</h4>
        {r.notes
          ? <p className="whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed">{r.notes}</p>
          : <p className="tt-text-muted text-sm">No notes.</p>}
      </section>
      {onToggle && <Button className="w-full" variant={r.completed ? 'secondary' : 'primary'} loading={busy} disabled={locked}
        leftIcon={r.completed ? undefined : <IconCheck size={16} strokeWidth={3} />}
        onClick={async () => { setBusy(true); await onToggle(r); setBusy(false); }}>
        {r.completed ? (locked ? 'Done on your iPhone' : 'Undo') : 'Mark as done'}
      </Button>}
      <p className="tt-text-muted text-xs">Completing is the only change you can make here; it reaches the Reminders app when your Shortcut next syncs. Edit anything else in the Reminders app.</p>
    </div>}
  </Dialog>;
}

/** Apple Reminders. The circle completes one (and undoes it until it reaches the iPhone); the row opens its details and notes. */
export function ReminderList({ reminders, onComplete, className = '' }: { reminders:DayReminder[]; onComplete?:OnComplete; className?:string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useComplete(onComplete);
  if (!reminders.length) return null;
  const open = reminders.find(r => r.id === openId) || null;
  return <>
    <ul className={'tt-list ' + className} aria-label="Apple Reminders">
      {reminders.map(r => {
        const locked = r.completed && !!r.completionSentAt;
        const ring = r.completed ? 'border-emerald-500 bg-emerald-500 text-white' : r.flagged || r.priority === 3 ? 'border-amber-500 text-amber-500' : 'border-[var(--line-strong)] text-[var(--muted)]';
        return <li key={r.id} className="flex items-center">
          {onComplete
            ? <button type="button" onClick={() => toggle(r)} disabled={locked} aria-pressed={r.completed}
                aria-label={(r.completed ? 'Undo completing: ' : 'Complete: ') + r.title}
                className="flex h-12 w-12 shrink-0 items-center justify-center disabled:cursor-default">
                <span className={'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ' + ring}>
                  {r.completed ? <IconCheck size={11} strokeWidth={3} /> : <IconBell size={10} strokeWidth={2.5} />}
                </span>
              </button>
            : <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center">
                <span className={'flex h-5 w-5 items-center justify-center rounded-full border-2 ' + ring}>
                  {r.completed ? <IconCheck size={11} strokeWidth={3} /> : <IconBell size={10} strokeWidth={2.5} />}
                </span>
              </span>}
          <button type="button" onClick={() => setOpenId(r.id)} className="tt-row-button flex min-w-0 flex-1 items-center gap-2 py-2 pr-3" aria-label={'Reminder: ' + r.title + (r.notes ? ', has notes' : '')}>
            <span className="min-w-0 flex-1">
              <span className={'block truncate text-sm ' + (r.completed ? 'tt-text-muted line-through' : 'font-medium')}>
                {r.priority > 0 && !r.completed && <span className="mr-1 font-bold text-amber-600 dark:text-amber-400" aria-label={'Priority ' + r.priority}>{'!'.repeat(r.priority)}</span>}
                {r.title}
              </span>
              <span className="tt-text-muted block truncate text-xs tabular-nums">
                {!r.day ? 'No date' : r.minute === null ? 'All day' : minutesToHHMM(r.minute)}{r.list ? ' · ' + r.list : ''}
                {waiting(r) ? ' · Sends to iPhone on next sync' : r.notes ? ' · ' + r.notes.replace(/\s+/g, ' ') : ''}
              </span>
            </span>
            <IconChevronRight size={16} className="tt-text-muted shrink-0" />
          </button>
        </li>;
      })}
    </ul>
    <ReminderDetails reminder={open} onClose={() => setOpenId(null)} onToggle={onComplete ? toggle : undefined} />
  </>;
}

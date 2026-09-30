"use client";
import React, { useState } from 'react';
import { minutesToHHMM } from '../../lib/time';
import { Dialog } from '../ui/Dialog';
import { IconBell, IconCheck, IconChevronRight } from '../ui/icons';
import type { DayReminder } from './useWeekReminders';

const priorityLabel = ['None', 'Low', 'Medium', 'High'];
function when(r:DayReminder) {
  if (!r.day) return 'No date';
  const date = new Date(r.day + 'T12:00:00').toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
  return date + ' · ' + (r.minute === null ? 'All day' : minutesToHHMM(r.minute));
}

/** Read-only details of one reminder, including its notes. */
function ReminderDetails({ reminder, onClose }: { reminder:DayReminder | null; onClose:()=>void }) {
  const r = reminder;
  return <Dialog open={!!r} onClose={onClose} title="Reminder">
    {r && <div className="space-y-4">
      <h3 className="break-words text-lg font-semibold leading-snug">
        {r.priority > 0 && <span className="mr-1.5 font-bold text-amber-600 dark:text-amber-400">{'!'.repeat(r.priority)}</span>}{r.title}
      </h3>
      <dl className="tt-list text-sm">
        {[['When', when(r)], ['List', r.list], ['Priority', r.priority ? priorityLabel[r.priority] : null], ['Flagged', r.flagged ? 'Yes' : null]]
          .filter(([, value]) => value)
          .map(([label, value]) => <div key={label} className="flex items-baseline gap-3 px-4 py-2.5"><dt className="tt-text-muted w-20 shrink-0">{label}</dt><dd className="min-w-0 flex-1 break-words font-medium">{value}</dd></div>)}
      </dl>
      <section aria-label="Notes">
        <h4 className="tt-label">Notes</h4>
        {r.notes
          ? <p className="whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed">{r.notes}</p>
          : <p className="tt-text-muted text-sm">No notes.</p>}
      </section>
      <p className="tt-text-muted text-xs">Read only. Edit it in the Reminders app; changes arrive with the next sync.</p>
    </div>}
  </Dialog>;
}

/** Read-only list of pending Apple Reminders; tap one to see its details and notes. */
export function ReminderList({ reminders, className = '' }: { reminders:DayReminder[]; className?:string }) {
  const [open, setOpen] = useState<DayReminder | null>(null);
  if (!reminders.length) return null;
  return <>
    <ul className={'tt-list ' + className} aria-label="Apple Reminders">
      {reminders.map(r => <li key={r.id}>
        <button type="button" onClick={() => setOpen(r)} className="tt-row-button flex items-center gap-3 py-2 pl-4 pr-3" aria-label={'Reminder: ' + r.title + (r.notes ? ', has notes' : '')}>
          <span aria-hidden="true" className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (r.completed ? 'border-emerald-500 bg-emerald-500 text-white' : r.flagged || r.priority === 3 ? 'border-amber-500 text-amber-500' : 'border-[var(--line-strong)] text-[var(--muted)]')}>
            {r.completed ? <IconCheck size={11} strokeWidth={3} /> : <IconBell size={10} strokeWidth={2.5} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={'block truncate text-sm ' + (r.completed ? 'tt-text-muted line-through' : 'font-medium')}>
              {r.priority > 0 && !r.completed && <span className="mr-1 font-bold text-amber-600 dark:text-amber-400" aria-label={'Priority ' + r.priority}>{'!'.repeat(r.priority)}</span>}
              {r.title}
            </span>
            <span className="tt-text-muted block truncate text-xs tabular-nums">
              {!r.day ? 'No date' : r.minute === null ? 'All day' : minutesToHHMM(r.minute)}{r.list ? ' · ' + r.list : ''}{r.notes ? ' · ' + r.notes.replace(/\s+/g, ' ') : ''}
            </span>
          </span>
          <IconChevronRight size={16} className="tt-text-muted shrink-0" />
        </button>
      </li>)}
    </ul>
    <ReminderDetails reminder={open} onClose={() => setOpen(null)} />
  </>;
}

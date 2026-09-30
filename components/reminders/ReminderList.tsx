"use client";
import React from 'react';
import { minutesToHHMM } from '../../lib/time';
import { IconBell, IconCheck } from '../ui/icons';
import type { DayReminder } from './useWeekReminders';

/** Read-only list of Apple Reminders (they can only be changed in the Reminders app). */
export function ReminderList({ reminders, className = '' }: { reminders:DayReminder[]; className?:string }) {
  if (!reminders.length) return null;
  return <ul className={'tt-list ' + className} aria-label="Apple Reminders">
    {reminders.map(r => <li key={r.id} className="flex items-center gap-3 py-2 pl-4 pr-3" title={r.notes || undefined}>
      <span aria-hidden="true" className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (r.completed ? 'border-emerald-500 bg-emerald-500 text-white' : r.flagged || r.priority === 3 ? 'border-amber-500 text-amber-500' : 'border-[var(--line-strong)] text-[var(--muted)]')}>
        {r.completed ? <IconCheck size={11} strokeWidth={3} /> : <IconBell size={10} strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={'block truncate text-sm ' + (r.completed ? 'tt-text-muted line-through' : 'font-medium')}>
          {r.priority > 0 && !r.completed && <span className="mr-1 font-bold text-amber-600 dark:text-amber-400" aria-label={'Priority ' + r.priority}>{'!'.repeat(r.priority)}</span>}
          {r.title}
        </span>
        <span className="tt-text-muted block truncate text-xs tabular-nums">{r.minute === null ? 'All day' : minutesToHHMM(r.minute)}{r.list ? ' · ' + r.list : ''}{r.completed ? ' · Done' : ''}</span>
      </span>
    </li>)}
  </ul>;
}

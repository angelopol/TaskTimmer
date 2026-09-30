"use client";
import React from 'react';
import { useWeek } from './WeekContext';
import { IconButton } from '../ui/Button';
import { IconChevronLeft, IconChevronRight } from '../ui/icons';

/** Compact week switcher: ‹ label › — tapping the label returns to the current week. */
export function WeekNav({ onChange, className = '' }: { onChange?:()=>void; className?:string }) {
  const { gotoPrevWeek, gotoNextWeek, gotoThisWeek, weekRangeLabel, isThisWeek } = useWeek();
  const run = (fn:()=>void) => () => { onChange?.(); fn(); };
  return <div role="group" aria-label="Choose a week" className={'flex items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-0.5 ' + className}>
    <IconButton variant="ghost" className="!min-h-10 !w-10" icon={<IconChevronLeft size={18} />} label="Previous week" onClick={run(gotoPrevWeek)} />
    <button type="button" onClick={run(gotoThisWeek)} disabled={isThisWeek} title={isThisWeek ? undefined : 'Back to this week'}
      className="flex min-h-10 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 leading-tight disabled:cursor-default disabled:opacity-100">
      <span className="truncate text-sm font-semibold tabular-nums">{weekRangeLabel}</span>
      {!isThisWeek && <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Back to this week</span>}
    </button>
    <IconButton variant="ghost" className="!min-h-10 !w-10" icon={<IconChevronRight size={18} />} label="Next week" onClick={run(gotoNextWeek)} />
  </div>;
}

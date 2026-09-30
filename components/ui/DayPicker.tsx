"use client";
import React from 'react';
import { WEEKDAY_NAMES_LONG, WEEKDAY_NAMES_SHORT } from '../../lib/time';

/** Horizontal Mon–Sun selector. `dates` (YYYY-MM-DD per weekday) adds day numbers and a today marker. */
export function DayPicker({ value, onChange, dates, className = '', allLabel }: {
  value:number; onChange:(weekday:number)=>void; dates?:string[]; className?:string; allLabel?:string;
}) {
  const today = new Date();
  const todayISO = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  return <div role="group" aria-label="Choose a day" className={'tt-daypicker ' + className}>
    {allLabel && <button type="button" className="tt-day !flex-[1.3_0_52px]" aria-pressed={value === 0} onClick={() => onChange(0)}><span>&nbsp;</span><strong className="!text-sm">{allLabel}</strong></button>}
    {WEEKDAY_NAMES_SHORT.map((day, index) => {
      const date = dates?.[index];
      return <button key={day} type="button" className="tt-day" aria-pressed={value === index+1} data-today={date === todayISO || undefined}
        aria-label={WEEKDAY_NAMES_LONG[index] + (date ? ' ' + Number(date.slice(8)) : '')} onClick={() => onChange(index+1)}>
        <span>{day}</span><strong>{date ? Number(date.slice(8)) : day.charAt(0)}</strong>
      </button>;
    })}
  </div>;
}

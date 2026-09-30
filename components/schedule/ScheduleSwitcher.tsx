"use client";
import React, { useState } from 'react';
import ScheduleSegmentsClient from './ScheduleSegmentsClient';
import WeeklyScheduleTable from './WeeklyScheduleTable';
export default function ScheduleSwitcher({ initialMode = 'schedule' }: { initialMode?:'manage' | 'schedule' }) {
  const [mode, setMode] = useState(initialMode);
  function change(value:'manage' | 'schedule') {
    setMode(value);
    document.cookie = 'schedule_mode=' + value + '; path=/; max-age=7776000; SameSite=Lax';
  }
  return <div className="schedule-workspace space-y-7">
    <header className="tt-page-header"><div><p className="tt-eyebrow mb-2">Make space for your priorities</p><h1 className="tt-heading-page">Your schedule</h1><p className="tt-text-muted mt-2">Plan a routine that fits your life. Adjust it as you go.</p></div>
      <div className="tt-segmented" role="group" aria-label="Schedule view">
        <button type="button" aria-pressed={mode === 'schedule'} onClick={() => change('schedule')}>Week overview</button>
        <button type="button" aria-pressed={mode === 'manage'} onClick={() => change('manage')}>Edit routine</button>
      </div>
    </header>
    {mode === 'manage' ? <ScheduleSegmentsClient /> : <WeeklyScheduleTable onManage={() => change('manage')} />}
  </div>;
}

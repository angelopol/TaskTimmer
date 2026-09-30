"use client";
import React, { useState } from 'react';
import ScheduleSegmentsClient from './ScheduleSegmentsClient';
import WeeklyScheduleTable from './WeeklyScheduleTable';
import { PageHeader } from '../ui/PageHeader';
export default function ScheduleSwitcher({ initialMode = 'schedule' }: { initialMode?:'manage' | 'schedule' }) {
  const [mode, setMode] = useState(initialMode);
  function change(value:'manage' | 'schedule') {
    setMode(value);
    document.cookie = 'schedule_mode=' + value + '; path=/; max-age=7776000; SameSite=Lax';
  }
  return <div className="space-y-3">
    <PageHeader title="Schedule">
      <div className="tt-segmented max-sm:flex max-sm:w-full" role="group" aria-label="Schedule view">
        <button type="button" className="max-sm:flex-1" aria-pressed={mode === 'schedule'} onClick={() => change('schedule')}>This week</button>
        <button type="button" className="max-sm:flex-1" aria-pressed={mode === 'manage'} onClick={() => change('manage')}>Routine</button>
      </div>
    </PageHeader>
    {mode === 'manage' ? <ScheduleSegmentsClient /> : <WeeklyScheduleTable onManage={() => change('manage')} />}
  </div>;
}

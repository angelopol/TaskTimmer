"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from '../useApiClient';

export interface Reminder {
  id: string; title: string; notes: string | null; list: string | null;
  dueAt: string; allDay: boolean; completed: boolean; flagged: boolean; priority: number;
}
export interface DayReminder extends Reminder { day: string; minute: number | null }

const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calendar day of a reminder. Date-only reminders are stored at 12:00 UTC, so their UTC date is the real one. */
export function reminderDay(r: Reminder) {
  const due = new Date(r.dueAt);
  if (r.allDay && due.getUTCHours() === 12 && due.getUTCMinutes() === 0) return due.toISOString().slice(0, 10);
  return localISO(due);
}

/** Read-only Apple Reminders for the week starting at `weekStart` (local Monday, YYYY-MM-DD), keyed by local day. */
export function useWeekReminders(weekStart: string) {
  const { apiFetch } = useApiClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    const [y, m, d] = weekStart.split('-').map(Number);
    const from = new Date(y, m - 1, d), to = new Date(y, m - 1, d + 7);
    apiFetch<{ reminders: Reminder[]; lastSyncedAt: string | null }>(`/api/reminders?from=${from.toISOString()}&to=${to.toISOString()}`).then(res => {
      if (!active || !res.ok || !res.data) return;
      setReminders(res.data.reminders); setLastSyncedAt(res.data.lastSyncedAt);
    });
    return () => { active = false; };
  }, [apiFetch, weekStart, version]);
  useEffect(() => {
    window.addEventListener('focus', reload); window.addEventListener('reminders:changed', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('reminders:changed', reload); };
  }, [reload]);

  const byDay = useMemo(() => {
    const map: Record<string, DayReminder[]> = {};
    for (const r of reminders) {
      const due = new Date(r.dueAt);
      const day = reminderDay(r);
      (map[day] ||= []).push({ ...r, day, minute: r.allDay ? null : due.getHours() * 60 + due.getMinutes() });
    }
    for (const list of Object.values(map)) list.sort((a, b) => (a.minute ?? -1) - (b.minute ?? -1) || a.title.localeCompare(b.title));
    return map;
  }, [reminders]);

  return { byDay, lastSyncedAt, hasAny: reminders.length > 0, reload };
}

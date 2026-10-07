"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from '../useApiClient';

export interface Reminder {
  id: string; title: string; notes: string | null; list: string | null;
  dueAt: string | null; allDay: boolean; completed: boolean; flagged: boolean; priority: number;
  /** Set once a sync response has asked the iPhone to complete it; until then it can still be undone. */
  completionSentAt: string | null;
}
export interface DayReminder extends Reminder { day: string; minute: number | null }

const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calendar day of a reminder. Date-only reminders are stored at 12:00 UTC, so their UTC date is the real one. */
export function reminderDay(r: Reminder & { dueAt: string }) {
  const due = new Date(r.dueAt);
  if (r.allDay && due.getUTCHours() === 12 && due.getUTCMinutes() === 0) return due.toISOString().slice(0, 10);
  return localISO(due);
}

/**
 * Apple Reminders for the week starting at `weekStart` (local Monday, YYYY-MM-DD), keyed by local day.
 * They are a copy: only completing one is possible here, and it reaches the iPhone on the Shortcut's next sync.
 */
export function useWeekReminders(weekStart: string) {
  const { apiFetch } = useApiClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [undated, setUndated] = useState<Reminder[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    const [y, m, d] = weekStart.split('-').map(Number);
    const from = new Date(y, m - 1, d), to = new Date(y, m - 1, d + 7);
    apiFetch<{ reminders: Reminder[]; undated: Reminder[]; lastSyncedAt: string | null }>(`/api/reminders?from=${from.toISOString()}&to=${to.toISOString()}`).then(res => {
      if (!active || !res.ok || !res.data) return;
      setReminders(res.data.reminders); setUndated(res.data.undated || []); setLastSyncedAt(res.data.lastSyncedAt);
    });
    return () => { active = false; };
  }, [apiFetch, weekStart, version]);
  const patch = useCallback((id: string, change: Partial<Reminder>) => {
    const apply = (list: Reminder[]) => list.map(r => r.id === id ? { ...r, ...change } : r);
    setReminders(apply); setUndated(apply);
  }, []);
  /** Optimistic complete / reopen. Rolls back and returns the error message if the server refuses. */
  const setCompleted = useCallback(async (reminder: Reminder, completed: boolean) => {
    const previous = { completed: reminder.completed, completionSentAt: reminder.completionSentAt };
    patch(reminder.id, { completed, completionSentAt: null });
    const res = await apiFetch<{ reminder: Reminder }>(`/api/reminders/${reminder.id}`, { method: 'PATCH', json: { completed } });
    if (res.ok && res.data) { patch(reminder.id, res.data.reminder); return null; }
    patch(reminder.id, previous);
    if (res.status === 404 || res.status === 409) reload();
    return res.error || 'Could not update the reminder.';
  }, [apiFetch, patch, reload]);
  useEffect(() => {
    window.addEventListener('focus', reload); window.addEventListener('reminders:changed', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('reminders:changed', reload); };
  }, [reload]);

  const byDay = useMemo(() => {
    const map: Record<string, DayReminder[]> = {};
    for (const r of reminders) {
      if (!r.dueAt) continue;
      const due = new Date(r.dueAt);
      const day = reminderDay(r as Reminder & { dueAt: string });
      (map[day] ||= []).push({ ...r, day, minute: r.allDay ? null : due.getHours() * 60 + due.getMinutes() });
    }
    for (const list of Object.values(map)) list.sort((a, b) => (a.minute ?? -1) - (b.minute ?? -1) || a.title.localeCompare(b.title));
    return map;
  }, [reminders]);

  /** Reminders without a due date: they have no place in the calendar, so they are listed apart. */
  const noDate = useMemo<DayReminder[]>(() => undated.map(r => ({ ...r, day: '', minute: null })), [undated]);

  return { byDay, noDate, lastSyncedAt, hasAny: reminders.length > 0, setCompleted, reload };
}

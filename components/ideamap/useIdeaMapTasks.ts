"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from '../useApiClient';

export type TaskStatus = 'backlog' | 'selected' | 'inprogress' | 'done';
export const STATUS_LABELS: Record<TaskStatus, string> = { backlog:'Backlog', selected:'Selected', inprogress:'In progress', done:'Done' };
export const STATUS_ORDER: TaskStatus[] = ['backlog', 'selected', 'inprogress', 'done'];

export interface IdeaMapTask {
  id: number; title: string; type: string; status: TaskStatus; priority: string;
  startDate: string | null; dueDate: string | null; completedAt: string | null; description: string | null;
  project: { id: number; key: string; name: string }; url: string; canUpdate: boolean;
}

/**
 * Live IdeaMap tasks assigned to the user, for the week starting `weekStart` (YYYY-MM-DD).
 * Due dates are plain dates, so they are grouped by that string with no time-zone math.
 */
export function useIdeaMapTasks(weekStart: string) {
  const { apiFetch } = useApiClient();
  const [tasks, setTasks] = useState<IdeaMapTask[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    apiFetch<{ connected:boolean; tasks:IdeaMapTask[]; error?:string }>('/api/ideamap/tasks?since=' + weekStart).then(res => {
      if (!active) return;
      if (res.data) { setConnected(res.data.connected); setTasks(res.data.tasks); }
      setError(res.ok ? '' : res.error || 'Could not load IdeaMap tasks.');
    });
    return () => { active = false; };
  }, [apiFetch, weekStart, version]);
  useEffect(() => {
    window.addEventListener('focus', reload); window.addEventListener('ideamap:changed', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('ideamap:changed', reload); };
  }, [reload]);

  /** Optimistic status change; rolls back and returns the error message if IdeaMap refuses it. */
  const setStatus = useCallback(async (task:IdeaMapTask, status:TaskStatus) => {
    const previous = task.status;
    const patch = (value:TaskStatus, extra:Partial<IdeaMapTask> = {}) => setTasks(list => list.map(t => t.id === task.id ? { ...t, status:value, ...extra } : t));
    patch(status);
    const res = await apiFetch<{ task:IdeaMapTask }>(`/api/ideamap/tasks/${task.id}/status`, { method:'PUT', json:{ status } });
    if (res.ok && res.data) { patch(res.data.task.status, res.data.task); return null; }
    patch(previous);
    if (res.status === 409) reload();
    return res.error || 'Could not update the task in IdeaMap.';
  }, [apiFetch, reload]);

  const { byDay, unscheduled } = useMemo(() => {
    const byDay: Record<string, IdeaMapTask[]> = {};
    const unscheduled: IdeaMapTask[] = [];
    for (const task of tasks) {
      if (task.dueDate) (byDay[task.dueDate] ||= []).push(task);
      // Open tasks with no date, or due before the week on screen, would otherwise stay out of sight.
      if (task.status !== 'done' && (!task.dueDate || task.dueDate < weekStart)) unscheduled.push(task);
    }
    const rank = (t:IdeaMapTask) => (t.status === 'done' ? 1 : 0);
    for (const list of Object.values(byDay)) list.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
    unscheduled.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    return { byDay, unscheduled };
  }, [tasks, weekStart]);

  return { connected, error, byDay, unscheduled, setStatus, reload };
}

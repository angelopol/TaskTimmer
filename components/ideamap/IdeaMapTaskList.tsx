"use client";
import React, { useState } from 'react';
import { useToast } from '../toast/ToastProvider';
import { Dialog } from '../ui/Dialog';
import { IconCheck, IconChevronRight } from '../ui/icons';
import { STATUS_LABELS, STATUS_ORDER, type IdeaMapTask, type TaskStatus } from './useIdeaMapTasks';

type SetStatus = (task:IdeaMapTask, status:TaskStatus) => Promise<string | null>;

const statusDot: Record<TaskStatus, string> = { backlog:'#94a3b8', selected:'#6366f1', inprogress:'#f59e0b', done:'#16a34a' };
const priorityLabel: Record<string, string> = { '5':'Highest', '4':'High', '3':'Medium', '2':'Low', '1':'Lowest' };
const formatDate = (iso:string | null) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }) : null;

/** IdeaMap brand mark: small, so rows stay recognisable next to Apple Reminders. */
export function IdeaMapBadge({ className = '' }: { className?:string }) {
  return <span aria-hidden="true" className={'inline-flex h-4 shrink-0 items-center rounded bg-sky-100 px-1 text-[10px] font-bold leading-none text-sky-800 dark:bg-sky-950 dark:text-sky-200 ' + className}>IM</span>;
}

function TaskSheet({ task, onClose, setStatus }: { task:IdeaMapTask | null; onClose:()=>void; setStatus:SetStatus }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function change(status:TaskStatus) {
    if (!task || busy || status === task.status) return;
    setBusy(true);
    const error = await setStatus(task, status);
    setBusy(false);
    addToast(error ? { type:'error', message:error } : { type:'success', message:'Moved to ' + STATUS_LABELS[status] + ' in IdeaMap.' });
    if (!error) onClose();
  }
  return <Dialog open={!!task} onClose={onClose} title="IdeaMap task" busy={busy}>
    {task && <div className="space-y-4">
      <div>
        <p className="tt-text-muted flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"><IdeaMapBadge />{task.project.name}</p>
        <h3 className="mt-1 break-words text-lg font-semibold leading-snug">{task.title}</h3>
      </div>
      <fieldset>
        <legend className="tt-label">Status</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Status">
          {STATUS_ORDER.map(status => <button key={status} type="button" role="radio" aria-checked={task.status === status} disabled={!task.canUpdate || busy} onClick={() => change(status)}
            className={'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ' + (task.status === status ? 'border-transparent text-white' : 'border-[var(--line-strong)] bg-[var(--surface)] hover:bg-[var(--surface-2)] disabled:opacity-60')}
            style={task.status === status ? { background:statusDot[status] } : undefined}>
            {task.status !== status && <span aria-hidden="true" className="tt-dot" style={{ background:statusDot[status] }} />}{STATUS_LABELS[status]}
          </button>)}
        </div>
        {!task.canUpdate && <p className="tt-text-muted mt-2 text-xs">Your role in this project can view tasks but not change their status.</p>}
      </fieldset>
      <dl className="tt-list text-sm">
        {[['Due', formatDate(task.dueDate)], ['Start', formatDate(task.startDate)], ['Priority', priorityLabel[task.priority]], ['Type', task.type.charAt(0).toUpperCase() + task.type.slice(1)]]
          .filter(([, value]) => value)
          .map(([label, value]) => <div key={label} className="flex items-baseline gap-3 px-4 py-2.5"><dt className="tt-text-muted w-20 shrink-0">{label}</dt><dd className="min-w-0 flex-1 font-medium">{value}</dd></div>)}
      </dl>
      {task.description && <section aria-label="Description">
        <h4 className="tt-label">Description</h4>
        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed">{task.description}</p>
      </section>}
      <a href={task.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--line-strong)] text-sm font-semibold hover:bg-[var(--surface-2)]">Open in IdeaMap ↗</a>
    </div>}
  </Dialog>;
}

/** Assigned IdeaMap tasks. The circle completes (or reopens) a task; the row opens its details. */
export function IdeaMapTaskList({ tasks, setStatus, showDate = false, className = '' }: { tasks:IdeaMapTask[]; setStatus:SetStatus; showDate?:boolean; className?:string }) {
  const { addToast } = useToast();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!tasks.length) return null;
  const open = tasks.find(task => task.id === openId) || null;
  async function toggle(task:IdeaMapTask) {
    const next:TaskStatus = task.status === 'done' ? 'inprogress' : 'done';
    const error = await setStatus(task, next);
    addToast(error ? { type:'error', message:error } : { type:'success', message:next === 'done' ? 'Task completed in IdeaMap.' : 'Task reopened in IdeaMap.' });
  }
  return <>
    <ul className={'tt-list ' + className} aria-label="IdeaMap tasks">
      {tasks.map(task => {
        const done = task.status === 'done';
        return <li key={task.id} className="flex items-center">
          <button type="button" onClick={() => toggle(task)} disabled={!task.canUpdate} aria-pressed={done}
            aria-label={(done ? 'Reopen: ' : 'Complete: ') + task.title}
            className="flex h-12 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50">
            <span className={'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ' + (done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[var(--line-strong)]')}>
              {done && <IconCheck size={11} strokeWidth={3} />}
            </span>
          </button>
          <button type="button" onClick={() => setOpenId(task.id)} className="tt-row-button flex min-w-0 flex-1 items-center gap-2 py-2 pr-3" aria-label={'IdeaMap task: ' + task.title}>
            <span className="min-w-0 flex-1">
              <span className={'block truncate text-sm ' + (done ? 'tt-text-muted line-through' : 'font-medium')}>{task.title}</span>
              <span className="tt-text-muted flex items-center gap-1.5 truncate text-xs">
                <IdeaMapBadge />
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background:statusDot[task.status] }} />
                <span className="truncate">{STATUS_LABELS[task.status]} · {task.project.name}{showDate ? ' · ' + (formatDate(task.dueDate) || 'No date') : ''}</span>
              </span>
            </span>
            <IconChevronRight size={16} className="tt-text-muted shrink-0" />
          </button>
        </li>;
      })}
    </ul>
    <TaskSheet task={open} onClose={() => setOpenId(null)} setStatus={setStatus} />
  </>;
}

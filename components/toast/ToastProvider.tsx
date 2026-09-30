"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IconButton } from '../ui/Button';
import { IconAlert, IconCheck, IconClose } from '../ui/icons';
interface Toast { id:string; message:string; type?:'info' | 'success' | 'error'; duration?:number; }
const Context = createContext<{ addToast:(toast:Omit<Toast, 'id'>)=>void } | null>(null);
function ToastMessage({ toast, dismiss }: { toast:Toast; dismiss:(id:string)=>void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? (toast.type === 'error' ? 8000 : 4000));
    return () => clearTimeout(timer);
  }, [toast, paused, dismiss]);
  const error = toast.type === 'error';
  return <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 py-1.5 pl-4 pr-1.5 text-white shadow-xl shadow-black/20 [animation:dialog-in_.2s_ease-out] dark:bg-slate-100 dark:text-slate-900">
    <span aria-hidden="true" className={error ? 'text-red-400 dark:text-red-600' : 'text-emerald-400 dark:text-emerald-600'}>{error ? <IconAlert size={18} /> : <IconCheck size={18} />}</span>
    <p className="min-w-0 flex-1 py-1.5 text-sm font-medium" role={error ? 'alert' : 'status'}>{toast.message}</p>
    <IconButton icon={<IconClose size={16} />} variant="ghost" className="!min-h-9 !w-9 !text-current opacity-70 hover:!bg-white/10 dark:hover:!bg-black/10" label="Dismiss" onClick={() => dismiss(toast.id)} />
  </div>;
}
export function ToastProvider({ children }: { children:React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id:string) => setToasts(previous => previous.filter(toast => toast.id !== id)), []);
  const addToast = useCallback((toast:Omit<Toast, 'id'>) => setToasts(previous => [...previous.slice(-2), { ...toast, id:Math.random().toString(36).slice(2) }]), []);
  return <Context.Provider value={{ addToast }}>{children}<div role="region" aria-label="Notifications"
    className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+12px)] z-[60] mx-auto max-w-sm space-y-2 sm:inset-x-auto sm:bottom-5 sm:right-5">{toasts.map(toast => <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />)}</div></Context.Provider>;
}
export function useToast() { const context = useContext(Context); if (!context) throw new Error('Missing ToastProvider'); return context; }

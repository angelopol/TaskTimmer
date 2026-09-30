"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IconButton } from '../ui/Button';
import { IconClose } from '../ui/icons';
interface Toast { id:string; message:string; type?:'info' | 'success' | 'error'; duration?:number; }
const Context = createContext<{ addToast:(toast:Omit<Toast, 'id'>)=>void } | null>(null);
function ToastMessage({ toast, dismiss }: { toast:Toast; dismiss:(id:string)=>void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || toast.type === 'error') return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? 6000);
    return () => clearTimeout(timer);
  }, [toast, paused, dismiss]);
  return <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    className="tt-panel pointer-events-auto flex items-start gap-3 border-l-4 !p-4 shadow-lg" style={{ borderLeftColor:toast.type === 'error' ? '#dc2626' : toast.type === 'success' ? '#16a34a' : '#6366f1' }}>
    <div className="min-w-0 flex-1" role={toast.type === 'error' ? 'alert' : 'status'}><p className="text-sm font-semibold">{toast.type === 'error' ? 'Something went wrong' : toast.type === 'success' ? 'All set' : 'Good to know'}</p><p className="tt-text-muted mt-1 text-sm">{toast.message}</p></div>
    <IconButton icon={<IconClose size={17} />} variant="ghost" label="Dismiss notification" onClick={() => dismiss(toast.id)} />
  </div>;
}
export function ToastProvider({ children }: { children:React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id:string) => setToasts(previous => previous.filter(toast => toast.id !== id)), []);
  const addToast = useCallback((toast:Omit<Toast, 'id'>) => setToasts(previous => [...previous.slice(-3), { ...toast, id:Math.random().toString(36).slice(2) }]), []);
  return <Context.Provider value={{ addToast }}>{children}<div role="region" aria-label="Notifications" className="pointer-events-none fixed bottom-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-sm space-y-3">{toasts.map(toast => <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />)}</div></Context.Provider>;
}
export function useToast() { const context = useContext(Context); if (!context) throw new Error('Missing ToastProvider'); return context; }

"use client";
import React, { createContext, useCallback, useContext, useState } from 'react';

interface Toast { id: string; message: string; type?: 'info' | 'success' | 'error'; duration?: number; }
interface ToastContextValue { addToast: (t: Omit<Toast,'id'>) => void; }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }){
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((t: Omit<Toast,'id'>)=>{
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { duration: 2500, type: 'info', ...t, id };
    setToasts(prev => [...prev, toast]);
    setTimeout(()=>{
      setToasts(prev => prev.filter(x=>x.id!==id));
    }, toast.duration);
  }, []);
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`text-xs px-3 py-2 rounded shadow border bg-white dark:bg-gray-900 dark:border-gray-700 flex items-center gap-2
            ${t.type==='success' ? 'border-green-600 text-green-700 dark:text-green-400' : ''}
            ${t.type==='error' ? 'border-red-600 text-red-700 dark:text-red-400' : ''}
            ${t.type==='info' ? 'border-gray-300 text-gray-700 dark:text-gray-300' : ''}
          `}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(){
  const ctx = useContext(ToastContext);
  if(!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

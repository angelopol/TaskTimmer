"use client";
import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
export function PWARegister() {
  const [updated, setUpdated] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync(); window.addEventListener('online', sync); window.addEventListener('offline', sync);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdated(true);
          });
        });
      }).catch(() => {});
    }
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  if (!updated && !offline) return null;
  return <div role="status" className="tt-panel fixed bottom-4 left-4 z-40 max-w-[calc(100%-2rem)] p-4 shadow-lg sm:max-w-sm">
    {offline ? <p className="text-sm">You are offline. Reconnect before saving changes.</p> : <><p className="text-sm">An update is ready. Finish saving your work, then reload.</p><div className="mt-3 flex gap-2"><Button onClick={() => window.location.reload()}>Reload</Button><Button variant="ghost" onClick={() => setUpdated(false)}>Later</Button></div></>}
  </div>;
}

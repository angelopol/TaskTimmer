"use client";
import { useEffect, useState } from 'react';

export function PWARegister(){
  const [updated, setUpdated] = useState(false);
  useEffect(()=>{
    if(!('serviceWorker' in navigator)) return;
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if(!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdated(true);
            }
          });
        });
      } catch(e){
        console.warn('SW registration failed', e);
      }
    };
    registerSW();
  }, []);

  if(!updated) return null;
  return (
    <div className="fixed bottom-3 right-3 z-50 tt-panel tt-panel-padding shadow-lg flex items-center gap-3">
      <span className="text-xs">Nueva versión disponible</span>
      <button className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500" onClick={()=> window.location.reload() }>Actualizar</button>
    </div>
  );
}

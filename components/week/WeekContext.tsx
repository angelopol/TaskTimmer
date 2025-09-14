"use client";
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { isoDate } from '../../lib/time';

export interface WeekContextValue {
  weekStart: string; // YYYY-MM-DD Monday local
  setWeekStart: (d: string)=>void;
  gotoPrevWeek: ()=>void;
  gotoNextWeek: ()=>void;
  gotoThisWeek: ()=>void;
  weekRangeLabel: string; // e.g. 09 Sep – 15 Sep 2025
}

const WeekContext = createContext<WeekContextValue | undefined>(undefined);

function computeMonday(date: Date){
  // Use local date math only; avoid toISOString (which is UTC) to prevent accidental day shifts near DST / timezone edges.
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 0,0,0,0);
  const y = monday.getFullYear();
  const m = (monday.getMonth()+1).toString().padStart(2,'0');
  const d = monday.getDate().toString().padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function formatRange(mondayISO: string){
  const [y,m,d] = mondayISO.split('-').map(Number);
  const monday = new Date(y, m-1, d);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = (dt: Date)=> dt.toLocaleDateString(undefined, { day:'2-digit', month:'short' });
  const year = sunday.getFullYear();
  return `${fmt(monday)} – ${fmt(sunday)} ${year}`;
}

export function WeekProvider({ children }: { children: React.ReactNode }){
  const [weekStart, _setWeekStart] = useState(()=> computeMonday(new Date()));

  const setWeekStart = useCallback((d: string)=>{
    _setWeekStart(prev => prev === d ? prev : d);
  }, []);

  // Simple debounce window to avoid multiple rapid clicks triggering duplicate loads.
  const [navLock, setNavLock] = useState<number>(0);
  const NAV_DELAY = 120; // ms
  const withLock = useCallback((fn: ()=>void)=>{
    const now = Date.now();
    if(now < navLock) return; // ignore rapid press
    setNavLock(now + NAV_DELAY);
    fn();
  }, [navLock]);

  const gotoPrevWeek = useCallback(()=>{
    withLock(()=>{
      _setWeekStart(prev => {
        const [y,m,d] = prev.split('-').map(Number);
        const dt = new Date(y, m-1, d - 7);
        return computeMonday(dt);
      });
    });
  }, [withLock]);
  const gotoNextWeek = useCallback(()=>{
    withLock(()=>{
      _setWeekStart(prev => {
        const [y,m,d] = prev.split('-').map(Number);
        const dt = new Date(y, m-1, d + 7);
        return computeMonday(dt);
      });
    });
  }, [withLock]);
  const gotoThisWeek = useCallback(()=>{
    setWeekStart(computeMonday(new Date()));
  }, []);

  const value = useMemo<WeekContextValue>(()=>({
    weekStart,
    setWeekStart,
    gotoPrevWeek,
    gotoNextWeek,
    gotoThisWeek,
    weekRangeLabel: formatRange(weekStart)
  }), [weekStart, gotoPrevWeek, gotoNextWeek, gotoThisWeek]);

  return <WeekContext.Provider value={value}>{children}</WeekContext.Provider>;
}

export function useWeek(){
  const ctx = useContext(WeekContext);
  if(!ctx) throw new Error('useWeek must be used within WeekProvider');
  return ctx;
}

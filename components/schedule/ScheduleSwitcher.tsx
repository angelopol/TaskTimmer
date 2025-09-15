"use client";
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ScheduleSegmentsClient from './ScheduleSegmentsClient';
import WeeklyScheduleTable from './WeeklyScheduleTable';

interface SegmentMeta { id: string; weekday: number; startMinute: number; endMinute: number; }

const STORAGE_KEY = 'tasktimmer_schedule_mode';

interface Props { initialMode?: 'manage' | 'schedule'; }

export default function ScheduleSwitcher({ initialMode = 'manage' }: Props){
  const [mode, setMode] = useState<'manage' | 'schedule'>(initialMode);
  // Removed counters (segments / interval count), so related state is no longer needed.

  // Light-weight fetch for counts (does not include activities to reduce payload, but API currently returns full objects; we just map minimal fields)
  // Removed effect fetching counts (no longer displayed).

  // Load persisted mode once on mount
  useEffect(()=>{
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'manage' || saved === 'schedule') {
        setMode(saved);
      }
    } catch (e) { /* ignore */ }
  }, [initialMode]);

  // Persist on change
  useEffect(()=>{
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      // set cookie (90d) - simple document.cookie write
      const maxAge = 60*60*24*90; // 90 days
      document.cookie = `schedule_mode=${mode}; path=/; max-age=${maxAge}`;
    } catch (e) { /* ignore */ }
  }, [mode]);
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <div className="relative inline-flex text-xs font-medium rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
          <button
            onClick={()=>setMode('manage')}
            className={`flex items-center gap-1 px-3 py-1 transition-colors ${mode==='manage' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11.983 1.164a1 1 0 00-1.966 0l-.263 1.582a6.964 6.964 0 00-1.429.826L6.88 2.64a1 1 0 00-1.415 1.414l.932 1.445a6.964 6.964 0 00-.826 1.429l-1.582.263a1 1 0 000 1.966l1.582.263c.17.5.42.978.826 1.429l-.932 1.445a1 1 0 101.415 1.414l1.445-.932c.45.406.929.656 1.429.826l.263 1.582a1 1 0 001.966 0l.263-1.582c.5-.17.978-.42 1.429-.826l1.445.932a1 1 0 001.414-1.414l-.932-1.445c.406-.45.656-.929.826-1.429l1.582-.263a1 1 0 000-1.966l-1.582-.263a6.964 6.964 0 00-.826-1.429l.932-1.445A1 1 0 0015.54 2.64l-1.445.932a6.964 6.964 0 00-1.429-.826l-.263-1.582zM10 13a3 3 0 110-6 3 3 0 010 6z"/></svg>
            Manage
          </button>
          <button
            onClick={()=>setMode('schedule')}
            className={`flex items-center gap-1 px-3 py-1 transition-colors border-l border-gray-300 dark:border-gray-600 ${mode==='schedule' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1z"/><path fillRule="evenodd" d="M18 9H2v7a2 2 0 002 2h12a2 2 0 002-2V9zM7 11a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            Schedule
          </button>
        </div>
      </div>
      <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {mode === 'manage' ? (
              <ScheduleSegmentsClient />
            ) : (
              <WeeklyScheduleTable />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

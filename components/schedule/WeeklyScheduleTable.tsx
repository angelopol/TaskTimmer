"use client";
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState, EmptyState } from '../ui/Feedback';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { DayPicker } from '../ui/DayPicker';
import { IconAdd, IconBell, IconCalendar, IconChevronLeft, IconChevronRight, IconEdit, IconList, IconSegment, IconTrash } from '../ui/icons';
import { minutesToHHMM, WEEKDAY_NAMES_LONG, WEEKDAY_NAMES_SHORT, combineDateAndTime, fmtMinutes, fmtHoursMinutes } from '../../lib/time';
import { useWeek } from '../week/WeekContext';
import { useToast } from '../toast/ToastProvider';
import { useUnit } from '../UnitProvider';
import { WeekNav } from '../week/WeekNav';
import { useWeekReminders, type DayReminder } from '../reminders/useWeekReminders';
import { ReminderList } from '../reminders/ReminderList';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; activity?: Activity | null; }
interface TempFreeSlot { temp: true; weekday: number; startMinute: number; endMinute: number; }
interface FreeLogCellData { totalMinutes: number; activities: { activityId: string; name: string; color: string | null; minutes: number; percent: number; }[]; dominantActivityId: string | null; }

const SOURCES = ['PLANNED','ADHOC','MAKEUP'] as const;
type Source = typeof SOURCES[number];

// We will produce a consolidated table:
// Rows = unique time ranges across week (merged identical adjacent minute ranges from segments definition)
// Each cell = activity name or FREE (empty) if no segment or segment with null activity.

export default function WeeklyScheduleTable({ onManage }: { onManage:()=>void }){
  const [view, setView] = useState<'agenda' | 'grid'>('agenda');
  const [retry, setRetry] = useState(0);
  const { weekStart, gotoNextWeek, gotoPrevWeek } = useWeek();
  const { unit } = useUnit();
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay() || 7);
  const todayISO = (() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); })();
  const [segments, setSegments] = useState<Segment[]>([]);
  // Removed historical snapshot mode & fetch counters
  const lastLoadKeyRef = useRef<string>(''); // prevent duplicate loads for same key (weekStart|mode)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Modal state
  const [open, setOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null | TempFreeSlot>(null);
  const [useFullRange, setUseFullRange] = useState(true);
  const [startHHMM, setStartHHMM] = useState('');
  const [endHHMM, setEndHHMM] = useState('');
  const [activityId, setActivityId] = useState<string>('');
  const [partial, setPartial] = useState(false);
  const [source, setSource] = useState<Source>('PLANNED');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  // Modal logs state (existing logs inside selected segment / free interval)
  const [modalLogs, setModalLogs] = useState<any[]>([]);
  const [modalLogsLoading, setModalLogsLoading] = useState(false);
  const [modalLogsPage, setModalLogsPage] = useState(0);
  const MODAL_LOGS_PAGE_SIZE = 20;
  // Minimum size (minutes) for showing a free gap inside a segment timeline list.
  const MIN_GAP_MINUTES = 2;
  const [editingModalLogId, setEditingModalLogId] = useState<string | null>(null);
  const [editModalLogDraft, setEditModalLogDraft] = useState<{ start: string; end: string; activityId: string; source: Source; partial: boolean; comment: string; } | null>(null);
  const [modalLogSaving, setModalLogSaving] = useState(false);
  const [pendingDeleteLogId, setPendingDeleteLogId] = useState<string | number | null>(null); // two-step delete
  const { addToast } = useToast();
  const [segmentLoggedMinutes, setSegmentLoggedMinutes] = useState<Record<string, number>>({});
  const [segmentDominantActivity, setSegmentDominantActivity] = useState<Record<string,{ activityId: string | null; minutes: number }>>({});
  const [segmentBreakdown, setSegmentBreakdown] = useState<Record<string,{ activityId: string | null; minutes: number }[]>>({});
  const [usageUpdating, setUsageUpdating] = useState(false);
  const [hasLoadedUsage, setHasLoadedUsage] = useState(false);
  // Free (unsegmented) logs per cell map
  const [freeLogsMap, setFreeLogsMap] = useState<Record<string, FreeLogCellData>>({});
  const [loadingFreeLogs, setLoadingFreeLogs] = useState(false);
  // Removed debug functionality (was ENABLE_DEBUG, debugAllowed, showDebug, debugInfo)
  const [includeEmptySegmentsAsFree, setIncludeEmptySegmentsAsFree] = useState(false);

  // Restaurar preferencia toggle empty segments from localStorage
  useEffect(()=>{
    try {
      const v = localStorage.getItem('tt_include_empty_segments_as_free');
      if(v === '1') setIncludeEmptySegmentsAsFree(true);
    } catch {}
  },[]);
  useEffect(()=>{
    try { localStorage.setItem('tt_include_empty_segments_as_free', includeEmptySegmentsAsFree ? '1':'0'); } catch {}
  },[includeEmptySegmentsAsFree]);

  // Fetch logged minutes per segment (current week) after load & after creation
  async function refreshSegmentUsage(){
    setUsageUpdating(true);
    try {
      if(!segments.length){
        setSegmentLoggedMinutes({});
        return;
      }
      const ts = Date.now();
      // Ensure we request usage for the currently viewed week (weekStart Monday)
      const res = await fetch(`/api/segments/usage?weekStart=${weekStart}&ts=${ts}`, { cache: 'no-store' });
      const data = await res.json();
      if(res.ok){
        setSegmentLoggedMinutes(data.usage || {});
  if(data.dominant){ setSegmentDominantActivity(data.dominant); }
  if(data.breakdown){ setSegmentBreakdown(data.breakdown); }
        setHasLoadedUsage(true);
      }
    } catch {
      // swallow for now; could add toast/addToast({type:'error', message:'Usage refresh failed'})
    } finally {
      setUsageUpdating(false);
    }
  }

  useEffect(()=>{
    setError(null);
    (async ()=>{
      try {
        setLoading(true);
        const params = new URLSearchParams();
        // Always send weekStart so backend can produce stable snapshot server-side (historical mode removed)
        params.set('weekStart', weekStart);
        const segUrl = `/api/schedule/segments?${params.toString()}`;
        const [segRes, actRes] = await Promise.all([
          fetch(segUrl, { cache: 'no-store' }),
          fetch('/api/activities', { cache: 'no-store' })
        ]);
  const segData = await segRes.json();
        if(!segRes.ok) throw new Error(segData.error || 'Failed to load segments');
        const segs = segData.segments || [];
        setSegments(segs);
        const actData = await actRes.json();
        if(!actRes.ok) throw new Error(actData.error || 'Failed to load activities');
        setActivities(actData.activities || []);
        // Fetch usage immediately (avoid waiting for next tick)
        if(segs.length){
          try {
            const ts = Date.now();
            const usageRes = await fetch(`/api/segments/usage?weekStart=${weekStart}&ts=${ts}`, { cache: 'no-store' });
            const usageData = await usageRes.json();
            if(usageRes.ok){
              setSegmentLoggedMinutes(usageData.usage || {});
              if(usageData.dominant){ setSegmentDominantActivity(usageData.dominant); }
              if(usageData.breakdown){ setSegmentBreakdown(usageData.breakdown); }
              setHasLoadedUsage(true);
            }
          } catch {/* ignore usage error on first load */}
          // (Se retira la carga inmediata de free logs aquí; se hará en un efecto dependiente de segments+rows)
        }
      } catch(e:any){ setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [weekStart, retry]);

  // Ref para prevenir cargas duplicadas de free logs en StrictMode / renders repetidos
  const lastFreeLogsKeyRef = useRef<string>('');

  // When a new log is created elsewhere listen to event to refresh usage map
  useEffect(()=>{
    function handler(){ refreshSegmentUsage(); }
    if(typeof window !== 'undefined') window.addEventListener('timelog:created', handler as any);
    return ()=> { if(typeof window !== 'undefined') window.removeEventListener('timelog:created', handler as any); };
  }, [segments]);

  // Listen to new timelog events to refresh free logs too
  useEffect(()=>{
    function handler(){ loadFreeLogs(); }
    if(typeof window !== 'undefined') window.addEventListener('timelog:created', handler as any);
    return ()=> { if(typeof window !== 'undefined') window.removeEventListener('timelog:created', handler as any); };
  }, [segments]);

  // Build unique boundaries
  const rows = useMemo(()=>{
    if(segments.length===0) return [] as { start: number; end: number; }[];
    const boundaries = new Set<number>();
    for(const s of segments){
      boundaries.add(s.startMinute); boundaries.add(s.endMinute);
    }
    // Ensure outer day free time (before first segment and after last) can host free logs:
    // Adding 0 and 1440 guarantees rows like [0, firstStart] and [lastEnd, 1440] so
    // free logs occurring completely outside any segment range are still mappable.
    boundaries.add(0); boundaries.add(1440);
    const sorted = Array.from(boundaries).sort((a,b)=>a-b);
    const intervals: { start:number; end:number; }[] = [];
    for(let i=0;i<sorted.length-1;i++){
      const start = sorted[i]; const end = sorted[i+1];
      if(end>start) intervals.push({ start, end });
    }
    return intervals;
  }, [segments]);

  // Synthetic rows (cuando no existen segmentos) generadas a partir de los logs libres
  const [syntheticRows, setSyntheticRows] = useState<{ start:number; end:number; }[]>([]);
  const effectiveRows = rows.length ? rows : syntheticRows; // grid real que se renderiza

  // Auto-cargar / recargar free logs cuando cambian segmentos, filas (rows) o la semana
  useEffect(()=>{
    const key = weekStart + '|' + segments.length + '|' + rows.length;
    if(lastFreeLogsKeyRef.current === key) return; // evita duplicados (e.g., StrictMode)
    lastFreeLogsKeyRef.current = key;
    loadFreeLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, rows, weekStart]);

  // Map for quick lookup: weekday -> list of segments
  const byDay = useMemo(()=>{
    const map: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of segments) map[s.weekday].push(s);
    return map;
  }, [segments]);

  function cellActivity(weekday:number, start:number, end:number){
    // Find segment that fully covers this interval
    const seg = byDay[weekday].find(s=> s.startMinute <= start && s.endMinute >= end);
    if(!seg) return { seg: null, name: 'Open time', color: null };
    if(!seg.activityId) return { seg, name: 'Open time', color: null };
    return { seg, name: seg.activity?.name || 'UNKNOWN', color: seg.activity?.color || null };
  }

  function weekDateForWeekday(weekday:number){
    // weekday 1..7 Monday..Sunday -> compute date relative to shared weekStart (local Monday)
    const [y,m,d] = weekStart.split('-').map(Number);
    const monday = new Date(y, m-1, d, 0,0,0,0); // local midnight Monday
    const target = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (weekday-1), 0,0,0,0);
    const pad = (n:number)=> n.toString().padStart(2,'0');
    return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}`; // avoid toISOString to prevent UTC day shift
  }

  function getWeekRange(){
    // Derive week range from context weekStart (already Monday ISO date string)
    const [y,m,d] = weekStart.split('-').map(Number);
    const monday = new Date(y, m-1, d, 0,0,0,0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23,59,59,999);
    const pad = (n:number)=> n.toString().padStart(2,'0');
    const from = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
    const to = `${sunday.getFullYear()}-${pad(sunday.getMonth()+1)}-${pad(sunday.getDate())}`;
    return { from, to };
  }

  function timeStrToMinutes(hhmm:string){
    return parseInt(hhmm.slice(0,2))*60 + parseInt(hhmm.slice(3));
  }

  async function loadFreeLogs(){
    try {
      setLoadingFreeLogs(true);
      const { from } = getWeekRange(); // Monday ISO date
      const ts = Date.now();
      // La API acepta weekStart y devuelve { logs:[], ... }
      let res = await fetch(`/api/logs?weekStart=${from}&limit=5000&order=asc&ts=${ts}`, { cache: 'no-store' });
      if(!res.ok){ throw new Error('Failed free logs (weekStart)'); }
      let payload: any = await res.json();
      let logs = Array.isArray(payload.logs) ? payload.logs : [];
      // Eliminado fallback que mezclaba logs de la semana actual: si no hay logs, se queda vacío.
  const map: Record<string, FreeLogCellData> = {};
  const hadAnyLogs = logs.length > 0;

      // Si no hay segmentos definidos, construimos filas sintéticas basadas en límites de logs
      let nextSyntheticRows: { start:number; end:number; }[] | null = null;
      if(!segments.length){
        const globalBoundaries = new Set<number>([0,1440]);
        for(const log of logs){
          if(!log.startedAt) continue;
          const startDateTime = new Date(log.startedAt);
          const endDateTime = log.endedAt ? new Date(log.endedAt) : new Date();
          if(endDateTime <= startDateTime) continue;
          let cursor = new Date(startDateTime);
          while(cursor < endDateTime){
            const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23,59,59,999);
            const sliceEnd = endDateTime < dayEnd ? endDateTime : dayEnd;
            const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0,0,0,0);
            const sliceStartM = Math.floor((cursor.getTime() - dayStart.getTime())/60000);
            const rawEndM = (sliceEnd.getTime() - dayStart.getTime())/60000;
            const sliceEndM = Math.ceil(rawEndM - 1e-9);
            if(sliceEndM > sliceStartM){
              globalBoundaries.add(sliceStartM); globalBoundaries.add(sliceEndM);
            }
            cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0,0,0,0);
          }
        }
        const sortedB = Array.from(globalBoundaries).sort((a,b)=>a-b);
        const synthetic: {start:number; end:number;}[] = [];
        for(let i=0;i<sortedB.length-1;i++){ const a=sortedB[i], b=sortedB[i+1]; if(b>a) synthetic.push({start:a,end:b}); }
        nextSyntheticRows = synthetic;
      } else if(syntheticRows.length){
        // Limpiar si había filas sintéticas previas
        setSyntheticRows([]);
      }
      // Precomputar celdas libres para depuración
      const mappingRows = rows.length ? rows : (nextSyntheticRows ?? syntheticRows);
      const freeCellKeys: string[] = [];
      for(const r of mappingRows){
        for(let day=1; day<=7; day++){
          const seg = byDay[day].find(s=> s.startMinute <= r.start && s.endMinute >= r.end);
          if(!seg){
            freeCellKeys.push(`${day}:${r.start}-${r.end}`);
          }
        }
      }
      const unmatched: any[] = [];
      let cellUpdates = 0;
      for(const log of logs){
        // Only consider logs that are NOT explicitly linked to a segment; these are the ones we want to surface as overlays
        if (log.segmentId) continue;
        if(!log.startedAt) continue;
        const startDateTime = new Date(log.startedAt);
        const endDateTime = log.endedAt ? new Date(log.endedAt) : new Date();
        if(endDateTime <= startDateTime) continue;
        let cursor = new Date(startDateTime);
        let matchedThisLog = false;
        const sliceDebug: any[] = [];
        while(cursor < endDateTime){
          const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23,59,59,999);
          const sliceEnd = endDateTime < dayEnd ? endDateTime : dayEnd;
          const sliceDay = cursor.getDay(); // 0..6
          const weekday = (sliceDay === 0 ? 7 : sliceDay); // 1..7
          // Normalización robusta a minutos: floor inicio, ceil fin (si hay segundos/ms se incluye el minuto final)
          const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0,0,0,0);
          const sliceStartM = Math.floor((cursor.getTime() - dayStart.getTime())/60000);
          let rawEndM = (sliceEnd.getTime() - dayStart.getTime())/60000;
          // Trabajamos con intervalos half-open [sliceStartM, sliceEndM)
          // Tomamos ceil exacto y NO restamos 1 minuto completo; solo asegura que segundos parciales cuenten.
          const sliceEndM = Math.ceil(rawEndM - 1e-9);
          if(sliceEndM > sliceStartM){
            // Map this slice into ALL cells (free or planned) for overlay purposes
            for(const interval of mappingRows){
              const cellStart = interval.start; const cellEnd = interval.end;
              const overlapStart = Math.max(sliceStartM, cellStart);
              const overlapEnd = Math.min(sliceEndM, cellEnd);
              if(overlapEnd <= overlapStart) continue;
              const delta = overlapEnd - overlapStart;
              const key = `${weekday}:${cellStart}-${cellEnd}`;
              let entry = map[key];
              if(!entry){
                entry = { totalMinutes:0, activities:[], dominantActivityId: null };
                map[key] = entry;
              }
              entry.totalMinutes += delta;
              if(log.activity){
                const aId = log.activity.id;
                let actEntry = entry.activities.find(a=>a.activityId===aId);
                if(!actEntry){
                  actEntry = { activityId: aId, name: log.activity.name, color: log.activity.color || null, minutes:0, percent:0 };
                  entry.activities.push(actEntry);
                }
                actEntry.minutes += delta;
              }
              cellUpdates++;
              matchedThisLog = true;
            }
            sliceDebug.push({ weekday, sliceStartM, sliceEndM });
          }
          // Advance cursor to next day start
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0,0,0,0);
        }
        if(!matchedThisLog){
          // Track a few samples for diagnostics only
          unmatched.push({ id: log.id, startedAt: log.startedAt, endedAt: log.endedAt, activity: log.activity?.name, segmentId: log.segmentId, slices: sliceDebug });
        }
      }
      // finalize percent & dominant
      Object.values(map).forEach(entry=>{
        if(entry.totalMinutes>0){
          entry.activities.sort((a,b)=> b.minutes - a.minutes);
          entry.dominantActivityId = entry.activities[0]?.activityId || null;
          entry.activities.forEach(a=>{ a.percent = Math.round((a.minutes / entry.totalMinutes)*100); });
        }
      });
      if(!segments.length){
        setSyntheticRows(nextSyntheticRows || []);
      }
      setFreeLogsMap(map);
      const diag = {
        weekStart: from,
        fetchedLogs: logs.length,
        rows: (rows.length ? rows : syntheticRows).length,
        rowsSource: rows.length ? 'segments' : 'synthetic',
        freeCells: freeCellKeys.length,
        cellsWithData: Object.keys(map).length,
        cellUpdates,
        unmatchedCount: unmatched.length,
        unmatched: unmatched.slice(0,10), // muestra primeros
        sampleCells: Object.entries(map).slice(0,10).map(([k,v])=> ({ k, total:v.totalMinutes, acts: v.activities.map(a=>({name:a.name,m:a.minutes})) })),
        rawPayload: payload
      };
  // Debug info removed (diag object no longer stored or printed)
    } catch(e){
      // silent for now
    } finally { setLoadingFreeLogs(false); }
  }

  function openModal(seg: Segment | TempFreeSlot){
    setSelectedSegment(seg);
    setUseFullRange(true);
    setStartHHMM(minutesToHHMM(seg.startMinute));
    setEndHHMM(minutesToHHMM(seg.endMinute));
    if('temp' in seg){
      // free slot: no segment => leave empty activity (user selects) or could guess dominant from overlapping logs (not available by segment id)
      setActivityId('');
    } else {
      // Preselect activity:
      if(seg.activityId){
        setActivityId(seg.activityId);
      } else {
        const bd = segmentBreakdown[seg.id];
        const dom = segmentDominantActivity[seg.id];
        if(bd && bd.length === 1 && bd[0].activityId){
          setActivityId(bd[0].activityId);
        } else if(dom && dom.activityId){
          setActivityId(dom.activityId);
        } else {
          setActivityId('');
        }
      }
    }
    setPartial(false);
    setSource('temp' in seg ? 'ADHOC' : 'PLANNED');
    setComment('');
    setModalError(null);
    setModalLogs([]);
    setModalLogsPage(0);
    setOpen(true);
  }

  function closeModal(){
    if(saving || modalLogSaving) return;
    setOpen(false);
    setSelectedSegment(null);
    setModalLogs([]);
  }

  async function submitModal(e: React.FormEvent){
    e.preventDefault(); if(!selectedSegment) return; setSaving(true); setModalError(null);
    try {
      // Validate times inside segment
      const startMin = parseInt(startHHMM.slice(0,2))*60 + parseInt(startHHMM.slice(3));
      const endMin = parseInt(endHHMM.slice(0,2))*60 + parseInt(endHHMM.slice(3));
      if(endMin <= startMin) throw new Error('End must be after start.');
      if(startMin < selectedSegment.startMinute || endMin > selectedSegment.endMinute){
        throw new Error('Time must stay within this block.');
      }
      const date = weekDateForWeekday(selectedSegment.weekday);
      const startedAt = combineDateAndTime(date, startHHMM);
      const endedAt = combineDateAndTime(date, endHHMM);
      const body = {
        activityId: activityId || null,
        segmentId: ('temp' in selectedSegment) ? null : selectedSegment.id,
        date,
        startedAt,
        endedAt,
        partial,
        source,
        comment: comment.trim() || null
      };
      const res = await fetch('/api/logs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Save failed');
      // Emit custom event for other components (e.g., LogTimeForm) to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('timelog:created'));
      }
      setOpen(false); setSelectedSegment(null);
  addToast({ message:'Time added.', type:'success'});
      refreshSegmentUsage();
      // Reload modal logs after creation (if still open)
      if(open){
        fetchModalLogs(selectedSegment, 0, true);
      }
  } catch(e:any){ setModalError(e.message); addToast({ type:'error', message: e.message || 'Failed to create log' }); }
    finally { setSaving(false); }
  }

  // Fetch logs that fall within the selected segment or free interval boundaries for its weekday.
  // For real segments, include BOTH logs linked to the segment and free (unsegmentId) logs that overlap the interval.
  async function fetchModalLogs(seg: Segment | TempFreeSlot, page: number, replace = false){
    try {
      setModalLogsLoading(true);
      const date = weekDateForWeekday(seg.weekday);
      // Build base params
      const base = new URLSearchParams();
      base.set('weekStart', weekStart);
      base.set('date', date);
      base.set('limit', '250');
      base.set('order', 'asc');

      let logs: any[] = [];
      if('temp' in seg){
        // Free interval: only fetch unlinked logs for that date
        const p = new URLSearchParams(base);
        p.set('noSegment', '1');
        const res = await fetch(`/api/logs?${p.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to fetch logs');
        logs = Array.isArray(data.logs) ? data.logs : [];
      } else {
        // Segment interval: fetch both linked-to-segment and free logs, then merge
        const pSeg = new URLSearchParams(base); pSeg.set('segmentId', seg.id);
        const pFree = new URLSearchParams(base); pFree.set('noSegment', '1');
        const [resSeg, resFree] = await Promise.all([
          fetch(`/api/logs?${pSeg.toString()}`, { cache: 'no-store' }),
          fetch(`/api/logs?${pFree.toString()}`, { cache: 'no-store' })
        ]);
        const [dataSeg, dataFree] = await Promise.all([resSeg.json(), resFree.json()]);
        if(!resSeg.ok) throw new Error(dataSeg.error || 'Failed to fetch segment logs');
        if(!resFree.ok) throw new Error(dataFree.error || 'Failed to fetch free logs');
        const arrSeg = Array.isArray(dataSeg.logs) ? dataSeg.logs : [];
        const arrFree = Array.isArray(dataFree.logs) ? dataFree.logs : [];
        // Merge unique by id
        const byId: Record<string, any> = {};
        for(const l of [...arrSeg, ...arrFree]){ if(l && l.id) byId[l.id] = l; }
        logs = Object.values(byId);
      }
      // If free interval (temp) include ONLY unsegmented logs overlapping the interval
      const intervalStart = seg.startMinute;
      const intervalEnd = seg.endMinute;
      // Additional client-side overlap filter (safety) by comparing startedAt/endedAt minute offsets
      const filtered = logs.filter(l => {
        const st = new Date(l.startedAt);
        const et = new Date(l.endedAt);
        if(et <= st) return false;
        const dayStart = new Date(st.getFullYear(), st.getMonth(), st.getDate(), 0,0,0,0);
        const startM = Math.floor((st.getTime() - dayStart.getTime())/60000);
        const endM = Math.ceil((et.getTime() - dayStart.getTime())/60000 - 1e-9);
        return endM > intervalStart && startM < intervalEnd; // overlap
      });
      // Sort ascending by startedAt (already asc if order=asc but keep for safety) then stable.
      filtered.sort((a,b)=> new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
      // Simple pagination client-side (slice)
      const startIdx = page * MODAL_LOGS_PAGE_SIZE;
      const pageItems = filtered.slice(startIdx, startIdx + MODAL_LOGS_PAGE_SIZE);
      setModalLogs(prev => replace ? pageItems : [...prev, ...pageItems]);
  } catch(e:any){ setModalError(e.message); addToast({ type:'error', message: e.message || 'Could not load entries.' }); }
    finally { setModalLogsLoading(false); }
  }

  // Load logs on modal open & when page increments
  useEffect(()=>{
    if(!open || !selectedSegment) return;
    fetchModalLogs(selectedSegment, modalLogsPage, modalLogsPage===0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedSegment, modalLogsPage]);

  function beginEditModalLog(l: any){
    if(modalLogSaving) return;
    const st = new Date(l.startedAt);
    const et = new Date(l.endedAt);
    const pad = (n:number)=> n.toString().padStart(2,'0');
    const hhmm = (d:Date)=> `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEditingModalLogId(l.id);
    setEditModalLogDraft({
      start: hhmm(st),
      end: hhmm(et),
      activityId: l.activity?.id || '',
      source: l.source as Source,
      partial: !!l.partial,
      comment: l.comment || ''
    });
  }

  function cancelEditModalLog(){
    if(modalLogSaving) return;
    setEditingModalLogId(null);
    setEditModalLogDraft(null);
  }

  async function saveModalLog(l: any){
    if(!editModalLogDraft || modalLogSaving) return;
    try {
      setModalLogSaving(true);
      const date = weekDateForWeekday(selectedSegment!.weekday);
      // Build startedAt/endedAt with combineDateAndTime so we preserve local timezone semantics
      const startedAt = combineDateAndTime(date, editModalLogDraft.start);
      const endedAt = combineDateAndTime(date, editModalLogDraft.end);
      if(new Date(endedAt) <= new Date(startedAt)) throw new Error('End must be after start');
      // Validate within segment / free interval bounds
      if(selectedSegment){
        const newStartMin = timeStrToMinutes(editModalLogDraft.start);
        const newEndMin = timeStrToMinutes(editModalLogDraft.end);
        if(!( 'temp' in selectedSegment) && (newStartMin < selectedSegment.startMinute || newEndMin > selectedSegment.endMinute)){
          throw new Error('This time is outside the block. Edit it in the Time log instead.');
        }
      }
      const body: any = {
        activityId: editModalLogDraft.activityId || null,
        startedAt, endedAt,
        source: editModalLogDraft.source,
        partial: editModalLogDraft.partial,
        comment: editModalLogDraft.comment.trim() || null
      };
      const res = await fetch(`/api/logs?id=${l.id}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Update failed');
      // Update local list
      setModalLogs(curr => curr.map(x => x.id === l.id ? { ...x, ...data.log } : x));
      setEditingModalLogId(null);
      setEditModalLogDraft(null);
      refreshSegmentUsage();
      // Also refresh free logs panel if editing a free log
      if(selectedSegment){
        // Refresh free logs regardless (covers free & segment edits impacting free cells)
        loadFreeLogs();
      }
  addToast({ message: 'Entry updated.', type: 'success' });
  } catch(e:any){ setModalError(e.message); addToast({ type:'error', message: e.message || 'Could not update the entry.' }); }
    finally { setModalLogSaving(false); }
  }

  async function deleteModalLog(l: any){
    if(modalLogSaving) return;
    // Two-step inline confirmation: first click arms, second click executes within 4s window
    if(pendingDeleteLogId !== l.id){
      setPendingDeleteLogId(l.id);

      return;
    }
    try {
      setModalLogSaving(true);
      const res = await fetch(`/api/logs?id=${l.id}`, { method: 'DELETE' });
      if(!res.ok){
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setPendingDeleteLogId(null);
      setModalLogs(curr => curr.filter(x=>x.id !== l.id));
      refreshSegmentUsage();
      loadFreeLogs();
  addToast({ message: 'Entry deleted.', type: 'success' });
    } catch(e:any){ setModalError(e.message); }
    finally { setModalLogSaving(false); }
  }

  function useGapRange(startMin: number, endMin: number){
    if(!selectedSegment) return;
    setUseFullRange(false);
    setStartHHMM(minutesToHHMM(startMin));
    setEndHHMM(minutesToHHMM(endMin));
  }

  // Build gaps + logs unified timeline for current segment (non-temp)
  function buildSegmentTimelineWithGaps(){
    if(!selectedSegment || ('temp' in selectedSegment)) return null;
    const segStart = selectedSegment.startMinute;
    const segEnd = selectedSegment.endMinute;
    const entries = modalLogs.map(l => {
      const st = new Date(l.startedAt); const et = new Date(l.endedAt);
      const startMin = st.getHours()*60 + st.getMinutes();
      const endMin = et.getHours()*60 + et.getMinutes();
      return { l, startMin: Math.max(segStart, startMin), endMin: Math.min(segEnd, endMin) };
    }).filter(e => e.endMin > e.startMin).sort((a,b)=> a.startMin - b.startMin);
    const gaps: { id:string; startMin:number; endMin:number }[] = [];
    let cursor = segStart;
    for(const e of entries){
      if(e.startMin > cursor){
        const gapSize = e.startMin - cursor;
        if(gapSize >= MIN_GAP_MINUTES){
          gaps.push({ id:`gap-${cursor}-${e.startMin}`, startMin: cursor, endMin: e.startMin });
        }
      }
      cursor = Math.max(cursor, e.endMin);
    }
    if(cursor < segEnd){
      const tail = segEnd - cursor;
      if(tail >= MIN_GAP_MINUTES){
        gaps.push({ id:`gap-${cursor}-${segEnd}`, startMin: cursor, endMin: segEnd });
      }
    }
    const items: Array<{ type:'gap'; id:string; startMin:number; endMin:number } | { type:'log'; id:string; data:any; startMin:number; endMin:number }> = [];
    for(const g of gaps) items.push({ type:'gap', id:g.id, startMin:g.startMin, endMin:g.endMin });
    for(const e of entries) items.push({ type:'log', id:e.l.id, data:e.l, startMin:e.startMin, endMin:e.endMin });
    items.sort((a,b)=> a.startMin - b.startMin || (a.type==='gap' ? -1 : 1));
    return { items, segStart, segEnd };
  }

  const fmt = (n:number) => unit === 'min' ? fmtMinutes(n) : fmtHoursMinutes(n);
  const reminders = useWeekReminders(weekStart);

  /** Moves the selected day; stepping past Sunday opens next week's Monday, and before Monday last week's Sunday. */
  const shiftDay = useCallback((delta:number) => {
    const next = selectedDay + delta;
    if(next > 7){ gotoNextWeek(); setSelectedDay(1); }
    else if(next < 1){ gotoPrevWeek(); setSelectedDay(7); }
    else setSelectedDay(next);
  }, [selectedDay, gotoNextWeek, gotoPrevWeek]);

  // Phone carousel (Day by day): children are [previous-week edge, Mon … Sun, next-week edge].
  const carousel = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = carousel.current;
    if(!el || getComputedStyle(el).display !== 'flex') return; // grid layout on larger screens
    const target = el.children[selectedDay] as HTMLElement | undefined;
    if(!target || Math.abs(el.scrollLeft - target.offsetLeft) < 2) return;
    // First placement after mounting (or a week change, which remounts) jumps; taps on the day picker glide.
    el.scrollTo({ left:target.offsetLeft, behavior:el.dataset.placed ? 'smooth' : 'auto' });
    el.dataset.placed = '1';
  }, [selectedDay, weekStart, view, loading]);
  function onCarouselScroll(){
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = carousel.current;
      if(!el || !el.clientWidth) return;
      el.dataset.placed = '1';
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if(index <= 0 || index >= 8) delete el.dataset.placed; // crossing weeks: land on the new day without gliding
      if(index <= 0) shiftDay(-selectedDay);          // previous-week edge → last Sunday
      else if(index >= 8) shiftDay(8 - selectedDay);  // next-week edge → next Monday
      else if(index !== selectedDay) setSelectedDay(index);
    }, 90);
  }
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Time grid on phones shows one day: a horizontal swipe changes it (same week rules as the carousel).
  const swipeStart = useRef<{ x:number; y:number } | null>(null);
  const gridSwipe = {
    onTouchStart:(e:React.TouchEvent) => { const t = e.touches[0]; swipeStart.current = { x:t.clientX, y:t.clientY }; },
    onTouchEnd:(e:React.TouchEvent) => {
      const start = swipeStart.current; swipeStart.current = null;
      if(!start || window.innerWidth >= 640) return;
      const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
      if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1);
    }
  };
  /** Read-only Apple Reminders of `weekday` due in [start, end). All-day ones only count for a whole-day range. */
  function remindersIn(weekday:number, start:number, end:number): DayReminder[] {
    const list = reminders.byDay[weekDateForWeekday(weekday)] || [];
    return list.filter(r => r.minute === null ? start === 0 && end === 1440 : r.minute >= start && r.minute < end);
  }
  const activityById = useMemo(() => Object.fromEntries(activities.map(a => [a.id, a])) as Record<string, Activity>, [activities]);
  const sourceLabel: Record<Source, string> = { PLANNED:'Scheduled', ADHOC:'Unplanned', MAKEUP:'Catch-up' };
  const weekDates = useMemo(() => [1,2,3,4,5,6,7].map(weekDateForWeekday), [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  type ChipItem = { key:string; name:string; color:string | null; minutes:number };
  function renderChips(items:ChipItem[], limit = 2){
    if(!items.length) return null;
    return <span className="flex min-w-0 flex-wrap gap-1">
      {items.slice(0, limit).map(item => <span key={item.key} className="tt-chip" style={{ background:(item.color || '#94a3b8') + '26', color:'var(--ink)' }} title={item.name + ' · ' + fmt(item.minutes)}>
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background:item.color || '#94a3b8' }} />
        <span className="truncate">{item.name}</span><span className="opacity-70">{fmt(item.minutes)}</span>
      </span>)}
      {items.length > limit && <span className="tt-chip bg-[var(--surface-2)] text-[var(--muted)]" title={items.slice(limit).map(i => i.name + ' ' + fmt(i.minutes)).join(', ')}>+{items.length - limit}</span>}
    </span>;
  }

  // Consecutive rows covered by the same segment (or by open time) are merged per day with rowSpan,
  // so a block reads as one card instead of being sliced by other days' boundaries.
  interface GridCell { row:number; span:number; seg:Segment | null; start:number; end:number; overlay?:FreeLogCellData; }
  const gridColumns = useMemo(() => {
    const result: Record<number, Record<number, GridCell>> = {};
    for(let day=1; day<=7; day++){
      const cells: GridCell[] = [];
      effectiveRows.forEach((r, row) => {
        const seg = byDay[day].find(s => s.startMinute <= r.start && s.endMinute >= r.end) || null;
        const overlay = freeLogsMap[`${day}:${r.start}-${r.end}`];
        const last = cells[cells.length-1];
        if(last && (last.seg?.id ?? null) === (seg?.id ?? null) && last.end === r.start){
          last.span++; last.end = r.end;
          if(overlay){
            const merged: FreeLogCellData = last.overlay ? { ...last.overlay, activities:last.overlay.activities.map(a => ({ ...a })) } : { totalMinutes:0, activities:[], dominantActivityId:null };
            merged.totalMinutes += overlay.totalMinutes;
            for(const a of overlay.activities){
              const found = merged.activities.find(x => x.activityId === a.activityId);
              if(found) found.minutes += a.minutes; else merged.activities.push({ ...a });
            }
            merged.activities.sort((a,b) => b.minutes - a.minutes);
            merged.dominantActivityId = merged.activities[0]?.activityId || null;
            last.overlay = merged;
          }
        } else cells.push({ row, span:1, seg, start:r.start, end:r.end, overlay });
      });
      result[day] = Object.fromEntries(cells.map(cell => [cell.row, cell]));
    }
    return result;
  }, [effectiveRows, byDay, freeLogsMap]);

  function renderGridCell(day:number, cell:GridCell){
    const seg = cell.seg;
    const label = `${minutesToHHMM(cell.start)}–${minutesToHHMM(cell.end)}`;
    const overlayChips: ChipItem[] = (cell.overlay?.activities || []).map(a => ({ key:'o'+a.activityId, name:a.name, color:a.color, minutes:a.minutes }));
    let body: React.ReactNode, style: React.CSSProperties | undefined, kind = 'free', name = 'Free';
    if(seg){
      kind = 'block';
      const breakdown = segmentBreakdown[seg.id] || [];
      const dom = segmentDominantActivity[seg.id];
      const logged = segmentLoggedMinutes[seg.id] || 0;
      const planned = seg.endMinute - seg.startMinute;
      const color = seg.activity?.color || null;
      const otherChips: ChipItem[] = breakdown.filter(b => b.activityId !== seg.activityId).map(b => {
        const a = b.activityId ? activityById[b.activityId] : undefined;
        return { key:'b'+(b.activityId || 'none'), name:a?.name || 'Unassigned', color:a?.color || null, minutes:b.minutes };
      });
      const replaced = !!(seg.activityId && dom?.activityId && dom.activityId !== seg.activityId);
      name = seg.activity?.name || (dom?.activityId && activityById[dom.activityId]?.name) || 'Open block';
      style = color ? { background:color + '1c', borderLeft:'3px solid ' + color } : { background:'var(--surface-2)', borderLeft:'3px dashed var(--line-strong)' };
      body = <>
        <span className={'tt-cell-name ' + (replaced ? 'line-through opacity-60' : '')}>{name}</span>
        {seg.activityId && <span className={'tt-cell-meta ' + (usageUpdating ? 'opacity-60' : '')}>{hasLoadedUsage ? fmt(logged) + ' / ' + fmt(planned) : '…'}</span>}
        {seg.activityId && hasLoadedUsage && <span className="tt-progress block !h-1 w-full"><span className="block h-full rounded-full" style={{ width:Math.min(100, Math.round(logged / planned * 100)) + '%', background:color || '#6366f1' }} /></span>}
        {renderChips([...otherChips, ...overlayChips])}
      </>;
    } else {
      body = <>
        <span className="tt-cell-name font-medium">{overlayChips.length ? 'Free · ' + fmt(cell.overlay!.totalMinutes) : 'Free'}</span>
        {renderChips(overlayChips)}
      </>;
    }
    const cellReminders = remindersIn(day, cell.start, cell.end).filter(r => r.minute !== null);
    const pending = cellReminders.filter(r => !r.completed).length;
    return <td key={day} rowSpan={cell.span} className={day === selectedDay ? '' : 'max-sm:hidden'}>
      <button type="button" className={'tt-cell ' + (cellReminders.length ? 'pr-9' : '')} data-kind={kind} style={style}
        onClick={() => seg ? openModal(seg) : openModal({ temp:true, weekday:day, startMinute:cell.start, endMinute:cell.end })}
        aria-label={`${WEEKDAY_NAMES_LONG[day-1]}, ${label}, ${name}${cellReminders.length ? `, ${cellReminders.length} reminder${cellReminders.length === 1 ? '' : 's'}` : ''}. Record time`}>
        {body}
        {cellReminders.length > 0 && <span aria-hidden="true" title={cellReminders.map(r => `${minutesToHHMM(r.minute!)} ${r.title}${r.completed ? ' ✓' : ''}`).join('\n')}
          className={'absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ' + (pending ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200')}>
          <IconBell size={10} strokeWidth={2.5} />{cellReminders.length}
        </span>}
      </button>
    </td>;
  }

  function renderModalLog(l:any, range?:{ startMin:number; endMin:number }){
    const st = new Date(l.startedAt); const et = new Date(l.endedAt);
    const pad = (n:number)=> n.toString().padStart(2,'0');
    const tm = (d:Date)=> `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const dur = l.minutes ?? Math.round((et.getTime()-st.getTime())/60000);
    const rangeLabel = range ? `${minutesToHHMM(range.startMin)}–${minutesToHHMM(range.endMin)}` : `${tm(st)}–${tm(et)}`;
    if(editingModalLogId === l.id && editModalLogDraft && selectedSegment){
      const newStartMin = timeStrToMinutes(editModalLogDraft.start);
      const newEndMin = timeStrToMinutes(editModalLogDraft.end);
      const within = 'temp' in selectedSegment || (newStartMin >= selectedSegment.startMinute && newEndMin <= selectedSegment.endMinute);
      const newDur = Math.max(0, newEndMin - newStartMin);
      return <li key={l.id} className="space-y-3 bg-[var(--surface-2)] p-3">
        <div className="grid grid-cols-2 gap-2">
          <label><span className="tt-label">Start</span><input type="time" className="tt-input tt-input-sm" value={editModalLogDraft.start} onChange={e=> setEditModalLogDraft(d=> d? {...d, start: e.target.value }: d)} /></label>
          <label><span className="tt-label">End</span><input type="time" className="tt-input tt-input-sm" value={editModalLogDraft.end} onChange={e=> setEditModalLogDraft(d=> d? {...d, end: e.target.value }: d)} /></label>
          <label><span className="tt-label">Activity</span><select className="tt-input tt-input-sm" value={editModalLogDraft.activityId} onChange={e=> setEditModalLogDraft(d=> d? {...d, activityId: e.target.value }: d)}>
            <option value="">No activity</option>{activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
          <label><span className="tt-label">Type</span><select className="tt-input tt-input-sm" value={editModalLogDraft.source} onChange={e=> setEditModalLogDraft(d=> d? {...d, source: e.target.value as Source }: d)}>
            {SOURCES.map(s=> <option key={s} value={s}>{sourceLabel[s]}</option>)}
          </select></label>
          <input type="text" aria-label="Note" placeholder="Note" className="tt-input tt-input-sm col-span-2" value={editModalLogDraft.comment} onChange={e=> setEditModalLogDraft(d=> d? {...d, comment: e.target.value }: d)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="tt-check !min-h-9"><input type="checkbox" checked={editModalLogDraft.partial} onChange={e=> setEditModalLogDraft(d=> d? {...d, partial: e.target.checked }: d)} />Partial</label>
          <span className="tt-badge" data-variant={within ? 'blue' : 'red'}>{within ? fmt(newDur) : 'Outside this block'}</span>
          <span className="ml-auto flex gap-2">
            <Button variant="ghost" className="!min-h-9" disabled={modalLogSaving} onClick={cancelEditModalLog}>Cancel</Button>
            <Button className="!min-h-9" loading={modalLogSaving} onClick={()=> saveModalLog(l)}>Save</Button>
          </span>
        </div>
      </li>;
    }
    if(pendingDeleteLogId === l.id){
      return <li key={l.id} className="flex items-center gap-2 bg-red-50 px-4 py-2 dark:bg-red-950/30">
        <span className="min-w-0 flex-1 text-sm font-medium">Delete {rangeLabel}?</span>
        <Button variant="ghost" className="!min-h-9" disabled={modalLogSaving} onClick={()=> setPendingDeleteLogId(null)}>Cancel</Button>
        <Button variant="danger" className="!min-h-9" loading={modalLogSaving} onClick={()=> deleteModalLog(l)}>Delete</Button>
      </li>;
    }
    return <li key={l.id} className="flex items-center gap-3 py-2 pl-4 pr-1">
      <span aria-hidden="true" className="tt-dot" style={{ background:l.activity?.color || '#94a3b8' }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{l.activity?.name || 'Unassigned'}</span>
        <span className="tt-text-muted block truncate text-xs tabular-nums">{rangeLabel} · {fmt(dur)} · {sourceLabel[l.source as Source]}{l.partial ? ' · Partial' : ''}{l.comment ? ' · ' + l.comment : ''}</span>
      </span>
      <Menu label="Entry options" items={[
        { label:'Edit', icon:<IconEdit size={17} />, disabled:modalLogSaving, onSelect:() => beginEditModalLog(l) },
        { label:'Delete', icon:<IconTrash size={17} />, danger:true, disabled:modalLogSaving, onSelect:() => setPendingDeleteLogId(l.id) }
      ]} />
    </li>;
  }

  const segmentModal = selectedSegment ? (
    <Dialog open={open} onClose={closeModal} busy={saving || modalLogSaving}
      title={`${WEEKDAY_NAMES_SHORT[selectedSegment.weekday-1]} · ${minutesToHHMM(selectedSegment.startMinute)}–${minutesToHHMM(selectedSegment.endMinute)}`}
      description={'temp' in selectedSegment ? 'Free time' : (selectedSegment.activity?.name || 'Open block')}>
      <div className="space-y-5">
        {(() => {
          const inBlock = remindersIn(selectedSegment.weekday, selectedSegment.startMinute, selectedSegment.endMinute);
          return inBlock.length > 0 && <section aria-label="Apple Reminders" className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><IconBell size={15} />Reminders <span className="tt-text-muted text-xs font-normal">· read only</span></h3>
            <ReminderList reminders={inBlock} />
          </section>;
        })()}
        <section aria-label="Logged time" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Logged</h3>
            {modalLogsLoading && <span aria-label="Loading" className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />}
          </div>
          {modalLogs.length === 0 && !modalLogsLoading && <p className="tt-text-muted text-sm">Nothing logged here yet.</p>}
          {modalLogs.length > 0 && <ul className="tt-list">
            {(() => {
              const timeline = buildSegmentTimelineWithGaps();
              if(!timeline) return modalLogs.map(l => renderModalLog(l));
              return timeline.items.map(it => it.type === 'gap'
                ? <li key={it.id} className="flex items-center gap-3 py-1.5 pl-4 pr-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-[var(--line-strong)]" />
                    <span className="tt-text-muted min-w-0 flex-1 text-xs tabular-nums">{minutesToHHMM(it.startMin)}–{minutesToHHMM(it.endMin)} · Free {fmt(it.endMin - it.startMin)}</span>
                    <Button variant="subtle" className="!min-h-8 !px-3 text-xs" aria-label={`Use free gap ${minutesToHHMM(it.startMin)} to ${minutesToHHMM(it.endMin)}`} onClick={()=> useGapRange(it.startMin, it.endMin)}>Use</Button>
                  </li>
                : renderModalLog(it.data, it));
            })()}
          </ul>}
          {modalLogs.length > 0 && modalLogs.length % MODAL_LOGS_PAGE_SIZE === 0 && (
            <Button variant="ghost" className="w-full" disabled={modalLogsLoading} onClick={()=> setModalLogsPage(p=>p+1)}>Load more</Button>
          )}
        </section>
        {modalError && <ErrorState message={modalError} />}
        <form onSubmit={submitModal} className="space-y-3 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-semibold">Add time</h3>
          <label className="block"><span className="sr-only">Activity</span>
            <select value={activityId} onChange={e=>setActivityId(e.target.value)} className="tt-input">
              <option value="">No activity</option>
              {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="tt-check">
            <input type="checkbox" checked={useFullRange} onChange={e=>{ setUseFullRange(e.target.checked); if(e.target.checked){ setStartHHMM(minutesToHHMM(selectedSegment.startMinute)); setEndHHMM(minutesToHHMM(selectedSegment.endMinute)); } }} />
            Whole block ({minutesToHHMM(selectedSegment.startMinute)}–{minutesToHHMM(selectedSegment.endMinute)})
          </label>
          {!useFullRange && <div className="grid grid-cols-2 gap-3">
            <label><span className="tt-label">Start</span><input type="time" required value={startHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setStartHHMM(e.target.value)} className="tt-input" /></label>
            <label><span className="tt-label">End</span><input type="time" required value={endHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setEndHHMM(e.target.value)} className="tt-input" /></label>
          </div>}
          <input type="text" aria-label="Note" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Note (optional)" className="tt-input" />
          <details className="rounded-xl border border-[var(--line)] px-4 py-1">
            <summary className="flex min-h-10 items-center text-sm font-semibold">More options</summary>
            <div className="space-y-2 pb-3 pt-1">
              <label className="block"><span className="tt-label">Type of time</span>
                <select value={source} onChange={e=>setSource(e.target.value as Source)} className="tt-input">
                  {SOURCES.map(s=> <option key={s} value={s}>{sourceLabel[s]}</option>)}
                </select>
              </label>
              <label className="tt-check"><input type="checkbox" checked={partial} onChange={e=>setPartial(e.target.checked)} />Partially completed</label>
            </div>
          </details>
          <div className="flex gap-2 pt-1 sm:justify-end">
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" className="flex-1 sm:flex-none" loading={saving}>Add entry</Button>
          </div>
        </form>
      </div>
    </Dialog>) : null;

  // Weekly free time: open cells between segment boundaries (optionally counting blocks with no activity).
  const freeSummary = (() => {
    if(view !== 'grid' || !effectiveRows.length) return null;
    let freeAvailable = 0, freeUsed = 0;
    for(const r of effectiveRows){
      const span = r.end - r.start;
      for(let day=1; day<=7; day++){
        if(byDay[day].some(s=> s.startMinute <= r.start && s.endMinute >= r.end)) continue;
        freeAvailable += span;
        const fd = freeLogsMap[`${day}:${r.start}-${r.end}`];
        if(fd) freeUsed += Math.min(span, fd.totalMinutes);
      }
    }
    if(includeEmptySegmentsAsFree){
      for(const seg of segments){
        if(seg.activityId) continue;
        const segDur = seg.endMinute - seg.startMinute;
        freeAvailable += segDur;
        freeUsed += Math.min(segDur, segmentLoggedMinutes[seg.id] || 0);
      }
    }
    if(!freeAvailable) return null;
    return { freeAvailable, freeUsed, pct:Math.round(freeUsed / freeAvailable * 100) };
  })();

  const showGrid = segments.length > 0 || effectiveRows.length > 1;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <WeekNav className="min-w-0 flex-1 sm:max-w-sm sm:flex-none" />
        <div className="tt-segmented shrink-0" role="group" aria-label="Week layout">
          <button type="button" aria-pressed={view === 'agenda'} onClick={() => setView('agenda')} aria-label="Day by day" title="Day by day"><IconList size={17} /></button>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Time grid" title="Time grid"><IconSegment size={17} /></button>
        </div>
        {loadingFreeLogs && <span aria-label="Updating" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent max-sm:hidden" />}
      </div>
      <DayPicker className="sm:hidden" value={selectedDay} onChange={setSelectedDay} dates={weekDates} />
      {freeSummary && <div className="tt-panel flex items-center gap-3 px-4 py-2.5 text-sm">
        <span className="shrink-0 font-medium">Free time used</span>
        <div className="tt-progress min-w-[48px] flex-1"><div style={{ width:freeSummary.pct + '%', background:'#f59e0b' }} /></div>
        <span className="tt-text-muted shrink-0 tabular-nums"><strong className="text-[var(--ink)]">{fmt(freeSummary.freeUsed)}</strong> / {fmt(freeSummary.freeAvailable)}</span>
        <Menu label="Free time options" items={[{ label:'Count empty blocks as free', checked:includeEmptySegmentsAsFree, onSelect:() => setIncludeEmptySegmentsAsFree(v => !v) }]} />
      </div>}
      {loading && <LoadingState label="Loading your schedule…" />}
      {error && <ErrorState message={error} onRetry={() => setRetry(v=>v+1)} />}
      {!loading && !error && !segments.length && <EmptyState title="No routine yet" icon={<IconCalendar size={24} />}><Button leftIcon={<IconAdd size={18} />} onClick={onManage}>Plan a block</Button></EmptyState>}
      {!loading && reminders.noDate.length > 0 && <details className="group tt-panel">
        <summary className="flex min-h-11 list-none items-center gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <IconBell size={16} className="text-amber-600 dark:text-amber-400" />
          {reminders.noDate.length} reminder{reminders.noDate.length === 1 ? '' : 's'} without a date
          <span className="tt-text-muted ml-auto text-xs font-normal group-open:hidden">Show</span><span className="tt-text-muted ml-auto hidden text-xs font-normal group-open:inline">Hide</span>
        </summary>
        <div className="px-3 pb-3"><ReminderList reminders={reminders.noDate} /></div>
      </details>}
      {!loading && !error && view === 'agenda' && <div ref={carousel} onScroll={onCarouselScroll} className="tt-daycarousel" aria-label="Days of the week">
        <div aria-hidden="true" className="tt-daycarousel-edge"><IconChevronLeft size={18} />Previous week</div>
        {WEEKDAY_NAMES_LONG.map((day, index) => {
          const blocks = [...byDay[index+1]].sort((a,b)=>a.startMinute-b.startMinute);
          // Without a routine, larger screens only show the chosen day; phones keep all 7 so swiping works.
          const desktopHidden = !segments.length && !reminders.hasAny && index+1 !== selectedDay;
          return <section key={day} aria-current={index+1 === selectedDay ? 'date' : undefined} className={'space-y-1.5 ' + (desktopHidden ? 'sm:hidden' : '')}>
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold">{day} <span className="tt-text-muted font-normal">{new Date(weekDates[index]+'T12:00:00').toLocaleDateString(undefined, { day:'numeric', month:'short' })}</span></h3>
              <Button variant="ghost" className="!min-h-8 !px-2 text-xs" leftIcon={<IconAdd size={14} />}
                onClick={() => { openModal({ temp:true, weekday:index+1, startMinute:0, endMinute:1440 }); setUseFullRange(false); setStartHHMM('09:00'); setEndHHMM('10:00'); }}>Log</Button>
            </div>
            <ul className="tt-list">
              {blocks.map(segment => {
                const logged = segmentLoggedMinutes[segment.id] || 0;
                const planned = segment.endMinute - segment.startMinute;
                return <li key={segment.id}><button type="button" className="tt-row tt-row-button !pr-4" onClick={() => openModal(segment)}
                  aria-label={'Record time for ' + (segment.activity?.name || 'open block') + ', ' + day + ', ' + minutesToHHMM(segment.startMinute)}>
                  <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full" style={{ background:segment.activity?.color || 'var(--line-strong)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{segment.activity?.name || 'Open block'}</span>
                    <span className="tt-text-muted block text-xs tabular-nums">{minutesToHHMM(segment.startMinute)}–{minutesToHHMM(segment.endMinute)}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums"><strong className="block text-sm">{fmt(logged)}</strong><span className="tt-text-muted">of {fmt(planned)}</span></span>
                </button></li>;
              })}
              {!blocks.length && <li className="tt-text-muted px-4 py-3 text-sm">No blocks planned.</li>}
            </ul>
            <ReminderList reminders={reminders.byDay[weekDates[index]] || []} />
          </section>;
        })}
        <div aria-hidden="true" className="tt-daycarousel-edge">Next week<IconChevronRight size={18} /></div>
      </div>}
      {!loading && !error && view === 'grid' && showGrid && (
        <div role="region" aria-label="Weekly time grid" tabIndex={0} {...gridSwipe} className="tt-panel max-h-[calc(100dvh-240px)] overflow-auto sm:max-h-[calc(100dvh-220px)]">
          <table className="tt-grid sm:min-w-[860px]"><caption className="sr-only">Weekly schedule. Choose a time block to record time.</caption>
            <thead>
              <tr>
                <th className="tt-grid-time">Time</th>
                {WEEKDAY_NAMES_SHORT.map((d,i)=>(
                  <th key={d} data-today={weekDates[i] === todayISO || undefined} className={i+1 === selectedDay ? '' : 'max-sm:hidden'}>
                    {d} <span className="font-normal">{Number(weekDates[i].slice(8))}</span>
                    {(reminders.byDay[weekDates[i]]?.length || 0) > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-amber-700 dark:text-amber-300" title={reminders.byDay[weekDates[i]].map(r => (r.minute === null ? 'All day' : minutesToHHMM(r.minute)) + ' ' + r.title).join('\n')}>
                      <IconBell size={11} />{reminders.byDay[weekDates[i]].length}
                    </span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((r, row)=> (
                <tr key={r.start+'-'+r.end}>
                  <td className="tt-grid-time">{minutesToHHMM(r.start)}<span className="block opacity-60">{minutesToHHMM(r.end)}</span></td>
                  {[1,2,3,4,5,6,7].map(day => {
                    const cell = gridColumns[day]?.[row];
                    return cell ? renderGridCell(day, cell) : null;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {segmentModal}
    </div>
  );
}

"use client";
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { minutesToHHMM, WEEKDAY_NAMES_LONG, combineDateAndTime } from '../../lib/time';
import { useWeek } from '../week/WeekContext';
import { useToast } from '../toast/ToastProvider';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; activity?: Activity | null; }
interface TempFreeSlot { temp: true; weekday: number; startMinute: number; endMinute: number; }
interface FreeLogCellData { totalMinutes: number; activities: { activityId: string; name: string; color: string | null; minutes: number; percent: number; }[]; dominantActivityId: string | null; }

const SOURCES = ['PLANNED','ADHOC','MAKEUP'] as const;
type Source = typeof SOURCES[number];

// We will produce a consolidated table:
// Rows = unique time ranges across week (merged identical adjacent minute ranges from segments definition)
// Each cell = activity name or FREE (empty) if no segment or segment with null activity.

export default function WeeklyScheduleTable(){
  const { weekStart, gotoPrevWeek, gotoNextWeek, gotoThisWeek, weekRangeLabel } = useWeek();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [historicalMode, setHistoricalMode] = useState(false);
  const [snapshotInfo, setSnapshotInfo] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0); // debug: how many times segments load ran
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
  const { addToast } = useToast();
  const [segmentLoggedMinutes, setSegmentLoggedMinutes] = useState<Record<string, number>>({});
  const [segmentDominantActivity, setSegmentDominantActivity] = useState<Record<string,{ activityId: string | null; minutes: number }>>({});
  const [segmentBreakdown, setSegmentBreakdown] = useState<Record<string,{ activityId: string | null; minutes: number }[]>>({});
  const [usageUpdating, setUsageUpdating] = useState(false);
  const [hasLoadedUsage, setHasLoadedUsage] = useState(false);
  // Free (unsegmented) logs per cell map
  const [freeLogsMap, setFreeLogsMap] = useState<Record<string, FreeLogCellData>>({});
  const [loadingFreeLogs, setLoadingFreeLogs] = useState(false);
  const [showFreeKey, setShowFreeKey] = useState<string | null>(null); // mobile toggle for free cell breakdown
  // Debug
  const [showDebug, setShowDebug] = useState(false);
  const IS_DEV = process.env.NODE_ENV !== 'production';
  const [debugInfo, setDebugInfo] = useState<any>(null);
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
    const key = weekStart + '|' + (historicalMode ? 'H':'C');
    if(lastLoadKeyRef.current === key){
      return; // already loaded this combination (guards StrictMode double invoke)
    }
    lastLoadKeyRef.current = key;
    (async ()=>{
      try {
        setLoading(true);
        const params = new URLSearchParams();
        // Always send weekStart so backend can produce stable snapshot if historical
        params.set('weekStart', weekStart);
        if(historicalMode) params.set('historical','1');
        const segUrl = `/api/schedule/segments?${params.toString()}`;
        const [segRes, actRes] = await Promise.all([
          fetch(segUrl, { cache: 'no-store' }),
          fetch('/api/activities', { cache: 'no-store' })
        ]);
  const segData = await segRes.json();
        if(!segRes.ok) throw new Error(segData.error || 'Failed to load segments');
        const segs = segData.segments || [];
        setSegments(segs);
        setSnapshotInfo(segData.mode === 'historical' ? segData.snapshot : null);
  setFetchCount(c=>c+1);
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
  }, [weekStart, historicalMode]);

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
    if(!seg) return { seg: null, name: 'FREE', color: null };
    if(!seg.activityId) return { seg, name: 'FREE', color: null };
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
      if(!segments.length){
        const globalBoundaries = new Set<number>([0,1440]);
        for(const log of logs){
          if(!log.startedAt || !log.endedAt) continue;
          const startDateTime = new Date(log.startedAt);
          const endDateTime = new Date(log.endedAt);
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
        setSyntheticRows(synthetic);
      } else if(syntheticRows.length){
        // Limpiar si había filas sintéticas previas
        setSyntheticRows([]);
      }
      // Precomputar celdas libres para depuración
      const freeCellKeys: string[] = [];
      const gridRows = rows.length ? rows : syntheticRows;
      for(const r of gridRows){
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
        if(!log.startedAt || !log.endedAt) continue;
        const startDateTime = new Date(log.startedAt);
        const endDateTime = new Date(log.endedAt);
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
            // Map this slice into free cells
            const intervalsForMapping = rows.length ? rows : syntheticRows;
            for(const interval of intervalsForMapping){
              const cellStart = interval.start; const cellEnd = interval.end;
              const seg = byDay[weekday].find(s=> s.startMinute <= cellStart && s.endMinute >= cellEnd);
              if(seg) continue;
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
          // Solo consideramos realmente unmatched aquellos sin segmentId (logs sueltos) que no intersectaron celdas libres.
          if(!log.segmentId){
            unmatched.push({ id: log.id, startedAt: log.startedAt, endedAt: log.endedAt, activity: log.activity?.name, segmentId: log.segmentId, slices: sliceDebug });
          }
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
      setDebugInfo(diag);
      if(IS_DEV && typeof window!== 'undefined'){
        // Log detallado en consola para inspección
        // eslint-disable-next-line no-console
        console.groupCollapsed('[FreeLogs Debug]');
        // eslint-disable-next-line no-console
        console.log(diag);
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
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
    setSource('PLANNED');
    setComment('');
    setModalError(null);
    setOpen(true);
  }

  function closeModal(){
    if(saving) return;
    setOpen(false);
    setSelectedSegment(null);
  }

  async function submitModal(e: React.FormEvent){
    e.preventDefault(); if(!selectedSegment) return; setSaving(true); setModalError(null);
    try {
      // Validate times inside segment
      const startMin = parseInt(startHHMM.slice(0,2))*60 + parseInt(startHHMM.slice(3));
      const endMin = parseInt(endHHMM.slice(0,2))*60 + parseInt(endHHMM.slice(3));
      if(endMin <= startMin) throw new Error('End must be after start');
      if(startMin < selectedSegment.startMinute || endMin > selectedSegment.endMinute){
        throw new Error('Time range must stay within bounds');
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
      closeModal();
      addToast({ message:'Log created', type:'success'});
      refreshSegmentUsage();
    } catch(e:any){ setModalError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Weekly Schedule <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{weekRangeLabel}</span></h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={gotoPrevWeek} className="text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">◀</button>
          <button type="button" onClick={gotoThisWeek} className="text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">Hoy</button>
          <button type="button" onClick={gotoNextWeek} className="text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">▶</button>
        </div>
        <label className="flex items-center gap-1 ml-2 text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 cursor-pointer select-none">
          <input type="checkbox" className="h-3 w-3" checked={historicalMode} onChange={e=>setHistoricalMode(e.target.checked)} />
          <span>Historical snapshot</span>
        </label>
        {historicalMode && (
          <span className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white">Snapshot: {snapshotInfo || weekStart}</span>
        )}
        {IS_DEV && (
          <button type="button" onClick={()=>setShowDebug(d=>!d)} className="text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
        )}
        <span className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 select-none">fetch#{fetchCount}</span>
        <button type="button" onClick={()=>loadFreeLogs()} className="text-[10px] px-2 py-1 rounded border border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40">Reload free logs</button>
      </div>
      {loading && <div className="text-sm">Loading...</div>}
  {!loading && loadingFreeLogs && <div className="text-xs text-amber-600 flex items-center gap-2"><span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />Loading free logs…</div>}
      {!loading && !loadingFreeLogs && (
        (()=>{
          // Compute weekly free minutes used vs free available (only intervals defined by segments boundaries but without segment coverage)
          if(!effectiveRows.length) return null;
          let freeAvailable = 0; // sum of all free cells size
          let freeUsed = 0; // sum of minutes logged in those free cells (capped by cell size)
          for(const r of effectiveRows){
            const span = r.end - r.start;
            for(let day=1; day<=7; day++){
              const seg = byDay[day].find(s=> s.startMinute <= r.start && s.endMinute >= r.end);
              if(!seg){
                freeAvailable += span;
                const key = `${day}:${r.start}-${r.end}`;
                const fd = freeLogsMap[key];
                if(fd){
                  freeUsed += Math.min(span, fd.totalMinutes); // safeguard
                }
              }
            }
          }
          // Opcional: incluir segmentos vacíos (sin actividad planificada) como free
          if(includeEmptySegmentsAsFree){
            for(const seg of segments){
              if(!seg.activityId){
                const segDur = seg.endMinute - seg.startMinute;
                freeAvailable += segDur;
                const logged = segmentLoggedMinutes[seg.id] || 0;
                freeUsed += Math.min(segDur, logged);
              }
            }
          }
          if(freeAvailable===0) return null;
          const pct = Math.round((freeUsed / freeAvailable) * 100);
          return (
            <div className="text-xs flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-800/40 rounded border border-gray-200 dark:border-gray-700 p-2">
              <div className="font-medium">Free time used (week):</div>
              <div className="px-1.5 py-0.5 rounded bg-amber-500/90 text-black font-semibold">{freeUsed}m</div>
              <div className="text-gray-600 dark:text-gray-400">/ {freeAvailable}m</div>
              <div className="text-gray-800 dark:text-gray-300 font-medium">({pct}%)</div>
              <div className="flex-1 h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden min-w-[120px]">
                <div style={{ width: `${pct}%` }} className="h-full bg-amber-500 transition-all" />
              </div>
              <label className="flex items-center gap-1 ml-auto select-none">
                <input type="checkbox" className="h-3 w-3" checked={includeEmptySegmentsAsFree} onChange={e=>{ setIncludeEmptySegmentsAsFree(e.target.checked); /* recalculo implícito con re-render */ }} />
                <span className="text-[10px] text-gray-600 dark:text-gray-400">count empty segments</span>
              </label>
            </div>
          );
        })()
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded">
          <table className="text-xs min-w-full border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">Actividad</th>
                {WEEKDAY_NAMES_LONG.map((d,i)=>(
                  <th key={d} className="px-2 py-2 font-medium text-left">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map(r=>{
                const label = `${minutesToHHMM(r.start)} - ${minutesToHHMM(r.end)}`;
                return (
                  <tr key={r.start+"-"+r.end} className="even:bg-white odd:bg-gray-50 dark:even:bg-gray-900 dark:odd:bg-gray-950">
                    <td className="px-2 py-1 font-mono text-[11px] sticky left-0 bg-inherit whitespace-nowrap">{label}</td>
                    {Array.from({length:7}, (_,idx)=> idx+1).map(day => {
                      const act = cellActivity(day, r.start, r.end);
                        const actColor = act.color; // preserve color reference
                      const segId = act.seg?.id;
                      const dom = segId ? segmentDominantActivity[segId] : undefined;
                      const breakdown = segId ? segmentBreakdown[segId] : undefined;
                      const plannedActivityId = act.seg?.activityId || null;
                      const multi = breakdown && breakdown.length > 1;
                      const hasAny = breakdown && breakdown.length > 0;
                      const dominantDiffers = !!(dom && dom.activityId && plannedActivityId && dom.activityId !== plannedActivityId);
                      const bg = act.seg ? 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer';
                      const freeKey = `${day}:${r.start}-${r.end}`;
                      const freeData = !act.seg ? freeLogsMap[freeKey] : undefined; // ensure key defined before usage
                      const isFree = !act.seg;
                      const breakdownVisible = freeData && (showFreeKey === freeKey);
                      const handleCellClick = () => {
                        if(act.seg){
                          openModal(act.seg);
                        } else {
                          // Mobile fallback: if has freeData and not currently shown, show breakdown first; second tap opens modal
                          if(freeData){
                            if(showFreeKey !== freeKey){
                              setShowFreeKey(freeKey);
                              return;
                            }
                          }
                          openModal({ temp:true, weekday: day, startMinute: r.start, endMinute: r.end });
                        }
                      };
                      return (
                        <td key={day} className={`group relative px-2 py-1 whitespace-nowrap ${bg} ${freeData ? 'border border-amber-400/40 ring-1 ring-amber-400/30 rounded' : ''}`}
                          onClick={handleCellClick}
                          onMouseLeave={()=> { if(showFreeKey === freeKey) setShowFreeKey(null); }}
                        >
                          {act.seg ? (
                            hasAny ? (
                              <div className="flex flex-col gap-0.5">
                                {plannedActivityId ? (
                                  <span className={`font-medium ${dominantDiffers || (multi && (!dom || dom.activityId !== plannedActivityId)) ? 'line-through opacity-50' : ''}`} style={ actColor ? { color: actColor } : undefined }>
                                    {act.name}
                                  </span>
                                ) : (
                                  (()=>{
                                    // Segment was FREE (no planned activity). If we have breakdown, show the real activity (single) or dominant.
                                    if(breakdown && breakdown.length){
                                      const primaryEntry = breakdown.length === 1 ? breakdown[0] : (dom ? dom : breakdown[0]);
                                      const primaryAct = primaryEntry.activityId ? activities.find(a=>a.id===primaryEntry.activityId) : null;
                                      const primaryColor = primaryAct?.color || undefined;
                                      const primaryName = primaryAct?.name || '—';
                                      return (
                                        <span className="font-medium" style={ primaryColor ? { color: primaryColor } : undefined }>
                                          {primaryName}{breakdown.length>1 ? '' : ''}
                                        </span>
                                      );
                                    }
                                    // Fallback: still free with no logs
                                    return <span className="font-medium" style={ actColor ? { color: actColor } : undefined }>{act.name}</span>;
                                  })()
                                )}
                                <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                                  {breakdown?.map(b => {
                                    const a = b.activityId ? activities.find(x=>x.id===b.activityId) : null;
                                    const nm = a ? a.name : '—';
                                    const pctBase = (act.seg!.endMinute - act.seg!.startMinute) || 1;
                                    const pct = Math.round((b.minutes / pctBase) * 100);
                                    const highlight = dom && dom.activityId === b.activityId;
                                    return (
                                      <span key={(b.activityId||'none')}
                                        className={`px-1 py-0.5 rounded text-[9px] border ${highlight ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                                        title={`${nm} • ${b.minutes}m (${pct}%)`}
                                      >{nm} {b.minutes}m ({pct}%)</span>
                                    );
                                  })}
                                  {(() => {
                                    if(!breakdown || !act.seg) return null;
                                    const totalLogged = breakdown.reduce((sum,b)=> sum + b.minutes, 0);
                                    const segDur = act.seg.endMinute - act.seg.startMinute;
                                    const remaining = segDur - totalLogged;
                                    if(remaining > 0){
                                      const pct = Math.round((remaining / segDur) * 100);
                                      return (
                                        <span key="__free__" className="px-1 py-0.5 rounded text-[9px] border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300" title={`Free • ${remaining}m (${pct}%)`}>
                                          Free {remaining}m ({pct}%)
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <span className="font-medium" style={ actColor ? { color: actColor } : undefined }>{act.name}</span>
                            )
                          ) : (
                            freeData ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-amber-600 dark:text-amber-400">Free</span>
                                <div className="flex flex-wrap gap-0.5">
                                  {(() => {
                                    const list = freeData.activities.slice(0,3);
                                    return list.map((a,idx) => (
                                      <span
                                        key={a.activityId}
                                        className={`px-1 py-0.5 rounded text-[9px] border ${idx===0 ? 'bg-amber-500 text-white border-amber-600' : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}
                                        title={`${a.name} • ${a.minutes}m (${a.percent}%)`}
                                      >{a.name} {a.minutes}m</span>
                                    ));
                                  })()}
                                  {freeData.activities.length > 3 && (
                                    <span className="px-1 py-0.5 rounded text-[9px] border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300" title={freeData.activities.slice(3).map(a=>`${a.name} ${a.minutes}m`).join(', ')}>+{freeData.activities.length - 3} more</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="font-medium" style={ actColor ? { color: actColor } : undefined }>{act.name}</span>
                            )
                          )}
                          {!act.seg && freeData && (
                            <>
                              <span className="absolute top-0 right-0 m-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/90 text-[9px] font-semibold text-black shadow select-none" title="Time logged in free interval">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: freeData.activities[0]?.color || '#92400e' }} />
                                LOG {freeData.totalMinutes}m
                              </span>
                              <div className={`absolute z-20 left-1 top-5 bg-neutral-900 text-neutral-100 text-[10px] rounded p-2 shadow-xl border border-neutral-700 w-56 ${breakdownVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition`}>
                                <div className="font-semibold mb-1 flex items-center justify-between">
                                  <span>Free time usage</span>
                                  <button type="button" onClick={(e)=>{ e.stopPropagation(); if(showFreeKey===freeKey) setShowFreeKey(null); else setShowFreeKey(freeKey); }} className="px-1 py-0.5 text-[9px] rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600">{breakdownVisible ? 'Close' : 'Hold'}</button>
                                </div>
                                {freeData.activities.map(a=> (
                                  <div key={a.activityId} className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color || '#666' }} />
                                    <span className="truncate">{a.name}</span>
                                    <span className="ml-auto tabular-nums">{a.minutes}m ({a.percent}%)</span>
                                  </div>
                                ))}
                                <div className="mt-1 text-[9px] text-neutral-400">First tap to view, second to open modal.</div>
                              </div>
                            </>
                          )}
                          {act.seg && act.seg.activityId && (
                            <span className={`block text-[9px] mt-0.5 text-gray-500 ${usageUpdating ? 'opacity-60' : ''}`}>
                              {!hasLoadedUsage ? '…' : (usageUpdating ? 'updating…' : `${segmentLoggedMinutes[act.seg.id] ? segmentLoggedMinutes[act.seg.id] : 0}m / ${(act.seg.endMinute - act.seg.startMinute)}m`)}
                            </span>
                          )}
                          {act.seg && multi && (
                            <span className="absolute top-0 right-0 translate-y-[-2px] translate-x-[2px] text-[8px] px-1 py-0.5 rounded bg-amber-600 text-white" title="Multiple activities logged in this segment">MULTI</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {effectiveRows.length===0 && (
                <tr><td colSpan={8} className="text-center py-6 text-gray-500">No segments configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {IS_DEV && showDebug && (
        <div className="text-[10px] space-y-2 p-3 rounded border border-purple-400/50 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-700">
          <div className="font-semibold">Free Logs Debug</div>
          {!debugInfo && <div>No debug info yet (carga free logs primero).</div>}
          {debugInfo && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>Week start: <span className="font-mono">{debugInfo.weekStart}</span></div>
                <div>Fetched logs: {debugInfo.fetchedLogs}</div>
                <div>Rows: {debugInfo.rows}</div>
                <div>Free cells: {debugInfo.freeCells}</div>
                <div>Cells with data: {debugInfo.cellsWithData}</div>
                <div>Cell updates: {debugInfo.cellUpdates}</div>
                <div>Unmatched logs: {debugInfo.unmatchedCount}</div>
              </div>
              {debugInfo.unmatchedCount > 0 && (
                <div>
                  <div className="font-medium mb-1">Unmatched (primeros 10)</div>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {debugInfo.unmatched.map((u:any)=>(
                      <li key={u.id}>{u.activity || '—'} {u.startedAt} → {u.endedAt} seg:{u.segmentId || '∅'}</li>
                    ))}
                  </ul>
                </div>
              )}
              {debugInfo.sampleCells?.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Sample cells</div>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {debugInfo.sampleCells.map((c:any)=>(
                      <li key={c.k}>{c.k} = {c.total}m [{c.acts.map((a:any)=> `${a.name}:${a.m}m`).join(', ')}]</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {open && selectedSegment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg w-full max-w-md p-4 space-y-4">
            <div className="flex items-start">
              <h3 className="text-sm font-semibold mr-auto">Log segment</h3>
              <button onClick={closeModal} className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
              <div>Segment: {minutesToHHMM(selectedSegment.startMinute)} - {minutesToHHMM(selectedSegment.endMinute)}</div>
              <div>Weekday: {WEEKDAY_NAMES_LONG[selectedSegment.weekday-1]}</div>
              <div>Planned Activity: {'temp' in selectedSegment ? '—' : (selectedSegment.activity?.name || '—')}</div>
            </div>
            {modalError && <div className="text-xs text-red-600">{modalError}</div>}
            <form onSubmit={submitModal} className="space-y-3">
              <label className="block text-[11px] space-y-1">
                <span className="uppercase tracking-wide text-gray-500">Activity</span>
                <select value={activityId} onChange={e=>setActivityId(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700">
                  <option value="">-- None --</option>
                  {activities.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={useFullRange} onChange={e=>{ setUseFullRange(e.target.checked); if(e.target.checked && selectedSegment){ setStartHHMM(minutesToHHMM(selectedSegment.startMinute)); setEndHHMM(minutesToHHMM(selectedSegment.endMinute)); } }} className="h-3 w-3" />
                <span>Use full segment range</span>
              </label>
              {!useFullRange && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[11px]">
                    <span className="uppercase tracking-wide text-gray-500">Start</span>
                    <input type="time" required value={startHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setStartHHMM(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                  </label>
                  <label className="space-y-1 text-[11px]">
                    <span className="uppercase tracking-wide text-gray-500">End</span>
                    <input type="time" required value={endHHMM} min={minutesToHHMM(selectedSegment.startMinute)} max={minutesToHHMM(selectedSegment.endMinute)} onChange={e=>setEndHHMM(e.target.value)} className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={partial} onChange={e=>setPartial(e.target.checked)} className="h-3 w-3" />
                  <span>Partial flag</span>
                </label>
                <label className="text-[11px] flex items-center gap-1">
                  <span>Source</span>
                  <select value={source} onChange={e=>setSource(e.target.value as Source)} className="border rounded px-1 py-0.5 text-[11px] dark:bg-gray-950 dark:border-gray-700">
                    {SOURCES.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-[11px]">
                <span className="uppercase tracking-wide text-gray-500">Comment</span>
                <input type="text" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional comment" className="w-full border rounded p-1 text-xs dark:bg-gray-950 dark:border-gray-700" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} disabled={saving} className="text-xs px-2 py-1 rounded border dark:border-gray-600 disabled:opacity-50">Cancel</button>
                <button disabled={saving} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : 'Log Time'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

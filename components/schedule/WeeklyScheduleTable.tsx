"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { minutesToHHMM, WEEKDAY_NAMES_LONG } from '../../lib/time';

interface Activity { id: string; name: string; color: string | null; }
interface Segment { id: string; weekday: number; startMinute: number; endMinute: number; activityId: string | null; activity?: Activity | null; }

// We will produce a consolidated table:
// Rows = unique time ranges across week (merged identical adjacent minute ranges from segments definition)
// Each cell = activity name or LIBRE (empty) if no segment or segment with null activity.

export default function WeeklyScheduleTable(){
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{
    (async ()=>{
      try {
        setLoading(true);
        const res = await fetch('/api/schedule/segments');
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to load');
        setSegments(data.segments || []);
      } catch(e:any){ setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // Build unique boundaries
  const rows = useMemo(()=>{
    if(segments.length===0) return [] as { start: number; end: number; }[];
    const boundaries = new Set<number>();
    for(const s of segments){
      boundaries.add(s.startMinute); boundaries.add(s.endMinute);
    }
    const sorted = Array.from(boundaries).sort((a,b)=>a-b);
    const intervals: { start:number; end:number; }[] = [];
    for(let i=0;i<sorted.length-1;i++){
      const start = sorted[i]; const end = sorted[i+1];
      if(end>start) intervals.push({ start, end });
    }
    return intervals;
  }, [segments]);

  // Map for quick lookup: weekday -> list of segments
  const byDay = useMemo(()=>{
    const map: Record<number, Segment[]> = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
    for(const s of segments) map[s.weekday].push(s);
    return map;
  }, [segments]);

  function cellActivity(weekday:number, start:number, end:number){
    // Find segment that fully covers this interval
    const seg = byDay[weekday].find(s=> s.startMinute <= start && s.endMinute >= end);
    if(!seg) return { name: 'LIBRE', color: null };
    if(!seg.activityId) return { name: 'LIBRE', color: null };
    return { name: seg.activity?.name || 'UNKNOWN', color: seg.activity?.color || null };
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Weekly Schedule Table</h2>
      {loading && <div className="text-sm">Loading...</div>}
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
              {rows.map(r=>{
                const label = `${minutesToHHMM(r.start)} - ${minutesToHHMM(r.end)}`;
                return (
                  <tr key={r.start+"-"+r.end} className="even:bg-white odd:bg-gray-50 dark:even:bg-gray-900 dark:odd:bg-gray-950">
                    <td className="px-2 py-1 font-mono text-[11px] sticky left-0 bg-inherit whitespace-nowrap">{label}</td>
                    {Array.from({length:7}, (_,idx)=> idx+1).map(day => {
                      const act = cellActivity(day, r.start, r.end);
                      const bg = act.name==='LIBRE' ? '' : 'bg-blue-50 dark:bg-blue-900/30';
                      return (
                        <td key={day} className={`px-2 py-1 whitespace-nowrap ${bg}`}>
                          <span className="font-medium" style={ act.color ? { color: act.color } : undefined }>
                            {act.name}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length===0 && (
                <tr><td colSpan={8} className="text-center py-6 text-gray-500">No segments configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Time utility helpers
// Weekday: 1=Mon .. 7=Sun (consistent with schedule segments)

export const WEEKDAY_NAMES_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
export const WEEKDAY_NAMES_LONG = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;

export function minutesToHHMM(m: number): string {
  if (m < 0) m = 0; // clamp
  const h = Math.floor(m / 60);
  const mm = (m % 60).toString().padStart(2,'0');
  return `${h.toString().padStart(2,'0')}:${mm}`;
}

export function hhmmToMinutes(str: string): number {
  if(!/^\d{1,2}:\d{2}$/.test(str)) throw new Error('Bad HH:MM');
  const [hRaw,mRaw] = str.split(':');
  const h = Number(hRaw); const m = Number(mRaw);
  if(h<0||h>23||m<0||m>59) throw new Error('Out of range');
  return h*60 + m;
}

export function weekdayNameShort(wd: number){ return WEEKDAY_NAMES_SHORT[wd-1] || '?'; }
export function weekdayNameLong(wd: number){ return WEEKDAY_NAMES_LONG[wd-1] || 'Unknown'; }

export function sameDayUTC(a: Date, b: Date){
  return a.getUTCFullYear()===b.getUTCFullYear() && a.getUTCMonth()===b.getUTCMonth() && a.getUTCDate()===b.getUTCDate();
}

export function isoDate(date: Date){ return date.toISOString().slice(0,10); }

export function combineDateAndTime(dateISO: string, timeHHMM: string): string {
  // Returns ISO string
  const [y,m,d] = dateISO.split('-').map(Number);
  const [hh,mm] = timeHHMM.split(':').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d,hh,mm,0,0));
  return dt.toISOString();
}

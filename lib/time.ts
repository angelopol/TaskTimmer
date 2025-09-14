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

/**
 * combineDateAndTime
 * Crea un timestamp ISO a partir de una fecha (YYYY-MM-DD) y hora (HH:MM) interpretadas en ZONA LOCAL.
 * Antes: Se usaba Date.UTC -> esto desplazaba horas al guardar si el usuario no estaba en UTC.
 * Ahora: new Date(y,m-1,d,hh,mm) mantiene la intención local (lo que el usuario selecciona) y luego
 * se serializa a ISO (que estará en UTC con el offset aplicado automáticamente por toISOString()).
 * Ejemplo: Local GMT+2 2025-09-09 + 10:00 -> objeto Date local (2025-09-09 10:00+02) -> ISO 2025-09-09T08:00:00.000Z.
 * Esto asegura que al parsear el ISO y volver a mostrar la hora local se recupere 10:00.
 */
export function combineDateAndTime(dateISO: string, timeHHMM: string): string {
  const [y,m,d] = dateISO.split('-').map(Number);
  const [hh,mm] = timeHHMM.split(':').map(Number);
  const dt = new Date(y, m-1, d, hh, mm, 0, 0); // local time
  return dt.toISOString();
}

// Monday (YYYY-MM-DD) for given local date string.
export function mondayOf(dateISO: string){
  const parts = dateISO.split('-').map(Number);
  if(parts.length!==3) return dateISO;
  const d = new Date(parts[0], parts[1]-1, parts[2], 0,0,0,0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  const pad = (n:number)=> n.toString().padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

/**
 * Versión UTC (legacy). Úsala solo si necesitas fijar la hora absoluta sin offset local.
 */
export function combineDateAndTimeUTC(dateISO: string, timeHHMM: string): string {
  const [y,m,d] = dateISO.split('-').map(Number);
  const [hh,mm] = timeHHMM.split(':').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d,hh,mm,0,0));
  return dt.toISOString();
}

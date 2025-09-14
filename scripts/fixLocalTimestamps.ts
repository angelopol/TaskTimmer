/**
 * Corrective migration for TimeLog timestamps created with old UTC-based combineDateAndTime.
 *
 * PROBLEM (old behavior): combineDateAndTime usaba Date.UTC(y,m,d,hh,mm) guardando la hora como
 * si fuese UTC. Resultado: La hora local prevista H_local se almacenó como H_utc = H_local en la base.
 * Cuando el usuario NO estaba en UTC, al mostrar (Date -> local) aparecía desplazada.
 *
 * GOAL: Reinterpretar startedAt/endedAt/date existentes asumiendo que la hora guardada realmente
 * representaba la intención local. Debemos desplazar cada timestamp por el offset local correspondiente
 * a ese instante hacia adelante (para zonas UTC+X) o hacia atrás (UTC-X) de modo que su representación local
 * vuelva a coincidir con la hora original pretendida.
 *
 * STRATEGY:
 * Para cada TimeLog:
 *  1. Tomamos startedAt y endedAt (actual ISO almacenado, ya en UTC real).
 *  2. Calculamos el offset local que habría en ese momento: oldOffsetMinutes = startedAt.getTimezoneOffset().
 *     Nota: getTimezoneOffset() devuelve minutos a RESTAR a la hora local para obtener UTC (signo invertido).
 *  3. Ajuste: newDate = new Date(originalDate.getTime() - oldOffsetMinutes*60000)
 *     Explicación: Si la hora fue guardada como UTC pero era intención local (ej. local GMT+2 10:00 -> guardado 10:00Z)
 *     la hora correcta en UTC tendría que haber sido 08:00Z. El offsetMinutes típico sería -120, getTimezoneOffset() =  -(-120)?
 *     Cuidado: JS getTimezoneOffset() suele devolver, p.e.,  -120? En realidad en GMT+2 getTimezoneOffset() === -120? No, es  -120? (Ej: España en verano suele retornar -120). Correcto.
 *     Queremos restar offset (negativo) => sumará minutos. Para claridad implementamos helper.
 *
 * Edge: DST cambios: se usa el offset real de cada instante, manteniendo precisión.
 *
 * DATE FIELD (date): almacenaste un DateTime a medianoche UTC? Si se generó con UTC quizá también quedó desplazado.
 * Recalculamos date truncando la versión corregida de startedAt a medianoche local y serializándola a UTC (00:00 local -> ISO).
 *
 * SAFE GUARDS:
 * - DRY_RUN (DEFAULT=true) solo imprime plan.
 * - LIMIT opcional para probar con subset.
 * - BACKUP: Haz copia de la DB antes (cp dev.sqlite dev.backup.sqlite por ejemplo).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Options {
  dryRun: boolean;
  limit?: number;
  userId?: string;
}

function parseEnv(): Options {
  const dry = process.env.DRY_RUN !== 'false'; // por defecto true
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;
  const userId = process.env.USER_ID || undefined;
  return { dryRun: dry, limit, userId };
}

function adjustUtcToLocalIntent(dt: Date): Date {
  // dt actualmente representa (horaLocalPretendida) como si fuera UTC.
  // Queremos restar el offset real (en minutos) para obtener la hora UTC correcta.
  // getTimezoneOffset() = minutos a AÑADIR a la hora local para obtener UTC.
  // Si offset = 120 (ej GMT-2) o -120 (GMT+2). En España verano: -120.
  const tz = dt.getTimezoneOffset(); // en minutos
  // La hora que queremos es dt - tz minutos.
  return new Date(dt.getTime() - tz * 60000);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
}

async function run(){
  const { dryRun, limit, userId } = parseEnv();
  console.log(`[fixLocalTimestamps] starting dryRun=${dryRun} limit=${limit ?? 'ALL'} userId=${userId ?? 'ALL'}`);

  const where: any = {};
  if(userId) where.userId = userId;

  const logs = await prisma.timeLog.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit });
  console.log(`[fixLocalTimestamps] fetched ${logs.length} logs`);

  const updates: { id: string; startedAt: Date; endedAt: Date; date: Date; oldStarted: Date; oldEnded: Date; }[] = [];

  for(const log of logs){
    const oldStarted = new Date(log.startedAt);
    const oldEnded = new Date(log.endedAt);
    // Sanity
    if(oldEnded <= oldStarted){
      console.warn(`Skipping log ${log.id} (ended<=started)`);
      continue;
    }
    const newStarted = adjustUtcToLocalIntent(oldStarted);
    const newEnded = adjustUtcToLocalIntent(oldEnded);
    // Recompute minutes length for reference (no lo escribimos, pero podrías corregir si hay divergencia)
    const newMinutes = Math.round((newEnded.getTime() - newStarted.getTime())/60000);
    if(newMinutes !== log.minutes){
      console.log(`  # minutes mismatch log=${log.id} stored=${log.minutes} calc=${newMinutes}`);
    }
    // Recompute date: medianoche local de newStarted -> ISO (quedará en UTC cuando Prisma lo serialice)
    const localDay = startOfLocalDay(newStarted);
    const date = localDay; // Prisma guardará como UTC equivalente

    updates.push({ id: log.id, startedAt: newStarted, endedAt: newEnded, date, oldStarted, oldEnded });
  }

  if(dryRun){
    console.log('--- DRY RUN Preview (first 20) ---');
    updates.slice(0,20).forEach(u=>{
      console.log(`${u.id}\n  oldStart: ${u.oldStarted.toISOString()} -> newStart: ${u.startedAt.toISOString()}\n  oldEnd:   ${u.oldEnded.toISOString()} -> newEnd:   ${u.endedAt.toISOString()}\n  newDate(LOCAL midnight): ${u.date.toISOString()}`);
    });
    console.log(`Total planned updates: ${updates.length}`);
    console.log('Set DRY_RUN=false to apply changes.');
    return;
  }

  console.log('[fixLocalTimestamps] applying updates...');
  let processed = 0;
  for(const u of updates){
    await prisma.timeLog.update({ where: { id: u.id }, data: { startedAt: u.startedAt, endedAt: u.endedAt, date: u.date } });
    processed++;
    if(processed % 50 === 0) console.log(`  updated ${processed}/${updates.length}`);
  }
  console.log(`[fixLocalTimestamps] done. Updated ${processed} logs.`);
}

run().catch(e=>{ console.error(e); process.exit(1); }).finally(async ()=>{ await prisma.$disconnect(); });

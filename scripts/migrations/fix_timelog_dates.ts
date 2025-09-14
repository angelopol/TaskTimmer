/**
 * Migration: Normalize TimeLog.date to match the local calendar day of startedAt.
 *
 * Context:
 *  Older records may have `date` stored one day earlier (or later) due to UTC shifts
 *  when using `toISOString()` or constructing Date objects from `YYYY-MM-DD` (which
 *  are interpreted as UTC). This script recalculates the intended local date based
 *  on `startedAt` (or falls back to `endedAt` if needed) and rewrites `date` to the
 *  exact local midnight (00:00:00.000 local time) of that day.
 *
 * Behavior:
 *  - Dry run by default (no DB writes). Set the env var APPLY=1 to persist changes.
 *  - Scans all TimeLog rows (optionally batch with BATCH_SIZE env var; default 500).
 *  - Compares stored `date` (interpreted in local time) to recomputed local date.
 *  - Updates rows whose day differs.
 *  - Prints a summary at the end.
 *
 * Safety:
 *  - Idempotent: running again after fix results in 0 changes.
 *  - Only modifies the `date` field.
 *
 * Usage (Windows PowerShell examples):
 *  # Dry run (default)
 *  node -r ts-node/register scripts/migrations/fix_timelog_dates.ts
 *
 *  # Apply changes
 *  $env:APPLY="1"; node -r ts-node/register scripts/migrations/fix_timelog_dates.ts; Remove-Item Env:APPLY
 *
 *  # Custom batch size
 *  $env:BATCH_SIZE="1000"; node -r ts-node/register scripts/migrations/fix_timelog_dates.ts; Remove-Item Env:BATCH_SIZE
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Counts {
  scanned: number
  needsChange: number
  updated: number
  unchanged: number
  errors: number
}

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

async function main() {
  const APPLY = process.env.APPLY === '1'
  const batchSize = parseInt(process.env.BATCH_SIZE || '500', 10)

  const counts: Counts = { scanned: 0, needsChange: 0, updated: 0, unchanged: 0, errors: 0 }

  console.log(`[fix_timelog_dates] Starting migration (dryRun=${!APPLY}) batchSize=${batchSize}`)

  // Get total count first for progress info
  const total = await prisma.timeLog.count()
  console.log(`[fix_timelog_dates] Total TimeLog rows: ${total}`)

  for (let skip = 0; skip < total; skip += batchSize) {
    const logs = await prisma.timeLog.findMany({
      skip,
      take: batchSize,
      orderBy: { id: 'asc' },
    })

    for (const log of logs) {
      counts.scanned++
      try {
        const started = new Date(log.startedAt)
        const basis = isNaN(started.getTime()) && log.endedAt ? new Date(log.endedAt) : started
        if (isNaN(basis.getTime())) {
          console.warn(`[warn] Log ${log.id} has invalid startedAt/endedAt; skipping`)
          counts.errors++
          continue
        }
        const intendedLocal = localMidnight(basis)
        const storedDateLocal = localMidnight(new Date(log.date))

        if (!sameLocalDay(intendedLocal, storedDateLocal)) {
          counts.needsChange++
          if (APPLY) {
            await prisma.timeLog.update({
              where: { id: log.id },
              data: { date: intendedLocal },
            })
            counts.updated++
            console.log(`[update] ${log.id} date ${storedDateLocal.toISOString().substring(0,10)} -> ${intendedLocal.toISOString().substring(0,10)}`)
          } else {
            console.log(`[dry-run] Would update ${log.id} date ${storedDateLocal.toISOString().substring(0,10)} -> ${intendedLocal.toISOString().substring(0,10)}`)
          }
        } else {
          counts.unchanged++
        }
      } catch (e) {
        counts.errors++
        console.error(`[error] Log ${log.id}:`, e)
      }
    }
  }

  console.log('\n[fix_timelog_dates] Summary:')
  console.log(`  Scanned:      ${counts.scanned}`)
  console.log(`  Needs change: ${counts.needsChange}`)
  console.log(`  Updated:      ${counts.updated}`)
  console.log(`  Unchanged:    ${counts.unchanged}`)
  console.log(`  Errors:       ${counts.errors}`)
  console.log(`  Mode:         ${APPLY ? 'APPLY (changes persisted)' : 'DRY-RUN (no changes written)'}`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Fatal error in migration:', e)
  return prisma.$disconnect().finally(() => process.exit(1))
})

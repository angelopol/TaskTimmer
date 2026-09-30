#!/usr/bin/env node
/**
 * `prisma migrate deploy` with a one-time baseline for databases created with `prisma db push`.
 *
 * Production (Neon) was built with `db push`, so it has every table but no `_prisma_migrations`
 * history, and `migrate deploy` refuses with P3005. In that case (and only then) the migrations in
 * BASELINE, which were already applied by hand / by db push, are marked as applied and the deploy
 * is retried. Later migrations are NOT in this list, so they always run normally.
 *
 * Usage: node scripts/migrate-deploy.js   (needs DATABASE_URL and DIRECT_URL)
 */
const { spawnSync } = require('child_process');

const BASELINE = [
  '20260929000000_init_postgresql',
  '20261001000000_apple_reminders',
  '20261002000000_reminder_dedupe_key'
];

function prisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], { encoding: 'utf8', shell: process.platform === 'win32' });
  const output = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(output);
  return { ok: result.status === 0, output };
}

let deploy = prisma(['migrate', 'deploy']);
if (!deploy.ok && /P3005/.test(deploy.output)) {
  console.log('\n[migrate-deploy] Existing schema without migration history (P3005): baselining ' + BASELINE.length + ' migrations.');
  for (const name of BASELINE) {
    const resolved = prisma(['migrate', 'resolve', '--applied', name]);
    if (!resolved.ok && !/P3008/.test(resolved.output)) process.exit(1); // P3008 = already recorded as applied
  }
  deploy = prisma(['migrate', 'deploy']);
}
process.exit(deploy.ok ? 0 : 1);

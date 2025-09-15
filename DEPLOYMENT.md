# Deployment Guide (Vercel)

Comprehensive steps to deploy TaskTimmer to Vercel using a managed MySQL database (recommended) or SQLite (dev-only). Includes environment configuration, migrations, seeding, and PWA considerations.

---
## 1. Prerequisites
- Vercel account
- Git repository (GitHub / GitLab / Bitbucket) containing the project
- MySQL database (PlanetScale, Neon for MySQL beta, Railway, Aiven, Planetscale, or self-hosted). PlanetScale recommended (no native FKs by default; Prisma works with its compatibility mode).
- Node.js 18+ locally for migration/seeding tasks

## 2. Choose Database Provider
Production: Use MySQL. SQLite is file-based and not suited for multi-instance concurrency or Vercel's ephemeral filesystem.

## 3. Environment Variables
Copy `.env.example` and set values in Vercel Project Settings > Environment Variables.

| Variable | Required | Description |
|----------|----------|-------------|
| DB_PROVIDER | yes | `mysql` for production |
| DATABASE_URL | yes | MySQL connection string (Prisma format) |
| NEXTAUTH_SECRET | yes | 32+ char base64 secret (openssl rand -base64 32) |
| NEXTAUTH_URL | yes | Public HTTPS URL (e.g. https://tasktimmer.vercel.app) |
| SHORT_SESSION_HOURS | yes | Short session duration (int hours) |
| LONG_SESSION_DAYS | yes | Remember-me session duration (int days) |
| DEMO_SEED | no  | `true` only if you want automatic demo data (avoid in shared prod) |
| LOG_LEVEL | no  | Future: logging verbosity |

PlanetScale example connection string:
```
mysql://<username>:<password>@<host>/<database>?sslaccept=strict
```

## 4. Prisma Schema Provider
Ensure `prisma/schema.prisma` datasource block uses `provider = "mysql"` (or `env("DB_PROVIDER")` if configured). Commit any change before deploying.

```
datasource db {
  provider = env("DB_PROVIDER")
  url      = env("DATABASE_URL")
}
```

## 5. Running Migrations
Vercel build environment is read-only regarding running interactive migrations. Use one of:

### Option A: prisma migrate deploy (recommended)
1. Ensure all migrations exist locally via `npx prisma migrate dev` (this generates SQL in `prisma/migrations/`).
2. Commit the migrations folder.
3. During Vercel build, add a Post-Install / Build Command step or run manually once:
   - Add a Vercel deploy hook script or run locally: `npx prisma migrate deploy` (provide env vars locally, pointing to production DB) to apply migrations before first request.
4. (Optional) Create a script in `package.json`:
```
"scripts": {
  "migrate:deploy": "prisma migrate deploy"
}
```
Then run it locally with production env vars exported.

### Option B: Manual SQL apply
If your provider restricts DDL in certain workflows, generate SQL via `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` and apply through your DB console. Then future migration files follow normal `migrate dev` flow.

## 6. Seeding Strategy
If you need demo data in staging:
- Set `DEMO_SEED=true` and implement a seed script (current project uses `npm run seed`).
- Run seed locally against staging DB (preferred) rather than automatic on every deploy to avoid duplicate records.
- For production, generally keep `DEMO_SEED=false`.

## 7. Deployment Steps Summary
1. Set env vars in Vercel (Production + Preview as needed).
2. Switch datasource provider to MySQL if not already.
3. Generate and commit migrations.
4. (Optional) Seed staging database manually.
5. Push to main branch; Vercel builds and deploys.
6. Visit the site and log in / register.

## 8. Updating the Service Worker
Cache version lives in `public/sw.js` (e.g., `const CACHE_NAME = 'tasktimmer-v3';`). To force clients to refresh cached assets:
1. Increment version suffix (v3 -> v4).
2. Commit & deploy.
3. Clients will activate new SW on next visit (a second refresh may be needed).

No env vars are required for SW updates.

## 9. Icon & PWA Assets
If you change the base icon, run:
```
node scripts/generate-icons.js
```
Commit updated icons + manifest. Test installation (Chrome Lighthouse > PWA).

## 10. Performance & Cold Starts
- Use MySQL connection pooling (some providers auto-handle). For PlanetScale, avoid long transactions.
- Heavy dynamic routes can leverage Next.js Route Segment Config (dynamic = 'force-static' / caching) for static portions later.

## 11. Security Notes
- Keep `NEXTAUTH_SECRET` private; rotate if leaked.
- Enforce HTTPS (Vercel default).
- Consider setting `COOKIE_PREFIX` or advanced session options in future.

## 12. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 500 on auth callback | Missing NEXTAUTH_URL or secret | Set both in env |
| Prisma Error: P1001 | DB unreachable | Check host/firewall/SSL params |
| Auth works locally but not prod | Wrong NEXTAUTH_URL | Set to public domain |
| Old UI after deploy | SW cached assets | Bump cache version in `sw.js` |
| Seed duplicates | Seeding on every deploy | Keep DEMO_SEED=false in prod |

## 13. Future Enhancements
- Add `prisma generate` + `migrate deploy` as explicit build step via Vercel Project Settings > Build Command.
- Introduce metrics/log aggregation (e.g., OpenTelemetry) and structured logs.
- Add monitoring uptime check + synthetic login test.

---
Happy shipping! 🚀

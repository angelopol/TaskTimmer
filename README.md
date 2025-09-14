# TaskTimmer

International time planning & activity-based time tracking with weekly goals and schedule segments.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Prisma (SQLite dev, MySQL optional)
- NextAuth (Credentials)
- TailwindCSS
- Zod

## Installation

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Demo credentials (from seed):
```
email: demo@example.com
password: demo123
```

## Database: SQLite or MySQL

Default: SQLite (local file) for rapid development.

### Use SQLite (default)
1. In `.env` keep `DB_PROVIDER="sqlite"`.
2. Ensure `DATABASE_URL` is `file:./prisma/dev.db`.
3. Run migrations: `npx prisma migrate dev`.

### Switch to MySQL
1. Start a MySQL server and create a database (e.g. `tasktimmer`).
2. In `.env` set `DB_PROVIDER="mysql"` and define:
   - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.
   - Set (or uncomment) `DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"`.
3. Edit `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "mysql"` (or `env("DB_PROVIDER")` with Prisma >=5.4).
4. Run: `npx prisma migrate dev --name init_mysql`.
5. (Optional) Re-run `npm run seed` for sample data.

### Differences
- SQLite skips some advanced constraints; limited time zone / concurrency support.
- MySQL is recommended for production concurrency.
- Always confirm `DATABASE_URL` before deploying.

### Data migration (SQLite -> MySQL)
1. (Optional) `npx prisma db pull` to sync schema.
2. Dump: `sqlite3 prisma/dev.db .dump > dump.sql` (adjust types if needed) OR write a small Node script reading via Prisma and inserting into MySQL.
3. Point `DATABASE_URL` to MySQL and run migrations.

## Domain Models
See `prisma/schema.prisma` for definitions (User, Activity, ScheduleSegment, TimeLog, TimeLogSource enum).

## Basic Flow
1. Register or log in with demo account.
2. Review activities and schedule segments (seed creates a default timetable; weekday 1=Monday .. 7=Sunday).
3. Create time logs (`POST /api/logs`) – initial UI minimal.
4. Dashboard shows weekly progress (`GET /api/dashboard`).

## Authentication & Session (Remember Me)
The credentials login form includes a "Remember me" checkbox:
- If checked: session lifetime = `LONG_SESSION_DAYS` (default 30 days).
- If unchecked: session lifetime = `SHORT_SESSION_HOURS` (default 6 hours).

Environment variables controlling this:
```
SHORT_SESSION_HOURS=6
LONG_SESSION_DAYS=30
```
Implementation detail: a custom `expTs` (epoch ms) is embedded in the JWT. If current time exceeds it the session is treated as invalid even before NextAuth base `maxAge`.

## Roadmap / Next Steps
- Activity & segment management UI enhancements.
- Editable time logs (update/delete).
- Improved dashboard visual components (planned vs actual, source breakdown).
- Validation hardening & error normalization.
- Tests (unit + integration) and CI configuration.

## Health Check
Endpoint: `GET /api/health`

Sample response:
```json
{
  "status": "ok",
  "uptimeSec": 1234.12,
  "timestamp": "2025-09-14T12:34:56.000Z",
  "db": { "ok": true, "latencyMs": 4 },
  "latencyMs": 6,
  "env": { "providerHint": "sqlite" }
}
```
200 if DB reachable; 503 if database check fails.

---
MIT License

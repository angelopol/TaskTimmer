# TaskTimmer

International time planning & activity-based time tracking with weekly goals and schedule segments.

> Modernized authentication UI, responsive design system utilities, password strength feedback, toast notifications, and PWA support (installable + offline shell).

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Prisma (SQLite dev, MySQL optional)
- NextAuth (Credentials)
- TailwindCSS (+ custom utility layers for panels, form grid, transitions)
- Zod (schema validation) & React Hook Form
- Framer Motion (page transitions)

## Key Features
- Schedule segments with versioning-ready structure.
- Activity & time log tracking; weekly progress aggregation.
- Credentials auth with adjustable session lifetime (remember me logic) using `SHORT_SESSION_HOURS` / `LONG_SESSION_DAYS`.
- Enhanced Auth UI: unified layout, accessible labels, immediate validation, password strength meter.
- Toast notification system for success/error feedback.
- Installable PWA: manifest + service worker (versioned caches, simple offline shell).
- Icon generation script (`scripts/generate-icons.js`) produces required sizes + maskable icons via Sharp.
- Design system tokens via Tailwind utility classes (`tt-panel`, `tt-form-grid`, `tt-input`, `tt-badge-*`, transitions, motion-safe variants).
- Page transitions with Framer Motion respecting reduced motion preferences.

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

### Schedule Segments & Versioning (Overview)
Segments define planned activities across the week (1=Mon .. 7=Sun). The schema is structured so future improvements can introduce historical versioning (e.g., retaining past schedule changes) without major breaking changes.

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

### Password Strength Meter
The registration form scores password strength heuristically (length + character diversity). UI displays a colored badge and guidance text updating on each keystroke.

### Validation
Client-side: Zod schemas + React Hook Form for immediate feedback. Server-side: NextAuth credentials authorize pipeline. All form inputs have associated labels and ARIA attributes for accessibility.

### Toast Notifications
Success toasts show on login/registration before redirect navigation. Errors surface inline plus (optional) toast for clarity.

## Design System Utilities
Several cohesive utility classes provide consistent spacing, elevation, and visual rhythm (panels, form grid, inputs, badges). These reduce repetitive Tailwind class strings and encourage a unified look.

## PWA & Icons
The app registers a service worker (`public/sw.js`) maintaining a versioned cache (e.g., `v3`). When you change caching logic, bump the cache version and redeploy so clients pick up updated assets. The manifest defines standard + maskable icons and example screenshots.

### Regenerating Icons
1. Place a high-res square source at `public/icon-source.png` (or update script).
2. Run `node scripts/generate-icons.js` (ensure `sharp` is installed).
3. Commit generated icons + manifest updates.

## Page Transitions
`PageTransition` component (Framer Motion) animates route changes while respecting reduced motion (media query). Ensures subtle fade/slide that does not distract.

## Deployment
For a full Vercel deployment guide (environment variables, MySQL provisioning, Prisma migrate steps, seeding, and PWA considerations) see `DEPLOYMENT.md`.

### Session Expiration & 401 Handling

API routes now enforce presence of a valid `userId` via a global `middleware.ts` (matcher `/api/:path*`). When a JWT has expired according to the custom logic in `nextAuthOptions` (which removes `userId`), the middleware returns `401 Unauthorized` early. On the client, `useApiClient` automatically triggers `signOut()` and redirects to `/login` on any 401 to avoid Prisma validation errors caused by `null userId` conditions. If you add new API calls, prefer using the `apiFetch` wrapper for consistent behavior.

## Roadmap / Next Steps
- Activity & segment management UI enhancements.
- Editable time logs (update/delete).
- Improved dashboard visual components (planned vs actual, source breakdown).
- Validation hardening & error normalization.
- Tests (unit + integration) and CI configuration.
- Observability (structured logging, metrics) and performance profiling.
- Multi-language i18n support.

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

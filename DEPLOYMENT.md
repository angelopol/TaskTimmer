# Deploy TaskTimmer with Neon PostgreSQL

The application uses Prisma 6 and PostgreSQL. The checked-in migration creates its four tables and enum. The supplied MariaDB dump is `u619022423_tasktimmer.sql`; it is ignored by Git because it contains account data and password hashes.

## 1. Configure Neon

Create or select a Neon database in the Vercel Marketplace. Copy both connection strings from Neon for the same database and branch:

- `DATABASE_URL`: pooled connection string (`-pooler` hostname), for application queries.
- `DIRECT_URL`: direct connection string, for Prisma migrations and the data import.

Both URLs should use `postgresql://` and `sslmode=require`. Set them in Vercel Production environment variables and in your local `.env` when importing. Also set `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SHORT_SESSION_HOURS`, and `LONG_SESSION_DAYS` as in `.env.example`. Vercel Marketplace may provide differently named variables; map their values to these names.

## 2. Create the schema and load the dump

Do this once on an **empty** target database. The import uses plain `INSERT` statements and rolls back if any row violates a constraint. Do not run the demo seed before the import.

```powershell
npm ci
npm run migrate:deploy
python scripts/mysql_dump_to_postgres.py u619022423_tasktimmer.sql tasktimmer.postgresql-data.sql
psql $env:DIRECT_URL -X -v ON_ERROR_STOP=1 -f tasktimmer.postgresql-data.sql
```

If the database can only be reached from Vercel, run the migration and import in an environment that has access to that Neon database. The generated SQL file can also be loaded with a PostgreSQL SQL console that accepts scripts. Keep it private and do not commit or upload it to a public repository.

The generated `tasktimmer.postgresql-data.sql` contains private data and is ignored by Git. The converter checks row counts, duplicate IDs, and foreign key references before writing it. It preserves the dump's timestamp values as PostgreSQL `timestamp(3)` values.

Verify the imported counts:

```powershell
psql $env:DIRECT_URL -X -c 'SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Activity") AS activities, (SELECT count(*) FROM "ScheduleSegment") AS segments, (SELECT count(*) FROM "TimeLog") AS logs;'
```

For the supplied dump, expect 4 users, 8 activities, 18 segments, and 233 logs. Test login and a representative activity and log before directing production traffic to the new database.

## 3. Deploy

After setting Vercel environment variables, set the Vercel Build Command to `npm run build:with-migrate` if Vercel is the only environment that can reach Neon. This applies the migration before building. `postinstall` generates Prisma Client. Import the converted data once the schema exists. Future schema changes should be created with `prisma migrate dev` against a development PostgreSQL database and applied with `npm run migrate:deploy` before deployment. Do not use `db push --accept-data-loss` on imported data.

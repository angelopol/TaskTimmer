# TaskTimmer

Aplicación para planificar y registrar horas por actividad y comparar con metas semanales.

## Stack
- Next.js 14 (App Router)
- TypeScript
- Prisma (SQLite dev)
- NextAuth (Credentials)
- TailwindCSS
- Zod

## Instalación

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

## Base de datos: SQLite o MySQL

Por defecto el proyecto usa SQLite (archivo local) ideal para desarrollo rápido.

### Usar SQLite (default)
1. En `.env` deja `DB_PROVIDER="sqlite"`.
2. Asegúrate que `DATABASE_URL` sea `file:./prisma/dev.db`.
3. Ejecuta migraciones normalmente: `npx prisma migrate dev`.

### Cambiar a MySQL
1. Levanta un servidor MySQL y crea una base de datos (ej: `tasktimmer`).
2. En `.env` cambia `DB_PROVIDER="mysql"` y configura:
	- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.
	- Ajusta (o descomenta) `DATABASE_URL="mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"`.
3. Edita `prisma/schema.prisma` y cambia `provider = "sqlite"` a `provider = "mysql"` (o usa `env("DB_PROVIDER")` si activas esa modalidad en Prisma >=5.4).
4. Ejecuta: `npx prisma migrate dev --name init_mysql`.
5. (Opcional) Vuelve a correr `npm run seed` si quieres datos de ejemplo (adaptará inserts al nuevo motor).

### Notas sobre diferencias
- SQLite ignora algunos constraints avanzados y carece de tipos estrictos de tiempo / zona horaria.
- MySQL ofrece mejor concurrencia y escalabilidad para producción.
- Asegura que `DATABASE_URL` apunte a la base correcta antes de desplegar.

### Migración de datos
Para portar datos de SQLite a MySQL:
1. Exporta: `npx prisma db pull` (si modificaste algo manual) y usa `sqlite3 prisma/dev.db .dump > dump.sql`.
2. Transforma el SQL si es necesario (tipos) o crea un script Node que lea datos vía Prisma del origen y los inserte en el destino.
3. Inserta en MySQL y luego ajusta `DATABASE_URL` definitivo.

Credenciales demo (si usas seed):
```
email: demo@example.com
password: demo123
```

## Modelos (resumen)
Ver `prisma/schema.prisma`.

## Flujo básico
1. Registro o usar cuenta demo.
2. Revisar actividades y segmentos (seed generó horario). 
3. Registrar logs (endpoint POST /api/logs) – UI pendiente para versión inicial.
4. Dashboard mostrará progreso (endpoint /api/dashboard – placeholder ahora).

## Próximos pasos
- Completar endpoints faltantes (actualizaciones, delete, filtrado semana en dashboard).
- Añadir UI para gestión de actividades y segmentos.
- Añadir cálculo real de dashboard.
- Añadir validaciones en API.

## Notas
Seed crea segmentos según horario proporcionado, usando weekday 1=Lunes..7=Domingo.

## Health Check

Endpoint: `GET /api/health`

Respuesta ejemplo:
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

Estatus 200 si DB responde; 503 si falla. `providerHint` sirve para verificar rápidamente qué motor está configurado.

---
MIT License

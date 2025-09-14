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

---
MIT License

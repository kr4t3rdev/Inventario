# Prisma production baseline

## Estado actual de FinanceMDM

Verificado el 12 de noviembre de 2026 después de reconciliar el historial y
aplicar las migraciones pendientes:

- `prisma migrate status` informa que el schema está actualizado.
- `_prisma_migrations` contiene 188 filas: 183 migraciones aplicadas y 5 intentos
  fallidos marcados como revertidos (sin fallas pendientes).
- El repositorio actual contiene 180 directorios de migración. El historial conserva
  algunos registros de migraciones históricas cuyos directorios ya no están en el repo.
- El arranque de producción valida el estado con `prisma migrate status` antes de
  iniciar Next.js; falla de forma cerrada si el comando detecta un desfase.

Estos datos describen FinanceMDM en la fecha indicada. No deben usarse como baseline
para otra base de datos o un entorno nuevo sin una verificación propia.

## Procedimiento para una base de datos histórica sin baseline

No ejecutes `prisma migrate deploy` a ciegas en una base existente: puede intentar
reproducir DDL histórico sobre objetos ya creados. Primero confirma el estado real del
schema y del ledger.

1. Toma un backup de Railway/Postgres y registra su identificador.
2. Exporta `DATABASE_URL` del entorno que se va a revisar.
3. Ejecuta el helper en modo de solo lectura:

   ```bash
   pnpm tsx scripts/ops/baseline-prisma-production.ts --dry-run
   ```

4. Revisa cada migración propuesta contra el schema real. Marca una migración como
   aplicada solo cuando todos sus efectos estén presentes y validados:

   ```bash
   pnpm prisma migrate resolve --applied <migration_name>
   ```

5. Confirma el estado antes de continuar:

   ```bash
   pnpm prisma migrate status
   psql "$DATABASE_URL" -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name;'
   ```

6. Una vez reconciliado el baseline, usa `prisma migrate deploy` para las migraciones
   nuevas. No uses `db push --accept-data-loss` en producción como sustituto del
   historial de migraciones.

## Guard de arranque

`start.sh` ejecuta `pnpm exec prisma migrate status` antes de `node server.js`.
Si Prisma reporta migraciones pendientes o falla la consulta, el contenedor no inicia.
El guard se puede desactivar únicamente mediante `PRISMA_MIGRATION_GUARD_ON_START=false`;
no lo desactives en producción. Los entornos que usan `db-push` deben migrar a un
historial Prisma reconciliado antes de habilitar el guard.

La sincronización de schema continúa siendo opt-in y se controla por separado con
`PRISMA_SCHEMA_SYNC_ON_START` y `PRISMA_MIGRATION_MODE`.

# Balance y Resultado: preparación de despliegue

## Estado verificado

- La ausencia de `TenantAccountingPolicy` no se resuelve con una moneda global. La
  aplicación devuelve `409` con el código `TENANT_ACCOUNTING_POLICY_REQUIRED` y el
  mensaje seguro `La empresa no tiene una moneda funcional contable configurada`.
- La migración válida de v3 está rastreada como
  `prisma/migrations/20260824121000_add_financial_snapshot_v3/migration.sql`.
- La carpeta vacía `prisma/migrations/20260824110000_add_financial_snapshot_v3` era
  un nombre planificado anterior, no contiene SQL y no debe convertirse en una
  migración ni agregarse al baseline.
- La migración de política y checkpoints debe preceder a la de v3:
  `20260824120000_add_accounting_policy_and_auxiliary_checkpoints`, seguida de
  `20260824121000_add_financial_snapshot_v3`.

## Pasos exactos para el despliegue posterior

Estos pasos son una guía operativa; no se ejecutaron durante Apply.

1. Revisar el diff y confirmar que solo contiene la corrección, sus pruebas, esta
   documentación y las migraciones ya rastreadas. No leer ni copiar `.env`,
   `.env.local` o `prisma/.env`.
2. Confirmar que el árbol de migraciones contiene exactamente los dos directorios
   de esta corrección (`20260824120000...` y `20260824121000...`) y que cada uno
   contiene `migration.sql`. No crear un `migration.sql` vacío para `20260824110000`.
3. En CI o en una sesión operativa protegida, proporcionar `DATABASE_URL` y,
   cuando corresponda, `DIRECT_URL` mediante el gestor de secretos. Verificar el
   respaldo y el estado de migraciones antes de modificar la base de datos.
4. Si la base de datos existente requiere baseline, ejecutar primero el dry-run y
   revisar manualmente cada nombre contra el historial real:

   ```bash
   pnpm run ops:baseline-prisma-production -- --dry-run
   ```

   No ejecutar automáticamente los comandos `migrate resolve` que el dry-run
   imprime. Solo marcar como aplicadas migraciones que ya estén comprobadas en la
   base de datos; las dos migraciones de esta corrección deben quedar pendientes
   si sus cambios aún no existen.
5. Con respaldo aprobado y revisión de SQL completada, aplicar las migraciones
   pendientes desde CI con:

   ```bash
   pnpm exec prisma migrate deploy
   ```

   No usar `prisma db push` ni generar una migración nueva durante el despliegue.
6. Publicar la aplicación que contiene el mapeo de error. Antes de habilitar
   lectores estrictos, verificar que un tenant sin política recibe HTTP `409` y
   `TENANT_ACCOUNTING_POLICY_REQUIRED`, sin consultar una moneda global ni devolver
   HTTP `500`.
7. Configurar una `TenantAccountingPolicy` explícita por tenant usando evidencia
   independiente de la moneda funcional. No copiar automáticamente
   `Moneda.esPrincipal`. Repetir el smoke test y confirmar que un tenant con
   política puede consultar el reporte.
8. Registrar en la evidencia de release los comandos ejecutados, el estado de cada
   migración, el resultado del smoke test y el responsable de aprobación. No
   incluir URLs, tokens, credenciales ni valores de conexión.

## Rollback seguro

- Si falla la aplicación, revertir únicamente el código o desactivar el lector
  afectado. Mantener las migraciones aditivas y las filas de evidencia.
- No eliminar columnas, tablas, políticas ni snapshots aprobados. No ejecutar un
  down migration destructivo.
- Si falla la migración, detener la publicación, conservar el respaldo y escalar
  para una corrección forward-only. El estado de la base de datos debe revisarse
  antes de reintentar.

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

## Provisioning de política contable (fix-tenant-accounting-policy-provisioning)

Esta sección describe el procedimiento operativo del provisioning tenant-scoped
introducido por este cambio. Todo el texto visible usa español neutro
internacional. Ningún paso consulta `Moneda.esPrincipal`; la moneda funcional es
siempre una decisión explícita registrada con motivo, actor y auditoría estricta.

### Procedimiento para el tenant afectado (sin ejecución automática en Apply)

1. Identificar al tenant por un canal seguro de soporte; nunca inferirlo desde
   datos visibles en la interfaz ni desde la moneda principal del catálogo.
2. Ejecutar el preflight de tenant único y registrar la clasificación resultante:
   `POLICY_PRESENT`, `MISSING_NO_EVIDENCE`, `MISSING_WITH_EVIDENCE` o
   `REVIEW_REQUIRED`.
3. Obtener del responsable del tenant la decisión explícita de moneda funcional
   (por ejemplo CUP) junto con un motivo redactado.
4. Según clasificación:
   - `MISSING_NO_EVIDENCE`: un usuario con membresía activa y rol manager
     configura la moneda desde Configuración Contable («Configurar moneda
     funcional»), verifica que la auditoría registra `CREATED` y reintenta la
     consulta; el reporte debe responder 200.
   - `MISSING_WITH_EVIDENCE`: el manager registra su aprobación exacta para esa
     moneda («Registrar mi aprobación») y el caso pasa al rollout con triple
     control; no existe creación unilateral.
   - `REVIEW_REQUIRED`: escalar a operación contable; no escribir nada.
5. El éxito se demuestra por exactamente una fila de política, un evento de
   auditoría correlacionado y la desaparición del 409
   `TENANT_ACCOUNTING_POLICY_REQUIRED`. Nunca por un fallback ni por ceros.

### Fases de rollout amplio

1. **Preflight**: `preflight` incluye cada tenant exactamente una vez y el total
   inspeccionado debe conciliar antes de continuar.
2. **Dry-run vinculante**: `dry-run` valida el manifiesto V1 (hash SHA-256),
   persiste proyecciones `CREATE | NO_OP | CONFLICT | BLOCKED` y no crea
   políticas. Es la operación por defecto segura.
3. **Piloto**: lote pequeño con tenants sin evidencia y doble control
   plataforma (aprobador distinto del ejecutor).
4. **Lote sin evidencia**: aplicar entradas `CREATE`; reejecutar el mismo
   manifiesto debe converger a `NO_OP`.
5. **Lote con evidencia**: solo con aprobación tenant vigente y exacta más
   triple control plataforma; los bloqueos permanecen sin política.
6. **Enforcement**: activar validación en nuevas altas y demos; verificar que no
   existan tenants nuevos operativos sin política.
7. **Observación**: vigilar `accounting_policy_preflight_total`,
   `accounting_policy_provisioning_total`,
   `accounting_policy_rollout_entries_total` y el gauge
   `operational_tenants_without_accounting_policy`; un valor mayor que cero
   exige acción operacional.

### Stop conditions

Detener nuevas escrituras del lote si aparece cualquiera de estas señales:

- Una entrada termina en estado distinto al proyectado por el dry-run vinculado
  (por ejemplo conflicto no manifestado); el run queda `STOPPED` y el apply
  retorna `STOP_CONDITION_TRIGGERED`.
- Evidencia de aislamiento roto: conteos o identificadores de otros tenants.
- Política confirmada sin evento de auditoría estricta correlacionado.
- Conflicto inesperado entre monedas durante el mismo lote.

Ante una stop condition, conservar el estado durable de las entradas ya
aplicadas, conciliar totales (`inspected = present + created + no-op + blocked +
conflict + failed`) y abrir revisión antes de reanudar.

### Gates obligatorios antes de habilitar apply

Si falta cualquiera de estos gates, el código y este runbook solo permiten
preflight y dry-run:

- Mapeos reales de capacidades `accounting_policy.manage` y
  `accounting_policy.rollout` desplegados y verificados con usuarios activos.
- Aprobador y ejecutor plataforma identificados como identidades distintas.
- Responsables nominales del tenant disponibles para decisiones de evidencia.
- Retención de auditoría demostrada para toda la vida útil de la política.
- Respaldo verificable de base de datos y piloto completado sin desvíos.

La CLI exige referencias de evidencia para los cuatro gates antes de crear el run
de `APPLY`. La ausencia de cualquiera falla cerrada y no crea filas de run ni de
entrada, mientras que `preflight` y `dry-run` siguen permitidos:

```bash
pnpm exec tsx scripts/ops/accounting-policy-rollout.ts apply \
  --apply --manifest manifiesto.json --dry-run-id <run> \
  --correlation-id <correlacion> --executor <ejecutor> \
  --capability-mappings-proof <evidencia-capacidades> \
  --tenant-responsibles-proof <evidencia-responsables> \
  --database-backup-proof <evidencia-respaldo> \
  --pilot-proof <evidencia-piloto>
```

Estas referencias deben apuntar a registros verificables de la sesión protegida;
no son credenciales ni valores de conexión. El servicio vuelve a comprobar el
formato y el estado verificable de cada prueba, sin confiar en un booleano
implícito del caller.

### Rollback forward-only

- Detener el apply y mantener los lectores fail-closed; revertir código o UI
  nunca reactiva un fallback de moneda.
- No borrar ni modificar políticas masivamente. Antes de evidencia, una
  corrección exige operación explícita, autorizada, con motivo y auditoría.
- Después de evidencia registrada, la moneda no cambia: el reporte del tenant
  afectado queda bloqueado y se abre una remediación contable separada.

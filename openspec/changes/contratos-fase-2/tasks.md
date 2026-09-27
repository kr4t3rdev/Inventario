# Tasks — Contratos fase 2 (serie CTF)

Plan SDD/TDD. Reglas del proyecto: TDD estricto con evidencia del fallo RED en el log antes del GREEN; tests con rutas explícitas (`pnpm exec vitest run <rutas>`, nunca la suite completa); todo test unitario mockea `@/lib/prisma` (barrera MM-B); commit por fase con stage selectivo (`git diff --cached --name-only` antes de cada commit); migraciones `--create-only` + revisión SQL (producción corre `PRISMA_MIGRATION_MODE=db-push`; backfills manuales post-deploy); copys de UI en español neutro.

Rama: `feat/contratos-fase-2` (worktree dedicado `../TCP-sesion-d-contratos`, base `main` b4be12ba). Sin merge a `main` hasta aviso del usuario.

## CTF-1 — Máquina de estados

- [x] **T1 — RED núcleo puro.** `__tests__/estado-contrato-machine.test.ts`: tabla completa de transiciones válidas (§1.1 del design), rechazo de inválidas representativas (BORRADOR→ACTIVO, RECHAZADO→ACTIVO, ACTIVO→BORRADOR, FINALIZADO→cualquiera, ANULADO→cualquiera), `ESTADOS_TERMINALES`, `assertTransicionValida` lanza `ActionError` código `TRANSICION_INVALIDA` con mensaje "No se puede cambiar un contrato de X a Y".
  `pnpm exec vitest run src/features/contratos/__tests__/estado-contrato-machine.test.ts`
- [x] **T2 — GREEN núcleo.** `lib/estado-contrato-machine.ts` según design §1.2 (sin Prisma).
- [x] **T3 — RED acción + bulk.** Extender `__tests__/actions.test.ts` (mismo contrato de mocks):
  - `cambiarEstadoContratoAction`: transición válida persiste + efectos (hacia APROBADO setea `aprobadoPor`/`fechaAprobacion` server-side); inválida lanza `TRANSICION_INVALIDA`; contrato de otro tenant → `NOT_FOUND`; llama a `AuditLogService.log` (`accion: 'UPDATE'`, `entidad: 'CONTRATO'`).
  - `bulkUpdateContratoStatusAction`: mezcla de válidos/inválidos → aplica solo válidos, devuelve `{ actualizados, fallidos }`, no lanza por los inválidos.
- [x] **T4 — GREEN acción + bulk.** `cambiarEstadoContratoAction` en `actions.ts`; refactor de `bulkUpdateContratoStatusAction`; añadir `'CONTRATO'` a la unión `AuditEntity` en `src/lib/services/audit-log-service.ts`.
- [x] **T5 — RED/GREEN handlers.** `bulkUpdateContratoStatusHandler` con el mismo comportamiento por id (fallidos en 200, no 500) y `createContratoAprobacionHandler` pasando por `assertTransicionValida(estado → 'APROBADO')` con `aprobadoPor` server-side.
- [x] **T6 — UI bulk con fallidos.** `contratos-content.tsx`: toast diferenciado con ids/motivos de `fallidos` (español neutro).
- Commit: `feat(contratos): máquina de estados con transiciones válidas y bulk por id (CTF-1)`

## CTF-2 — Saneamiento del PUT

- [x] **T1 — RED.** `__tests__/sanitizacion-update.test.ts`: `updateContratoAction` y `updateContratoHandler` ignoran `estado`, `numeroContrato`, `fechaAprobacion`, `aprobadoPor` del payload (no se persisten; sin 400); la edición de contenido (monto, fechas, condiciones, contraparte) sigue funcionando.
  `pnpm exec vitest run src/features/contratos/__tests__/sanitizacion-update.test.ts`
- [x] **T2 — GREEN.** Retirar los 4 campos de `contratoUpdateSchema` (`schemas.ts` + handler) y de la construcción de `data`; quitar la validación de membresía de `aprobadoPor` en el handler (queda sin sentido).
- [x] **T3 — UI.** Verificar que `contrato-form.tsx` no depende de enviar `estado` en edición (si lo hacía, retirarlo: el ciclo de vida es solo vía CTF-1).
- Commit: `fix(contratos): PUT no escribe numeración ni ciclo de vida (CTF-2)`

## CTF-3 — firma→ACTIVO

- [x] **T1 — RED.** `__tests__/firmas-activacion.test.ts`: firma `FIRMADA` sobre contrato APROBADO → estado ACTIVO con `fechaFirma` server-side (ignora la del payload); firma FIRMADA sobre contrato no APROBADO → firma creada sin transición; firma PENDIENTE → sin cambios; `estado` de firma restringido a `PENDIENTE|FIRMADA|RECHAZADA` (payload con otro valor → 400).
  `pnpm exec vitest run src/features/contratos/__tests__/firmas-activacion.test.ts`
- [x] **T2 — GREEN.** Helper `registrarFirmaYTransicionar` en `lib/firmas-contrato.ts` + `createContratoFirmaHandler` usa el helper; enum de firma en Zod.
- [x] **T3 — UI.** `add-firma-dialog.tsx`: select PENDIENTE/FIRMADA con copy neutro.
- Commit: `feat(contratos): firma FIRMADA activa contrato APROBADO (CTF-3)`

## CTF-4 — RBAC por ruta

- [x] **T1 — RED mapa.** `__tests__/rbac-rutas.test.ts`: `getRoutePermissionKey` resuelve las 6 entradas nuevas del design §4 (incluye no-colisión: `/api/contratos` no captura `/api/tipos-contratos` ni `/api/configuracion/…`) y cada clave existe en el registry (el drift gate cubre el resto).
  `pnpm exec vitest run src/features/contratos/__tests__/rbac-rutas.test.ts`
- [x] **T2 — GREEN mapa + registry.** Entradas en `src/lib/auth/route-permissions.ts`; clave `config.contratos.configurar` en `permission-registry.ts` (category `config`, `defaultRoles: ['manager']`).
- [x] **T3 — GREEN wrappers.** Los 13 archivos de ruta envueltos con `withAuth` (`src/lib/auth-middleware.ts`).
- Commit: `feat(contratos): RBAC fail-closed por ruta (CTF-4)`

## CTF-5 — Config por tenant

- [x] **T1 — RED ruta tenant-scoped.** `__tests__/configuracion-tenant.test.ts`: GET crea fila default (upsert perezoso) y responde `{ diasAvisoVencimiento }`; PUT valida 1..365 y hace upsert por tenant; sin tenant → 403.
  `pnpm exec vitest run src/features/contratos/__tests__/configuracion-tenant.test.ts`
- [x] **T2 — GREEN schema + ruta.** Modelo `ConfiguracionContratos` + relación en `Tenant`; clasificación `scoped` en `model-classification.ts` (y nota de `ConfiguracionSistema` actualizada); ruta reescrita por tenant; deprecación de `ConfiguracionSistema.diasAvisoVencimientoContrato` y `Vendor.contrato` en schema (comentarios).
- [x] **T3 — Migración.** `prisma migrate dev --create-only` → revisión SQL → aplicar en local.
- [x] **T4 — UI + resolver.** `resolverDiasAviso` en lib; `configuracion-contratos.tsx` y `contratos-content.tsx` al campo nuevo.
- [x] **T5 — Backfill opt-in.** `scripts/backfill/configuracion-contratos-tenant.ts` (copia global→por tenant, idempotente); doc de ejecución manual post-deploy.
- Commit: `feat(contratos): configuración de contratos por tenant (CTF-5)`

## CTF-6 — Cron de alertas de vencimiento

- [x] **T1 — RED lib puro.** `__tests__/alertas-vencimiento.test.ts`: VENCIMIENTO_PROXIMO dentro de la ventana (per-contrato y fallback por tenant y default 30), CONTRATO_VENCIDO hasta 30 días de antigüedad, ignora no-ACTIVO y sin fechaFin, `accionRequerida` ≤7 días, `fechaAlerta` truncada al día, dedupe contra alertas existentes del día.
  `pnpm exec vitest run src/features/contratos/__tests__/alertas-vencimiento.test.ts`
- [x] **T2 — GREEN lib + script.** `lib/alertas-vencimiento.ts` + `scripts/alertas-vencimiento-contratos.ts` (tsx, PrismaClient directo, JSON summary, idempotente) + `contratos:alertas-vencimiento` en package.json + doc de scheduling en el header.
- Commit: `feat(contratos): cron de alertas de vencimiento idempotente (CTF-6)`

## CTF-7 — Deprecar Vendor.contrato

- [x] **T1 — RED mobile.** Test de providers: create/update con `contrato` en payload ⇒ ignorado (no persiste); el resto de campos sigue funcionando.
  `pnpm exec vitest run src/app/api/mobile/v1/providers`
- [x] **T2 — GREEN.** Quitar `contrato` de schemas Zod y `data` de create/update en mobile providers (create:53, id:105); lectura se conserva.
- Commit: `chore(contratos): depreca Vendor.contrato y cesa su escritura (CTF-7)`

## Cierre

- [x] Suite scoped del módulo en verde: `pnpm exec vitest run src/features/contratos src/app/api/contratos src/features/contratos/__tests__` (+ tests mobile tocados).
- [x] `pnpm exec tsc --noEmit` sin errores nuevos.
- [x] `pnpm run lint` limpio en archivos tocados.
- [x] Code review (typescript-reviewer) y correcciones.
- [x] Dejar la rama lista para merge a `main` — **sin ejecutar el merge** (espera aviso del usuario).

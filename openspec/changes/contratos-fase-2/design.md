# Design — Contratos fase 2 (serie CTF, 7 fases)

Base de implementación. Todas las rutas referenciadas existen hoy; los números de línea son del árbol al 2026-09-27 sobre `main` (b4be12ba).

## 1. Máquina de estados (CTF-1)

### 1.1 Transiciones válidas

Enum existente `EstadoContrato` (Prisma): BORRADOR, PENDIENTE_APROBACION, APROBADO, RECHAZADO, ACTIVO, FINALIZADO, ANULADO. Sin estados nuevos.

| Desde | Hacia permitidos |
|---|---|
| BORRADOR | PENDIENTE_APROBACION, ANULADO |
| PENDIENTE_APROBACION | APROBADO, RECHAZADO, ANULADO |
| RECHAZADO | BORRADOR, ANULADO |
| APROBADO | ACTIVO, ANULADO |
| ACTIVO | FINALIZADO, ANULADO |
| FINALIZADO | — (terminal) |
| ANULADO | — (terminal) |

### 1.2 Núcleo puro — `src/features/contratos/lib/estado-contrato-machine.ts`

- `TRANSICIONES_VALIDAS: Record<EstadoContrato, readonly EstadoContrato[]>` (tabla 1.1).
- `ESTADOS_TERMINALES: readonly EstadoContrato[]` = `['FINALIZADO','ANULADO']`.
- `puedeTransicionar(desde, hacia): boolean`.
- `assertTransicionValida(desde, hacia): void` — lanza `ActionError('No se puede cambiar un contrato de {desde} a {hacia}', 'TRANSICION_INVALIDA')`. Import de `ActionError` desde `@/lib/server-actions` (el módulo sigue puro: solo tipos + esa clase de error).

### 1.3 Vía de cambio de estado

- **Acción `cambiarEstadoContratoAction`** en `src/features/contratos/actions.ts` (`withAction`, input `{ contratoId, estado, motivo? }` con Zod):
  1. `requireFeature(user, 'contratos', 'gestionar contratos')` + `requireTenant(user)`.
  2. `findFirst({ contratoId, tenantId })` → 404 si no.
  3. `assertTransicionValida(existing.estado, parsed.estado)`.
  4. Efectos colaterales server-side: hacia `APROBADO` ⇒ `aprobadoPor: user.userId`, `fechaAprobacion: new Date()`; hacia otros estados se limpian `aprobadoPor`/`fechaAprobacion` si estaban (salvo transición a ACTIVO/FINALIZADO, que conserva aprobador).
  5. Auditoría: `AuditLogService.log({ accion: 'UPDATE', entidad: 'CONTRATO', entidadId, usuarioId: user.userId, detalles: { desde, hacia, motivo } })`. Se añade `'CONTRATO'` a la unión `AuditEntity` de `src/lib/services/audit-log-service.ts`. Best-effort: el propio servicio ya traga errores.
  6. `revalidatePath('/busy/contratos')`.
- **Bulk** — `bulkUpdateContratoStatusAction` y `bulkUpdateContratoStatusHandler`: dejan de ser `updateMany` ciego. Cargan los contratos de los ids (scoped por tenant), validan cada transición, aplican un único `updateMany` con los ids válidos y devuelven `{ success: true, actualizados: string[], fallidos: { contratoId, motivo }[] }`. Nunca 500 por transiciones inválidas. La UI (`contratos-content.tsx:215`) muestra los fallidos en el toast.
- **Aprobación existente** — `createContratoAprobacionHandler` (handlers.ts ~843) escribe `estado: 'APROBADO'` a ciegas: pasa por `assertTransicionValida(contrato.estado, 'APROBADO')`; si el contrato no está en PENDIENTE_APROBACION, la aprobación se registra pero no cambia el estado. `aprobadoPor` = `aprobadorId` (ya validado como miembro del tenant), no campo libre.

## 2. Saneamiento del PUT (CTF-2)

Retirar de los schemas de update (y de la construcción de `data`) estos campos, en **ambos** canales (action y handler):

| Campo | Hoy | Después |
|---|---|---|
| `estado` | escribible por cliente | solo vía máquina (§1.3) |
| `numeroContrato` | escribible por cliente en el handler (handlers.ts:50) | solo server-generated (`numeroContratoGenerator`) |
| `fechaAprobacion` | escribible por cliente | solo server al aprobar |
| `aprobadoPor` | escribible por cliente | solo server al aprobar |

- Zod no-estricto ignora los campos extra: clientes viejos no rompen, los valores no se persisten. Tests de invariante: PUT con esos 4 campos no altera la fila.
- `updateContratoHandler` pierde también la validación de membresía de `aprobadoPor` (handlers.ts:284-287) por innecesaria.
- La edición de contenido (montos, fechas, condiciones, contraparte) sigue permitida en cualquier estado no terminal.

## 3. firma→ACTIVO (CTF-3)

- Estado de firma tipado en Zod: `PENDIENTE | FIRMADA | RECHAZADA` (hoy `z.string()` libre; la UI solo envía `PENDIENTE`).
- Helper compartido `registrarFirmaYTransicionar` en `src/features/contratos/lib/firmas-contrato.ts`:
  1. Si `estado === 'FIRMADA'`: `fechaFirma = new Date()` server-side (ignora la del payload).
  2. Si contrato en `APROBADO` y firma FIRMADA ⇒ `assertTransicionValida('APROBADO','ACTIVO')` + update a `ACTIVO` en la misma escritura.
  3. Firma no-FIRMADA no toca el contrato.
- `createContratoFirmaHandler` usa el helper. La UI (`add-firma-dialog.tsx`, hoy siempre `estado: 'PENDIENTE'`) agrega select de estado PENDIENTE/FIRMADA con copy neutro.
- Firma sobre contrato no APROBADO con FIRMADA: se crea la firma, sin transición (no es error).

## 4. RBAC por ruta (CTF-4)

`withAuth` (auth-middleware.ts:490) resuelve `getRoutePermissionKey(path, method)` contra `ROUTE_PERMISSION_MAP` (src/lib/auth/route-permissions.ts): sin clave ⇒ 403 fail-closed + `[UNMAPPED_ROUTE]`. Las 13 rutas de contratos hoy llaman `authenticateUser(request)` directo, sin gate.

Entradas nuevas en `ROUTE_PERMISSION_MAP`:

| Prefijo | Métodos | Clave |
|---|---|---|
| `/api/contratos` | todos | `ventas.contratos.gestionar` |
| `/api/tipos-contratos` | GET | `ventas.contratos.gestionar` |
| `/api/tipos-contratos` | POST, PUT | `config.tipos-contrato.crear` |
| `/api/tipos-contratos` | DELETE | `config.tipos-contrato.eliminar` |
| `/api/configuracion/sistema/contratos` | GET | `ventas.contratos.gestionar` |
| `/api/configuracion/sistema/contratos` | PUT | `config.contratos.configurar` (nueva) |

- Cuidado con el orden de matching: `/api/contratos` no es prefijo de `/api/tipos-contratos` ni de `/api/configuracion/…` (startsBy), no hay colisión. La ruta de config se declara antes de ninguna regla genérica de `/api/configuracion` (no existe hoy).
- Clave nueva en `permission-registry.ts`: `config.contratos.configurar` — "Configurar contratos del sistema", category `config`, `defaultRoles: ['manager']`, no sensitive. El drift gate (`permission-drift.test.ts`) valida que toda clave del mapa existe en el registry.
- Los 13 archivos de ruta se envuelven: `export const GET = withAuth((req, ctx) => getContratosHandler(req, ctx))`. El handler re-autentica internamente (`authenticateUser` sin path/método); la segunda llamada es inocua y mantiene el diff mínimo. Mobile ya está mapeado (`contracts → ventas.contratos.gestionar`), sin cambios.

## 5. Config de contratos por tenant (CTF-5)

Modelo aditivo en `prisma/schema.prisma`:

```prisma
model ConfiguracionContratos {
  configId             String   @id @default(cuid())
  tenantId             String   @unique
  diasAvisoVencimiento Int      @default(30)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  tenant               Tenant   @relation(fields: [tenantId], references: [tenantId])
}
```

- Relación inversa `configuracionContratos ConfiguracionContratos?` en `Tenant`.
- `model-classification.ts`: `ConfiguracionContratos: scoped`; nota de `ConfiguracionSistema` actualizada (decisión tomada: campo migrado a por-tenant).
- Ruta `/api/configuracion/sistema/contratos`: GET con upsert perezoso (fila default si falta), PUT valida `1..365` y hace upsert por `user.tenantId` (fail-closed sin tenant). Respuesta: `{ diasAvisoVencimiento: number }`.
- UI: `configuracion-contratos.tsx` pasa al campo nuevo; `contratos-content.tsx` resuelve `contrato.diasAvisoVencimiento ?? configTenant.diasAvisoVencimiento ?? 30`.
- Resolver compartido `resolverDiasAviso(contrato, configTenant)` en `lib/` (lo usa la UI y el cron).
- `ConfiguracionSistema.diasAvisoVencimientoContrato` y `Vendor.contrato`: comentario `/// @deprecated …` en schema; columnas se conservan (borrado en higiene posterior).
- Migración `--create-only` + revisión SQL; prod corre `db-push` (los backfills son manuales). Backfill opt-in `scripts/backfill/configuracion-contratos-tenant.ts`: copia el valor global a una fila por tenant, idempotente.

## 6. Cron de alertas de vencimiento (CTF-6)

Lib puro `src/features/contratos/lib/alertas-vencimiento.ts`:

- Input: contratos `{ contratoId, tenantId, estado, fechaFin, diasAvisoVencimiento }[]`, configs por tenant `Map<tenantId, diasAviso>`, `hoy: Date`.
- Solo `estado === 'ACTIVO'` con `fechaFin != null`. `diasRestantes = ceil((fechaFin − hoy) / 86400000)`:
  - `0 ≤ diasRestantes ≤ diasAviso` ⇒ `VENCIMIENTO_PROXIMO`, `accionRequerida: diasRestantes ≤ 7`.
  - `diasRestantes < 0` ⇒ `CONTRATO_VENCIDO`, `accionRequerida: true`, solo si el vencimiento tiene ≤ 30 días de antigüedad (no acumula histórico infinito).
- `fechaAlerta` truncada al día UTC ⇒ dedupe determinista.
- Output: `ContratoAlerta[]` a crear, sin persistir.

Script `scripts/alertas-vencimiento-contratos.ts` (patrón `deactivate-expired-demos.ts`: tsx standalone, `PrismaClient` directo, salida JSON `{ tenantsEvaluados, alertasCreadas, omitidasDuplicadas }`):

1. Carga activos con fechaFin + configs por tenant (2 queries).
2. Dedupe por `(contratoId, tipo, fechaAlerta)` contra las alertas existentes del conjunto candidato.
3. Idempotente: correrlo dos veces el mismo día no duplica.

`package.json`: `"contratos:alertas-vencimiento": "tsx scripts/alertas-vencimiento-contratos.ts"`. Scheduling diario vía cron externo (mismo mecanismo que el cron de demos; doc en el header del script).

## 7. Deprecar `Vendor.contrato` (CTF-7)

- Schema: `/// @deprecated Usar la relación contratos (ContratoVendor); sin escritura desde CTF-7` sobre `contrato String?` (schema.prisma:56).
- `src/app/api/mobile/v1/providers/create/route.ts` y `[id]/route.ts`: quitar `contrato` del schema Zod de entrada y de los `data` de create/update (líneas create:53, id:105). Lectura se conserva mientras exista la columna.
- Tests: payload con `contrato` ⇒ se ignora.

## 8. Errores y copys (español neutro)

- `TRANSICION_INVALIDA` → mensaje "No se puede cambiar un contrato de {desde} a {hacia}". Acción: `ActionError` (result `{ success:false }`); handler bulk: HTTP 200 con `fallidos` (no 500); resto de handlers: 400.
- Sin permiso → 403 estándar del gate.
- Config inválida → 400 con mensaje de validación.

## 9. Testing (TDD estricto)

- Corridas con rutas explícitas: `pnpm exec vitest run <rutas>` (suite completa ≈26 min con fallos preexistentes — prohibida).
- Barrera MM-B: todo test unitario mockea `@/lib/prisma`; nada toca DB real fuera de `__integration__` (esta serie no requiere integración).
- Ficheros de test nuevos (junto al código): `estado-contrato-machine.test.ts`, `sanitizacion-update.test.ts`, `firmas-activacion.test.ts`, `rbac-rutas.test.ts`, `configuracion-tenant.test.ts`, `alertas-vencimiento.test.ts` (todos bajo `src/features/contratos/__tests__/`), más ajustes a `actions.test.ts` y a los tests de mobile providers si existen.
- Evidencia RED en el log antes del GREEN de cada fase; commit por fase con stage selectivo (`git diff --cached --name-only`).

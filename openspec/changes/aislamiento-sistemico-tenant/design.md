# Diseño técnico — Enforcement sistémico del aislamiento

## Arquitectura de la solución

```
request → authenticateUser / withAction
              │ (ya resuelve tenantId por membresía)
              ▼
      tenantContext.run({tenantId}, next)     ← AsyncLocalStorage
              │
              ▼
   código de negocio usa `prisma` (cliente extendido)
              │
              ▼
   $extends({ query }): para modelos `scoped`
     · inyecta tenantId en where/data
     · valida que tenantId explícito == contexto
     · sin contexto → fail-closed (enforce) o log (shadow)
              │
   `prismaPlatform` = cliente sin extensión, export aparte,
   allowlist de consumidores (auth, admin, seeds, cron, afiliados)
```

## 1. Clasificación de modelos (`src/lib/db/model-classification.ts`)

Inventario real medido el 2026-09-05: **128 modelos; 89 con `tenantId`; 39 sin él**. Los 39 se reparten así (clasificación propuesta sujeta a verificación en PG-A1):

- **`global` (plataforma — nunca llevan tenant):** `User`, `UserSession`, `UserActivityLog`, `Plan`, `Tenant` (identidad), `TenantMembership`?, `CloudinaryAsset`?*, `AffiliateProfile/Referral/…`, `SalesAgent*`, `ReferralPerkCatalog`, `Notification`, `AuditLog`, `ConfiguracionSistema`†, `CatalogoReparacionConfig`?, `TasaCambio` (catálogo gobernado global confirmado en auditoría FX), `Moneda`?*
  - *`Moneda` y `CloudinaryAsset` se verifican: hay señales contradictorias (auditoría de monedas los describe por-tenant; si lo son, pasan a la ola de columna).*
  - †`ConfiguracionSistema` es global-por-accidente hoy; decisión: se queda global documentado (config de plataforma) o se migra a tenant — resolver en PG-A1.
- **`child` (heredan tenant del padre):** `VentaItem` (←Venta), `OfertaItem` (←Oferta), `ContratoVersion/Firma/Aprobacion/Archivo/Alerta` (←Contrato), `PrecioProducto` (←ListaPrecio), `ProductoCostHistory` (←Producto), `AnticipoMovimiento` (←Anticipo), `VendorCodeSequence` (←Vendor/tenant), `Attendance`, `EmployeeWorkSchedule`, `VacationRequest`, `VacationAccrual` (←Empleado), `PagoDeuda` (←InyeccionCapital/CuentaBancaria), `SaldoSnapshot` (←PeriodoContable/CuentaBancaria), `TenantLicense`? (tiene tenantId — verificar; está en scoped si lo tiene).
- **Sospechosos a escopar (necesitan columna):** `TransaccionMoneda`, `AlertHistory`, `ReportHistory`, `ScheduledReport`, `ScenarioSimulation`, `InyeccionCapital`, `TipoContratoCustom` (decisión ya tomada en correcciones-urgentes: por-tenant), `AuditLog` (hoy global: ¿tenantId para consulta por tenant? decidir).

El contrato es una **lista total**: test que hace diff entre los modelos del schema (leyendo el DMMF en runtime de test) y la clasificación → si aparece un modelo nuevo no clasificado, CI falla. Regla de oro: el default es `scoped`, hay que argumentar para lo contrario.

## 2. Cliente extendido (`src/lib/db/scoped-prisma.ts`)

Prisma 6.19 soporta extensiones de cliente estables. Implementación del componente `query`:

```ts
// Pseudocódigo — el detalle exacto se fija en implementación
export function buildScopedClient(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const kind = classification(model);             // scoped | global | child
          if (kind !== 'scoped') return query(args);      // global/child pasan (child: ver §5)
          const ctx = getTenantContext();                 // ALS
          if (!ctx) return handleNoContext(model, operation, args, query); // shadow: log+pass / enforce: throw
          return query(applyTenant(model, operation, args, ctx.tenantId));
        },
      },
    },
  });
}
```

**Matriz de inyección por operación** (modelos `scoped`):

| Operación | Transformación |
|---|---|
| `findMany`, `findFirst`, `count`, `aggregate`, `groupBy` | `where = { AND: [where, { tenantId: ctx }] }` |
| `findUnique(OrThrow)` | `where = { ...uniqueWhere, tenantId: ctx }` (extendedWhereUnique, GA desde Prisma 5) |
| `update`, `delete` | idem findUnique: `where + tenantId` |
| `updateMany`, `deleteMany` | `where = { AND: [where, { tenantId }] }` |
| `create` | `data.tenantId ??= ctx`; si `data.tenantId && !== ctx` → `TenantMismatchError`; nested `create/connect` sobre relaciones scoped validadas igual |
| `createMany` | cada fila: misma regla |
| `upsert` | `where` + `create` + `update` con las reglas anteriores |

**Operaciones fuera de alcance semántico:** `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe` → la extensión no las intercepta con sentido. Política: inventario completo en `src/lib/db/raw-sql-allowlist.ts`; cada entrada lleva `{ archivo, motivo, cómo se garantiza el tenant }`. Test estático: cualquier `$*Raw*` fuera de la allowlist rompe CI.

**Transacciones:** `$extends` persiste dentro de `$transaction` interactivos (el `tx` hereda la extensión) — verificar con test dedicado. Las funciones que reciben un `tx` como parámetro siguen escopadas sin cambios.

**Fail-closed ante ausencia de contexto:** si código con cliente scoped corre fuera de request (workers, seeds, tests): `shadow` registra `TENANT_CTX_MISSING`; `enforce` lanza `TenantContextRequiredError`. Los callers legítimos sin tenant usan `withTenantContext(tenantId, fn)` explícito o `prismaPlatform`.

## 3. Contexto: AsyncLocalStorage

`src/lib/db/tenant-context.ts`:

```ts
const als = new AsyncLocalStorage<{ tenantId: string }>();
export const tenantContext = { run: als.run.bind(als), get: () => als.getStore() };
export function withTenantContext<T>(tenantId: string, fn: () => T): T;
```

Puntos de poblado (los únicos dos, ambos ya resuelven membresía hoy):
1. `authenticateUser` (`src/lib/auth-middleware.ts`) — tras `resolveTenantContext`, envuelve el resto del pipeline.
2. `withAction` (`src/lib/server-actions/with-action.ts`) — idem para server actions.

Decisión deliberada: **ALS y no pasar ctx por parámetro** porque el objetivo es proteger los 443 archivos sin reescribirlos. El precio (contexto implícito) se mitiga: el contexto se fija solo en los dos puntos de entrada, es inmutable dentro del request, y los tests cubren ausencia de contexto.

## 4. `prismaPlatform` y allowlist de imports

- `src/lib/db/platform-prisma.ts` exporta el cliente base **sin** extensión.
- Test estático (mismo estilo que `test-isolation-contract.test.ts`): `import ... from '@/lib/db/platform-prisma'` solo permitido en la allowlist: `src/lib/auth-middleware.ts`, `src/features/admin/**`, `prisma/seed/**`, `scripts/**`, `src/features/affiliate/**`, `src/features/sales-agent/**`, handlers de login/onboarding, cron de backups/demos.
- `src/lib/prisma.ts` mantiene el export `prisma` con **mismo nombre**, ahora extendido → los 443 archivos y los tests con mock de `@/lib/prisma` siguen funcionando (el mock cubre el nuevo módulo porque re-exporta).

## 5. Modelos `child`: dos olas

**Ola 1 (sin migración):** mantener como `child` los intra-transacción puras cuyo acceso público es siempre vía padre scoped (ítems de venta/oferta, versiones de contrato). El contrato documenta: "toda query directa a un modelo child debe filtrar por la relación al padre (`where: { venta: { tenantId } }`) o el padre ya validado". Test de convención + revisión manual de los accesos directos existentes.

**Ola 2 (denormalización `tenantId`):** para modelos child con acceso directo frecuente o valor de auditoría propio — prioridad: `TransaccionMoneda`, `AlertHistory`, `ReportHistory`, `ScheduledReport`, `ScenarioSimulation`, `InyeccionCapital`, `PagoDeuda`, `SaldoSnapshot`, `ProductoCostHistory`, `AnticipoMovimiento`. Proceso por modelo (patrón del proyecto):
1. Migración aditiva `tenantId String?` + índice.
2. Script backfill dry-run (conteos: resolubles/ambiguos/huérfanos) → ejecución aprobada aparte.
3. Escritura dual (writers setean tenantId) → lectura scoped → NOT NULL cuando la evidencia lo permita; los huérfanos quedan reportados.

## 6. Modos y rollout

| Modo | Comportamiento | Uso |
|---|---|---|
| `off` | extensión no instalada | fallback de emergencia |
| `shadow` | inyecta nada, **registra** violaciones (`TENANT_VIOLATION { model, operation, hash }`) | desarrollo + staging + producción 1-2 semanas |
| `enforce` | inyecta y rechaza | producción tras gate P |

`TENANT_ISOLATION_MODE` por env. Redis/métricas no necesarios: log estructurado + contador en proceso (suficiente para el volumen del proyecto).

## 7. Interacciones con otros changes

- **`correcciones-urgentes` (antes):** corrige IDOR puntuales; con este change en `enforce`, esos bugs se vuelven imposibles. No hay conflicto de archivos salvo `src/lib/prisma.ts` (este change) que no toca aquel.
- **`permisos-granulares` (paralelo, pero no en los mismos archivos):** añade `TenantRole`/`customRoleId` — ambos modelos nuevos se clasifican (`scoped` ambos) en cuanto existan. El resolve de contexto en auth-middleware lo tocan ambos: coordinar merge (este change envuelve; aquel lee).
- **Tests existentes:** el contrato de mocks actual mockea `@/lib/prisma`; se extiende el contrato para incluir `platform-prisma` y el ALS (helpers de test `withTestTenant(tenantId)`).

## 8. RLS futuro (documentado, fuera de alcance)

Criterios para la fase RLS: migrar a Prisma driver adapters (postgres) + `tenant_id` vía `SET LOCAL` por transacción, políticas por tabla scoped, rol de app sin BYPASS. Es la segunda línea de defensa (robar el JWT o inyectar SQL no basta). Bloquea: requiere tocar pooling (PgBouncer transaction-mode) y los 443 call sites de tx — esfuerzo equivalente a este change; decidir tras medir el valor residual.

## 9. Métricas de éxito y aceptación

(las del proposal, más): cero queries a modelos scoped fuera de contexto en shadow al final del período de observación; test de drift de clasificación en CI; `prismaPlatform` permite solo la allowlist; paridad de suite en rutas críticas con enforce activo.

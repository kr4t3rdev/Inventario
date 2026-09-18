# Design: Arreglo de los 25 tests fallando preexistentes

## Estrategia por categoría

### Cat. A — Mocks de Prisma desactualizados (7 archivos)

El patrón común: el test mockea `@/lib/prisma` (o `@/lib/services/tenant-scope`)
con un subconjunto de métodos que quedó corto. Se agregan los métodos que el
código invoca hoy.

| Archivo | Cambio |
|---------|--------|
| `src/features/auth/__tests__/actions.test.ts` | Agregar `user.updateMany` al mock; cambiar 3× `prisma.user.update` → `prisma.user.updateMany` (`{ count: 1 }`); assert usa `updateMany` |
| `src/app/api/auth/refresh/__tests__/route.test.ts` | Agregar `updateMany` al mock de user; assert `prisma.user.update` → `updateMany` |
| `src/app/api/contabilidad/reconciliacion/gastos/__tests__/route.test.ts` | Alinear `createTxMock` con `pago-gastos-workflow.ts`: agregar `$queryRawUnsafe`, `cuentaBancaria.updateMany`, `cuentaPorPagar.findFirst`+`updateMany`, `gastosDE.findFirst`, `gastoCompra/compraServicio/pagosalario/ventaServicios.findFirst`; `tx.cuentaBancaria.findUnique` → `findFirst` (3 tests); mocks por test para `gastosDE.findFirst` (tenantId/isPagado) y `cuentaPorPagar.findFirst` (montoDeuda/montoPagado/saldoPendiente) |
| `src/lib/admin/__tests__/userMetrics.test.ts` | Mock inline `$queryRaw` → `$queryRawUnsafe` (el código `userMetrics.ts:177` usa `$queryRawUnsafe`) |
| `src/features/contabilidad/__tests__/actions-periodos-arqueo.test.ts` | Agregar `requireFeature: vi.fn()` al mock de `@/lib/services/tenant-scope` (el action real `actions-periodos.ts:42` usa `requireFeature(user, 'contabilidad', action)`) |
| `src/lib/api/reparaciones/ordenes.test.ts` | Agregar `cloudinaryAsset.findMany` al mock de prisma; resolver `[]` en el test que lee una orden (`ordenes.ts:113` usa `db.cloudinaryAsset.findMany`) |
| `src/features/admin/server/data.test.ts` | Mock con `salesAgentReferrals: []`, `salesAgentProfile: null`, `salesAgentBalance: null`, `_count.tenantMemberships`; assert de `findMany` pasa de `include` a `select` usando `expect.objectContaining` anidados |

**Gotcha de Vitest**: `expect.objectContaining` solo hace match parcial en el
nivel raíz; las propiedades anidadas se comparan por igualdad exacta. Para
verificar un `select` anidado, usar `expect.objectContaining` encadenados.

### Cat. B — Comportamiento vigente (4 archivos)

| Archivo | Cambio |
|---------|--------|
| `src/lib/api/productos-ubicacion.test.ts` | El test "lanza ServerActionError si stock>0 sin StockUbicacion" se reescribe → ahora verifica que se filtra el producto (la validación de inconsistencia fue removida en el refactor a `getStockPorUbicacionBatch`) |
| `src/app/api/dashboard/__tests__/stats-minimum-stock.test.ts` | 4 tests que alimentaban `producto.stock` ahora alimentan `stockUbicacion.findMany` con `{ productoId, cantidad, producto: { id, nombre, precioCosto, categoria } }`; los valores de stock del assert igualan las cantidades de StockUbicacion |
| `src/features/categorias/__tests__/actions.test.ts` | El test "omite validación CLAS..." se renombra a "crea categoría sin campos CLAS..." y el assert pasa de `{ skipEan13Validation: true }` a `{ skipEan13Validation: false }` (el gating lo hace `requireFeature`, el validator siempre recibe `false`) |
| `src/features/admin/__tests__/actions.test.ts` | Reemplazar fechas fijas `2026-07-05`/`2026-06-29` por helper `daysAgo(n)`; expectativa de revenue pasa de `1700/600` a `1500/800` según las ventanas reales |

**Lógica de `groupByLastNDays`** (`actions.ts:771`): agrupa por fecha exacta
(`YYYY-MM-DD`) en 14 buckets; `slice(0,7)` = ventana previa, `slice(-7)` =
ventana actual. Los fixtures deben caer dentro del rango para que la comparación
sea determinística.

### Cat. C — Migración a Server Actions + Next 16 (2 archivos)

| Archivo | Cambio |
|---------|--------|
| `src/app/admin/finanzas/page.test.tsx` | Se elimina el mock de `fetch`; se mockea `getAdminFinanceAction` de `@/features/admin` con el shape de `AdminFinance`; assert verifica 1 llamada + textos de UI |
| `src/app/actions/profile.test.ts` | Assert `revalidateTag('Profile')` → `revalidateTag('Profile', 'max')` (firma de Next 16, `profile.ts:36`) |

### Cat. D — Suite fantasma (1 archivo)

- **Borrar** `src/app/admin/page.test.tsx` (solo `describe` + `beforeEach`, 0 `it`).

## Verificación

1. Suite completa: `pnpm exec vitest run` → `2582 passed | 1 skipped | 2 todo` (0 failed).
   - Nota: tarda ~6 min (374s). Para iterar, correr archivo por archivo.
2. Lint sobre los archivos tocados:
   `pnpm exec eslint <9 archivos>` → sin salida (limpio).
3. Commit quirúrgico: `git add` explícito de los 14 archivos; `git status --short`
   confirma que `src/features/admin/actions.ts`, `index.ts`, `schemas.ts`,
   `src/app/admin/licencias/page.tsx`, `globals.css`,
   `openspec/changes/renovar-licencia-admin/`, `relases/`,
   `src/features/admin/__tests__/renew-licencia.test.ts` y `graphify-out/*`
   permanecen sin commitear.

# Design: Paridad de Inventario vs Odoo por Planes

## Technical Approach

Se agregan modelos Prisma de forma aditiva y un helper central de escritura.
Ningún modelo existente se elimina. Cada flujo que mueve stock (venta,
compra, transferencia, merma, producción, conteo, ajuste) inserta una
fila en `StockMoveLine` dentro de la misma transacción. Las capacidades
P1/P2 se protegen con `requireFeature` y se ocultan en UI con
`SIDEBAR_FEATURE_MAP`. FIFO y CPP existentes se conservan; el factor UdM
y FEFO solo cambian el orden/cantidad de entrada al motor actual.

## Architecture Decisions

### Decision: Kardex como tabla apendicular, no triggers

**Choice**: `StockMoveLine` escrito desde código vía
`registrarMovimiento()` en cada Server Action.
**Alternatives considered**: triggers Postgres / vista materializada.
**Rationale**: el proyecto ya centraliza reglas en Server Actions con
`withAction`; triggers ocultan lógica y rompen el patrón de auditoría
con `AuditLogService`.

### Decision: Ajuste unificado con legacy como escritores

**Choice**: `AjusteInventario` nuevo; `Merma` y `ValeSalida` siguen
existiendo y crean un ajuste equivalente.
**Alternatives considered**: eliminar `Merma`/`ValeSalida` y migrar UI.
**Rationale**: evita romper pantallas y reportes actuales; la
unificación es de datos, no big-bang de UI.

### Decision: Conteo ciego en dos pasadas

**Choice**: `ConteoInventario` + `ConteoLinea` con `CONTEO_1/CONTEO_2`
por usuarios distintos y conciliación explícita.
**Alternatives considered**: conteo directo de una pasada.
**Rationale**: es el mínimo que acepta un auditor y Odoo lo exige;
una pasada no distingue error de conteo de pérdida real.

### Decision: OC previa a factura, sin reescribir compras

**Choice**: `OrdenCompra + Recepcion`; `CompraDocumento` sigue siendo
la factura y referencia `ordenCompraId` nullable.
**Alternatives considered**: convertir `CompraDocumento` en OC.
**Rationale**: compras directas (contado simple) siguen funcionando;
la OC es opt-in por plan Profesional.

### Decision: UdM con factor por producto, conversión en el borde

**Choice**: `UnidadConversion.factorAStock` específico para cada producto;
toda persistencia de inventario se normaliza a la unidad stock antes de
actualizar stock, costo o FIFO. Las líneas de venta guardan además un snapshot
de la unidad y el factor de origen.
**Alternatives considered**: un factor global en `Unidad` o guardar cantidades
mezcladas por unidad en movimientos.
**Rationale**: una misma caja puede representar cantidades distintas por
producto; FIFO, `StockUbicacion` y costos operan en una magnitud stock común.

### Decision: Lotes y asignación física desde recepción

**Choice**: `PurchaseAllocation` admite como origen `CompraDocumentoItem` o
`RecepcionItem`, además del `loteId`. Las recepciones participan en FIFO/FEFO
antes de la factura con costo estimado de OC guardado en snapshot. Al facturar,
se reparte el monto por las recepciones FIFO y se actualizan sus asignaciones
con el costo unitario conciliado de cada línea recibida. Las líneas de compra
vinculadas a una OC no vuelven a aportar stock si ese stock ya proviene de lotes
de recepción.
**Alternatives considered**: permitir FEFO solo después de facturar o crear un
motor separado de trazabilidad de ventas.
**Rationale**: la existencia física nace en la recepción; conservar su origen
evita perder trazabilidad en ventas pre-factura y evita doble conteo al vincular
la factura. El snapshot mantiene el costo histórico y permite reconciliarlo.

### Decision: Variantes como productos hijos tipados

**Choice**: `ProductoPlantilla` (no vendible) + `Variante` =
`Producto` con `plantillaId + atributoJson + sku`.
**Alternatives considered**: JSON de atributos en `Producto`.
**Rationale**: cada variante necesita SKU, precio, costo y stock
propios; el modelo hijo reutiliza índices y `StockUbicacion` sin
cambios.

### Decision: MRP Empresarial como BOM multinivel, sin MRP completo

**Choice**: `RecetaIngrediente` acepta ingrediente = producto o receta;
planificación = explosión + comparativa contra disponible.
**Alternatives considered**: motor MRP con capacidades y rutas.
**Rationale**: cubre cocina/taller y ensamble simple, que es el segmento
real; el MRP fabril completo de Odoo Enterprise queda fuera a propósito.

## Data Flow

```
Venta/Compra/Transferencia/Merma/Producción/Conteo/Ajuste
  │  (Server Action withAction + requireTenant [+ requireFeature])
  ▼
registrarMovimiento() ──► StockMoveLine (append-only)
  │                          │
  │                          ├──► Kardex / Valorizado / Rotación
  │                          └──► PurchaseAllocation (compra o recepción,
  │                               + loteId + costo snapshot) / FIFO-FEFO
  ▼
StockUbicacion.cantidadDisponible (derivado, nunca editado directo)
```

Conteo: `teórico (StockUbicacion)` vs `contado` → `varianza` →
`AjusteInventario` → `StockMoveLine`. Compras: `OC` → `Recepcion(es)`
→ `CompraDocumento (factura)` → `StockMoveLine` de entrada.

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificar | Modelos de inventario por fases; conversiones por producto con `UnidadConversion.factorAStock`; índices y relaciones tenant-scoped |
| `src/features/planes/feature-registry.ts` | Modificar | 10 claves nuevas (ver contratos) |
| `prisma/seed/plans-seed.ts` | Modificar | Flags por plan Básico/Profesional/Empresarial |
| `src/features/inventario/movimientos.ts` | Crear | `registrarMovimiento()` + `getKardex()` |
| `src/features/inventario/actions*.ts` | Crear | kardex, ajustes, conteos, OC, lotes, variantes, reabastecimiento |
| `src/features/inventario/schemas.ts` | Crear | Schemas Zod por acción |
| `src/features/compras-productos/*` | Modificar | Crear OC/recepción antes de factura |
| `src/lib/services/fifo-allocation.ts` | Modificar | FEFO + cantidades en unidad stock |
| `src/features/ficha-costo/lib/cost-calculator.ts` | Modificar | Factor UdM en costo unitario |
| `src/app/busy/inventario/*` | Crear/Modificar | kardex, conteos, OC, lotes, variantes |
| `src/components/app-sidebar2.tsx` | Modificar | Entradas en `SIDEBAR_FEATURE_MAP` |
| `prisma/seed/demo/*-seed.ts` | Modificar | Datos demo de lotes/variantes/OC por plan |

## Interfaces / Contracts

### Feature keys nuevas

```typescript
// Núcleo (todos): kardex, ajustes-inventario, conteo-fisico
// Profesional: ordenes-compra, recepciones, reabastecimiento,
//   unidades-conversion, lotes-series, variantes, ubicaciones-avanzadas
// Empresarial: mrp-avanzado (+ hereda todo lo profesional)
```

Asignación: Básico = núcleo + lectura kardex; Profesional = núcleo +
7 claves P1; Empresarial = todo + `mrp-avanzado`.

### Prisma (resumen, tipos Int en centavos como el proyecto)

```prisma
model StockMoveLine {
  id String @id @default(cuid())
  tenantId String
  productoId String
  varianteId String?
  loteId String?
  tipoOrigen String // VENTA|COMPRA|TRANSFERENCIA|MERMA|AJUSTE|PRODUCCION|CONTEO
  origenId String
  tipoUbicacion String
  ubicacionId String
  cantidad Int // +entrada/-salida en unidad stock
  costoUnitario Int
  costoTotal Int
  createdAt DateTime @default(now())
  creadoPorId String?
  @@index([tenantId, productoId, createdAt])
  @@index([tenantId, tipoOrigen, origenId])
}

model AjusteInventario {
  id String @id @default(cuid())
  tenantId String
  productoId String
  motivo String // PERDIDA|DANO|CADUCIDAD|SOBRANTE|CONSUMO_INTERNO|ERROR_CONTEO
  cantidadTeorica Int
  cantidadContada Int
  diferencia Int
  costoUnitario Int
  costoTotal Int
  estado String @default("APLICADO") // BORRADOR|APLICADO|ANULADO
  origenMermaId String?
  origenValeId String?
  conteoId String?
  @@index([tenantId])
}

model ConteoInventario {
  id String @id @default(cuid())
  tenantId String
  ubicacionId String
  tipoUbicacion String
  estado String @default("BORRADOR") // BORRADOR|CONTEO_1|CONTEO_2|CONCILIADO|AJUSTADO
  @@index([tenantId, estado])
}
model ConteoLinea {
  id String @id @default(cuid())
  conteoId String
  productoId String
  teorico Int
  conteo1 Int?
  conteo2 Int?
  contadoFinal Int?
  usuario1Id String?
  usuario2Id String?
  @@index([conteoId])
}

model OrdenCompra {
  id String @id @default(cuid())
  tenantId String
  proveedorId String
  estado String @default("BORRADOR") // BORRADOR|CONFIRMADA|PARCIAL|RECIBIDA|CANCELADA
  total Int @default(0)
  @@index([tenantId, estado])
}
model OrdenCompraItem {
  id String @id @default(cuid())
  ordenId String
  productoId String
  cantidadPedida Int
  cantidadRecibida Int @default(0)
  precioUnitario Int
  @@index([ordenId])
}
model Recepcion {
  id String @id @default(cuid())
  ordenId String
  tenantId String
  fecha DateTime @default(now())
  @@index([ordenId])
}
model RecepcionItem {
  id String @id @default(cuid())
  recepcionId String
  productoId String
  cantidad Int
  @@index([recepcionId])
}

model Lote {
  id String @id @default(cuid())
  tenantId String
  productoId String
  codigo String
  fechaVencimiento DateTime?
  cantidadInicial Int
  cantidadDisponible Int
  compraItemId String?
  @@unique([tenantId, productoId, codigo])
  @@index([tenantId, fechaVencimiento])
}

model ProductoPlantilla {
  id String @id @default(cuid())
  tenantId String
  nombre String
  atributos Json // [{nombre:"talla",valores:["S","M","L"]}]
  @@index([tenantId])
}
// Variante = Producto existente + plantillaId + atributoJson + sku.
// Sin modelo nuevo: columnas en Producto.

model ReglaReabastecimiento {
  id String @id @default(cuid())
  tenantId String
  productoId String
  ubicacionId String
  min Int
  max Int
  @@unique([productoId, ubicacionId])
}

model Ubicacion {
  id String @id @default(cuid())
  tenantId String
  almacenId String
  parentId String?
  nombre String
  tipo String // ZONA|PASILLO|ESTANTE
  @@index([tenantId, almacenId])
}
```

### Server Actions (patrón `withAction`)

```typescript
'use server';
export const getKardexAction = withAction(async (f: FiltrosKardex, user) => {
  const tenantId = requireTenant(user); // núcleo: sin requireFeature
});
export const createAjusteAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user); // núcleo
});
export const createOrdenCompraAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user);
  await requireFeature(user, 'ordenes-compra', 'crear órdenes de compra');
});
```

Validación cliente/servidor con Zod + toast según guía del proyecto;
`revalidatePath('/busy/inventario/...')` tras cada mutación.

## Testing Strategy

| Capa | Qué | Enfoque |
|------|-----|---------|
| Unit | `registrarMovimiento`, FEFO, factor UdM, varianza | Vitest, prisma mockeado |
| Unit | Gating `requireFeature` por clave nueva | Extender `tenant-scope.test.ts` |
| Integration | Backfill y kardex cuadrado | `__integration__` con `DATABASE_URL_TEST` |
| Component | Tablas kardex/conteo/OC con Testing Library | Estados loading/error |
| E2E | OC parcial → recepción → factura | Playwright, plan Profesional |

Aislamiento: todo unitario mockea `@/lib/prisma` (contrato
`test-isolation-contract.test.ts`, 0 offenders). Solo
`src/**/__integration__/` toca BD real.

## Migration / Rollout

1. Migración Prisma aditiva + `factorAStock` default 1.
2. Deploy P0 con doble escritura activada; backfill idempotente por
   `origenId`; conteo inicial absorbe diferencias residuales.
3. Activar flags P1/P2 por plan en seed + panel `/admin/planes`.
4. Rollout por tenant: Básico ve kardex/ajuste/conteo; Profesional
   suma OC/lotes/variantes; Empresarial suma MRP/putaway/forecast.

## Open Questions

* [ ] ¿Valorizado oficial exige asiento contable o basta costo total?
  (Default: basta costo; asiento queda fuera de alcance.)
* [ ] ¿Alerta de vencimiento a cuántos días? (Default: 30, configurable
  por tenant en fase P1.)
* [ ] ¿Variantes comparten código EAN-13 base o SKU independiente?
  (Default: SKU independiente, EAN-13 solo Empresarial si ya usa el
  modo EAN-13.)

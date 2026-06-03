# SDD Proposal: Rentabilidad por Compra (con trazabilidad FIFO)

## Executive Summary

Nuevo sistema de trazabilidad de costos que permite saber, para cada venta, **exactamente** de qué compra salieron las unidades vendidas (FIFO real). Esto habilita un reporte de rentabilidad por compra que muestra ganancia real, margen, días para vender y stock remanente por lote comprado.

## Problem

Hoy el sistema descuenta stock genérico: cuando se vende un producto, no queda registro de **qué compra** específica proveyó esas unidades. Esto impide:

- Saber la rentabilidad real de una compra
- Calcular el costo de venta exacto (FIFO) para contabilidad
- Saber cuánto stock queda de cada lote comprado
- Analizar días reales para vender por lote

## Solution: PurchaseAllocation Model

### Nuevo modelo Prisma

```prisma
/// Asignación FIFO: vincula unidades vendidas con su compra de origen
model PurchaseAllocation {
  id                      String   @id @default(cuid())
  tenantId                String
  compraDocumentoItemId   String
  ventaItemId             String
  cantidad                Int
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  compraDocumentoItem CompraDocumentoItem @relation(fields: [compraDocumentoItemId], references: [compraDocumentoItemId])
  ventaItem           VentaItem           @relation(fields: [ventaItemId], references: [id])
  tenant              Tenant              @relation(fields: [tenantId], references: [tenantId])

  @@index([compraDocumentoItemId])
  @@index([ventaItemId])
  @@index([tenantId])
  @@map("purchase_allocations")
}
```

### Relaciones nuevas

- `CompraDocumentoItem → PurchaseAllocation[]` (has many)
- `VentaItem → PurchaseAllocation[]` (has many)

### Cómo funciona el FIFO

```
Compras del Producto X (ordenadas por fecha ASC):
  C1: 100 unids a $10 (febrero)
  C2: 100 unids a $15 (marzo)

Venta V1: 30 unids (abril) → Asignación FIFO:
  → 30 de C1 (C1 queda con 70 disponibles)

Venta V2: 80 unids (mayo) → Asignación FIFO:
  → 70 de C1 (C1 se agota) + 10 de C2 (C2 queda con 90 disponibles)

Venta V3: 40 unids (junio) → Asignación FIFO:
  → 40 de C2 (C2 queda con 50 disponibles)
```

Cada asignación queda registrada en `PurchaseAllocation`.

## Architecture

### 1. Nuevo servicio FIFO

```
src/lib/services/fifo-allocation.ts
```

```typescript
// Core: asigna unidades vendidas a compras usando FIFO
export async function allocateFifoForVentaItem(
  tx: PrismaTx,
  params: {
    tenantId: string;
    ventaItemId: string;
    productoId: string;
    cantidad: number;
  }
): Promise<void> {
  // 1. Obtener CompraDocumentoItem del producto, ordenadas por fecha ASC
  // 2. Para cada una, calcular disponible (cantidad - SUM(allocations))
  // 3. Asignar cantidad vendida FIFO hasta agotar
  // 4. Crear PurchaseAllocation records
}

// Helper: obtener stock disponible de un item de compra
export async function getAvailableStock(
  tx: PrismaTx,
  compraDocumentoItemId: string
): Promise<number>;

// Batch: procesar todos los items de una venta
export async function allocateFifoForSale(
  tx: PrismaTx,
  tenantId: string,
  ventaId: string
): Promise<void>;
```

### 2. Modificación a createVentaAction

Dentro de la transacción actual, después de crear los VentaItems y antes o después del descuento de stock, se agrega:

```typescript
// Después del descuento de stock (en el mismo transaction)
const ventaItems = await tx.ventaItem.findMany({
  where: { ventaId: venta.ventaId },
});

for (const item of ventaItems) {
  await allocateFifoForVentaItem(tx, {
    tenantId,
    ventaItemId: item.id,
    productoId: item.productoId,
    cantidad: item.cantidad,
  });
}
```

### 3. Migración de datos existentes (one-time script)

```
scripts/migrate-fifo-allocations.ts  (o prisma/seed.ts)
```

Procesa todos los `VentaItem` existentes (ordenados por `createdAt ASC`) y corre el mismo algoritmo FIFO, insertando registros en `PurchaseAllocation`.

### 4. Server Action del reporte

```typescript
// src/features/reportes-financieros/actions-rentabilidad-compra.ts

export const getRentabilidadCompraAction = withAction(
  async (compraId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);

    // 1. Fetch CompraDocumento + items + producto
    const compra = await prisma.compraDocumento.findFirst({
      where: { compraDocumentoId: compraId, tenantId },
      include: { proveedor: true, items: { include: { producto: { select: PRODUCTO_BASIC_SELECT } } } },
    });

    // 2. Para cada item, obtener PurchaseAllocations + VentaItems asociados
    const productos = await Promise.all(
      compra.items.map(async (item) => {
        const allocations = await prisma.purchaseAllocation.findMany({
          where: { compraDocumentoItemId: item.compraDocumentoItemId },
          include: {
            ventaItem: { select: { total: true, createdAt: true, ventaId: true } },
          },
        });

        const unidadesVendidas = allocations.reduce((s, a) => s + a.cantidad, 0);
        const ingresos = allocations.reduce((s, a) => s + (a.ventaItem?.total ?? 0), 0);
        const costoVendido = unidadesVendidas * item.precioUnitario;
        const ganancia = ingresos - costoVendido;
        const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;

        // Días para vender real (desde la compra hasta cada venta)
        const diasReales = allocations
          .filter(a => a.ventaItem?.createdAt)
          .map(a => {
            const diff = (new Date(a.ventaItem!.createdAt).getTime() - new Date(compra.fechaCompra).getTime())
              / (1000 * 60 * 60 * 24);
            return diff;
          });

        return {
          productoId: item.productoId,
          productoNombre: item.producto?.nombre ?? 'Producto eliminado',
          cantidadComprada: item.cantidad,
          costoUnitario: item.precioUnitario,
          costTotal: item.totalLinea,
          unidadesVendidas,
          ingresos,
          costoVendido,
          ganancia,
          margen: Math.round(margen * 100) / 100,
          stockRestante: Math.max(0, item.cantidad - unidadesVendidas),
          diasPromedioVenta: diasReales.length > 0
            ? Math.round((diasReales.reduce((s, d) => s + d, 0) / diasReales.length) * 100) / 100
            : null,
          allocations: allocations.map(a => ({
            ventaItemId: a.ventaItemId,
            cantidad: a.cantidad,
            total: a.ventaItem?.total ?? 0,
            fechaVenta: a.ventaItem?.createdAt,
          })),
        };
      })
    );

    return { compra, productos, resumen: calcularResumen(productos) };
  }
);
```

## Impact Analysis

### Schema changes (Prisma migration)

| Change | Type |
|--------|------|
| `model PurchaseAllocation` | **NUEVO** |
| `CompraDocumentoItem.allocations` | Nueva relación |
| `VentaItem.allocations` | Nueva relación |

### New files

| File | Propósito |
|------|-----------|
| `src/lib/services/fifo-allocation.ts` | Algoritmo FIFO + helpers |
| `scripts/migrate-fifo-allocations.ts` | Migración one-time de datos existentes |
| `src/features/reportes-financieros/actions-rentabilidad-compra.ts` | Server Action del reporte |
| `src/features/reportes-financieros/components/reporte-rentabilidad-compra.tsx` | Componente UI |
| `src/features/reportes-financieros/components/purchase-selector.tsx` | Selector de compras |
| `src/app/busy/reportes/rentabilidad-compra/page.tsx` | Página server |
| `src/app/busy/reportes/rentabilidad-compra/layout.tsx` | Layout |

### Modified files

| File | Cambio |
|------|--------|
| `prisma/schema.prisma` | Agregar modelo + relaciones |
| `src/features/ventas/actions.ts` | Llamar `allocateFifoForSale` dentro de la transacción |
| `src/app/busy/reportes/page.tsx` | Agregar enlace al nuevo reporte |

### Risks

| Risk | Mitigation |
|------|------------|
| Performance: la migración de datos históricos puede ser lenta | Procesar en batches con paginación |
| Error en FIFO durante venta → venta falla | Corre dentro de la transacción, rollback automático |
| VentaItem sin allocations (previo a migración) | El reporte muestra mensaje "Datos no migrados aún" |
| Productos sin compras registradas (inventario inicial) | El feature solo aplica a productos con compras |

## UI/UX Design

### Purchase Selector
Searchable combobox que lista compras (proveedor, fecha, factura, total) con paginación.

### Report View
```
┌─────────────────────────────────────────────────────────┐
│ ← Reportes  │  Rentabilidad por Compra                  │
│                                                        │
│ ┌─ Purchase Selector ────────────────────────────────┐ │
│ │ [Buscar compra por proveedor, factura...]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌── KPI Cards ────────────────────────────────────────┐ │
│ │ Total   │ Total     │ Ganancia │ ROI   │ Stock     │ │
│ │ Comprado│ Vendido   │ Neta     │  42%  │ Remanente │ │
│ │ $15,000 │ $22,500   │ $7,500   │       │   35%     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌── Charts ───────────────────────────────────────────┐ │
│ │ ┌─────────────────┐  ┌─────────────────┐           │ │
│ │ │ Ingresos vs     │  │ Ganancia por    │           │ │
│ │ │ Costo por prod  │  │ producto        │           │ │
│ │ └─────────────────┘  └─────────────────┘           │ │
│ │ ┌────────────────────────────────────┐             │ │
│ │ │ Días promedio para vender          │             │ │
│ │ └────────────────────────────────────┘             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌── Detail Table ─────────────────────────────────────┐ │
│ │ Producto │ Comp  │ Costo │ Vend  │ Ing  │ Gan │ Mgn │ │
│ │ Prod A   │ 100   │ $10   │ 80    │ 1200 │ 400 │50%  │ │
│ │ Prod B   │ 50    │ $20   │ 50    │ 1500 │ 500 │33%  │ │
│ │ [PDF] [CSV]                                        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Estados

| Estado | UI |
|--------|----|
| **Initial (sin compra)** | Empty state: "Seleccione una compra para analizar su rentabilidad" |
| **Loading selector** | Skeleton |
| **Loading análisis** | Skeleton en cards + charts + tabla |
| **Error** | Toast + error state inline |
| **Sin ventas aún** | Producto no vendido: mostrar "Sin ventas" con advertencia de pérdida latente |
| **Producto eliminado** | "Producto eliminado" como fallback |

### Charts (Recharts)

1. **Ingresos vs Costo** — Barras agrupadas por producto (verde vs naranja)
2. **Ganancia** — Barras con colores condicionales (verde ≥ 0, rojo < 0)
3. **Días para vender** — Barras horizontales con tooltip mostrando cantidad de ventas
4. **Distribución de ingresos** — Pie/Donut chart

## Acceptance Criteria

1. ✅ Ejecutar `pnpm exec prisma migrate dev` → nuevo modelo creado
2. ✅ `allocateFifoForSale` se invoca dentro de cada venta nueva
3. ✅ Script `migrate-fifo-allocations.ts` procesa ventas existentes sin errores
4. ✅ `/busy/reportes/rentabilidad-compra` muestra el selector de compras
5. ✅ Seleccionar una compra → muestra KPIs, charts y tabla con datos reales
6. ✅ Cada producto muestra unidades compradas, costo unitario real, vendidas, ingresos, ganancia, margen, stock restante, días promedio de venta
7. ✅ Los datos de `PurchaseAllocation` son correctos (FIFO verificado)
8. ✅ Exportación CSV de la tabla
9. ✅ Animaciones con framer-motion
10. ✅ Responsive

## Rollback Plan

1. Revertir migration: `prisma migrate reset` o migration down manual
2. Revertir cambios en `createVentaAction`
3. Eliminar archivos nuevos
4. Eliminar script de migración

## Next

→ **Spec**: Given/When/Then para el algoritmo FIFO, el reporte, y la migración
→ **Design**: Wireframe detallado de UI (si aprobás el proposal)

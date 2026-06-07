# SDD Tasks: Rentabilidad por Compra

## Dependency Graph

```
1. Schema + Migration
    ├── 2. FIFO Service
    │     ├── 3. Integrar createVentaAction
    │     ├── 4. Migration script (datos históricos)
    │     └── 5. Server Actions reporte
    │           ├── 6. Componentes UI
    │           │     └── 7. Página + Layout
    │           │           └── 8. Enlace navegación
    │           └── 9. Tests (stub paralelo)
```

---

## Task 1: Schema + Migration Prisma

**Archivos:** `prisma/schema.prisma`

**Dependencias:** Ninguna

**Criterio:** `pnpm exec prisma migrate dev --name add_purchase_allocations` exitoso

**Pasos:**
1. Agregar modelo `PurchaseAllocation` con campos: id, tenantId, compraDocumentoItemId, ventaItemId, cantidad, createdAt, updatedAt
2. Agregar relaciones, índices y `@@map("purchase_allocations")`
3. Agregar `allocations PurchaseAllocation[]` a `model VentaItem`
4. Agregar `allocations PurchaseAllocation[]` a `model CompraDocumentoItem`
5. Ejecutar `pnpm exec prisma format`
6. Ejecutar `pnpm exec prisma migrate dev --name add_purchase_allocations`
7. Regenerar types: `pnpm exec prisma generate`

---

## Task 2: FIFO Allocation Service

**Archivo nuevo:** `src/lib/services/fifo-allocation.ts`

**Dependencias:** Task 1

**Criterio:** Servicio exporta 3 funciones, tests unitarios pasan

**Funciones:**

```typescript
/**
 * @description Asigna unidades vendidas a compras usando FIFO.
 * Busca CompraDocumentoItem del producto ordenadas ASC,
 * calcula disponible (cantidad - SUM(allocations)), y asigna
 * hasta agotar la cantidad vendida.
 *
 * @throws Si no hay suficiente stock (comprado - asignado) en todas las compras
 */
export async function allocateFifoForVentaItem(
  tx: PrismaTx,
  params: {
    tenantId: string;
    ventaItemId: string;
    productoId: string;
    cantidad: number;
  }
): Promise<void>

/**
 * @description Retorna el stock disponible de un item de compra.
 * disponible = item.cantidad - SUM(PurchaseAllocation.cantidad)
 */
export async function getAvailableStock(
  tx: PrismaTx,
  compraDocumentoItemId: string
): Promise<number>

/**
 * @description Procesa todos los VentaItem de una venta.
 * Itera items, ejecuta allocateFifoForVentaItem por cada uno.
 */
export async function allocateFifoForSale(
  tx: PrismaTx,
  tenantId: string,
  ventaId: string
): Promise<void>
```

**Edge cases:**
- Si producto no tiene CompraDocumentoItem → no crea allocations (no error)
- Si cantidad vendida excede stock disponible en compras → error (debe capturarse en caller)
- Si ya existen allocations para ese ventaItem → skip (idempotente)

---

## Task 3: Integrar FIFO en createVentaAction

**Archivo:** `src/features/ventas/actions.ts`

**Dependencias:** Task 2

**Criterio:** Cada venta nueva genera PurchaseAllocation records

**Cambio:**
Dentro de `$transaction` en `createVentaAction`, después del bloque de descuento de stock (después de `upsertStockUbicacion`), agregar:

```typescript
// 3c. Asignación FIFO de compras
const ventaItems = await tx.ventaItem.findMany({
  where: { ventaId: venta.ventaId },
  select: { id: true, productoId: true, cantidad: true },
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

**Riesgo:** Si `allocateFifoForVentaItem` falla (stock insuficiente en compras), la transacción hace rollback total. Esto es correcto pero hay que verificar que el mensaje de error sea claro.

**Consideración:** Puede haber productos sin compras asociadas (ej: productos compuestos, o stock inicial). `allocateFifoForVentaItem` debe manejar ese caso sin error.

---

## Task 4: Migration Script (datos históricos)

**Archivo nuevo:** `scripts/migrate-fifo-allocations.ts`

**Dependencias:** Task 1, Task 2 (reusa FIFO service)

**Criterio:** Procesa todos los VentaItem existentes y crea PurchaseAllocation. Idempotente.

**Estrategia:**
```
BATCH_SIZE = 500
Orden: VentaItem.createdAt ASC (más antiguos primero)
Cursor-based pagination
Procesa dentro de transacciones individuales por batch
Loggea progreso a console cada batch
```

**Ejecución:** `pnpm exec tsx scripts/migrate-fifo-allocations.ts`

**Flags de seguridad:**
- `--dry-run`: muestra cuántos VentaItem procesaría sin escribir
- `--force`: permite ejecución aunque ya existan allocations (limpia y re-procesa)
- Sin flag: procesa solo VentaItem sin allocations existentes

**Output esperado:**
```
[MIGRATE] Procesando VentaItem históricos...
[MIGRATE] Batch 1/47: 500 items → 435 allocations creadas
[MIGRATE] Batch 2/47: 500 items → 512 allocations creadas
...
[MIGRATE] Completado. 23,450 VentaItem procesados, 28,100 allocations creadas
[MIGRATE] 1,200 VentaItem sin compras (productos sin CompraDocumentoItem)
```

---

## Task 5: Server Actions del Reporte

**Archivo nuevo:** `src/features/reportes-financieros/actions-rentabilidad-compra.ts`

**Dependencias:** Task 1

**Criterio:** Endpoints funcionan, retornan tipos correctos

**Acciones:**

```typescript
// ─── searchComprasAction ──────────────────────────────
// Busca CompraDocumento por proveedor, factura, o producto
// Retorna lista paginada para el selector

// ─── getRentabilidadCompraAction ──────────────────────
// Para una compra específica:
// 1. Fetch CompraDocumento + items + producto
// 2. Para cada item: fetch PurchaseAllocation + VentaItem
// 3. Calcular: vendidas, ingresos, costo, ganancia, margen, días, velocidad
// 4. Calcular resumen general (ROI, totales)

// ─── Types ────────────────────────────────────────────
export interface ProductoAnalisis {
  productoId: string;
  productoNombre: string;
  cantidadComprada: number;
  costoUnitario: number;
  costTotal: number;
  unidadesVendidas: number;
  ingresos: number;
  costoVendido: number;
  ganancia: number;
  margen: number;
  stockRestante: number;
  stockRestantePct: number;
  diasPromedioVenta: number | null;
  velocidadVenta: number;
  tieneAllocations: boolean;
}

export interface ResumenAnalisis {
  totalComprado: number;
  totalVendido: number;
  gananciaTotal: number;
  costoTotalVendido: number;
  stockRestante: number;
  cantidadComprada: number;
  roi: number;
  margenPromedio: number;
}
```

**Tip:** Reusar `PRODUCTO_BASIC_SELECT` existente si está definido.

---

## Task 6: Componentes UI

**Archivos nuevos en** `src/features/reportes-financieros/components/`:

| Componente | Archivo | Propósito |
|-----------|---------|-----------|
| **PurchaseSearchBar** | `purchase-search-bar.tsx` | Input + combobox con búsqueda async de compras |
| **SummaryCards** | `summary-cards-rentabilidad.tsx` | Grid de KPIs (total comprado, vendido, ganancia, ROI, stock) |
| **ChartsRentabilidad** | `charts-rentabilidad.tsx` | 3 gráficos: Ingresos vs Costo, Ganancia, Días |
| **RentabilidadDetailTable** | `rentabilidad-detail-table.tsx` | Tabla con productos + export PDF/CSV |
| **ReporteRentabilidadCompra** | `reporte-rentabilidad-compra.tsx` | Orquestador: estados, layout, animaciones |

**Dependencias:** Task 5 (data fetching)

**Criterio:** Componentes renderizan correctamente en todos los estados

**Patrones a seguir (del codebase existente):**

```typescript
// Animaciones (framer-motion)
import { StaggerContainer, StaggerItem, AnimatedCard } from '@/components/ui/animations';
import { useReducedMotion } from 'framer-motion';

// Estilo consistente
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

// Grid responsivo
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

// Export CSV/PDF
import { exportToPdf, exportToCsv } from '@/lib/export-utils';
import { FileIcon as FilePdf, FileText } from 'lucide-react';
```

### PurchaseSearchBar spec

```
Props: onSelect(compraId: string)
State:
  - query: string (búsqueda del usuario)
  - results: CompraResult[]
  - isOpen: boolean (dropdown visible)
  - isLoading: boolean
  - selected: CompraResult | null

Behavior:
  - Debounce 300ms en input
  - Llama a searchComprasAction con query
  - Muestra hasta 10 resultados en dropdown
  - Cada resultado: proveedor, factura, fecha, total
  - Al seleccionar: call onSelect + muestra badge con compra activa
  - Tecla ESC cierra dropdown
  - Click fuera cierra dropdown
```

### SummaryCards spec

```
Props: resumen: ResumenAnalisis
Cards: 5 tarjetas con icono + valor + label
  - Costo Total (DollarSign, primary)
  - Total Vendido (TrendingUp, chart-2)
  - Ganancia Neta (Landmark, chart-3)
  - ROI % (Percent, accent)
  - Stock Remanente (Package, muted)
Animación: StaggerContainer + StaggerItem
Formato: moneda con toLocaleString('es-DO')
```

### ChartsRentabilidad spec

```
Props: productos: ProductoAnalisis[]
Charts:
  1. Ingresos vs Costo - BarChart agrupado (2 series)
     - Verde (#10b981) = ingresos
     - Naranja (#f59e0b) = costo
  2. Ganancia por producto - BarChart simple
     - Verde si ganancia >= 0, rojo si < 0
  3. Días para vender - BarChart horizontal
     - Azul (#3b82f6), muestra null como "Sin datos"
Layout: 2 columnas en lg, 1 en mobile
Animación: fadeInUp por chart
Empty: Si ningún producto tiene ventas, mostrar "Sin datos suficientes"
```

### RentabilidadDetailTable spec

```
Props: productos: ProductoAnalisis[], compra: CompraInfo
Columnas: Producto, CantComprada, CostoU, CantVendida, Ingresos, Ganancia, Margen, StockRest, DíasProm
Highlight: ganancia negativa en rojo
Export: CSV usa exportToCsv, PDF usa exportToPdf
Paginación: si > 10 productos
```

### ReporteRentabilidadCompra spec (orquestador)

```
States:
  - initial: EmptyState + SearchBar
  - loading: SearchBar + Skeletons
  - data: SearchBar + SummaryCards + Charts + Table
  - error: SearchBar + ErrorState + Toast

Layout:
  - PageTransition wrapper
  - Background gradient + blur (consistente con otros reportes)
  - Header con Badge + título + descripción
```

---

## Task 7: Página Server + Layout

**Archivos nuevos:**

| Archivo | Propósito |
|---------|-----------|
| `src/app/busy/reportes/rentabilidad-compra/page.tsx` | Server component con metadata y wrapper |
| `src/app/busy/reportes/rentabilidad-compra/layout.tsx` | Layout |

**Dependencias:** Task 6

**Criterio:** Página accesible en `/busy/reportes/rentabilidad-compra`

```typescript
// page.tsx
export const metadata: Metadata = {
  title: 'Rentabilidad por Compra',
  description: 'Analice la rentabilidad de sus compras con asignación FIFO',
};

export default function RentabilidadCompraPage() {
  return <ReporteRentabilidadCompra />;
}
```

---

## Task 8: Enlace en Reportes

**Archivo:** `src/app/busy/reportes/page.tsx`

**Dependencias:** Task 7

**Criterio:** Enlace visible y funcional en `/busy/reportes`

**Cambio:** Agregar una tarjeta o link en la página principal de reportes que navegue a `rentabilidad-compra`. Puede ser un botón tipo card con ícono de `Landmark` o `TrendingUp`.

---

## Task 9: Tests

**Archivos:**

| Archivo | Propósito |
|---------|-----------|
| `src/lib/services/__tests__/fifo-allocation.test.ts` | Tests unitarios del servicio FIFO |
| `scripts/__tests__/migrate-fifo-allocations.test.ts` | Tests del script de migración |
| `src/features/reportes-financieros/__tests__/actions-rentabilidad-compra.test.ts` | Tests de Server Actions |

**Dependencias:** Task 2, Task 4, Task 5 (puede correr en paralelo con Task 6-8)

**Criterio:** `pnpm run test:run` pasa sin errores

**Escenarios FIFO:**
- Asignación básica (una compra, una venta)
- Asignación cruzada (dos compras, una venta)
- Stock insuficiente → error
- Producto sin compras → sin allocations
- Idempotencia (llamar dos veces con mismos datos)
- Venta de 0 unidades → sin allocations
- Lote completamente asignado → no disponible para nuevas ventas

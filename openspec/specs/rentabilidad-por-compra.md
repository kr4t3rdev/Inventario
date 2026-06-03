# SDD Spec: Rentabilidad por Compra (Purchase ROI)

> Based on proposal `openspec/proposals/rentabilidad-por-compra.md`

---

## 1. Spec: PurchaseAllocation Model + FIFO Service

### 1.1 Prisma Model

```prisma
/// Asignación FIFO: vincula unidades vendidas con su compra de origen.
/// Cada registro indica que `cantidad` unidades del VentaItem
/// se asignaron al CompraDocumentoItem según la política FIFO.
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

**Relaciones a agregar en modelos existentes:**

En `model VentaItem`:
```prisma
allocations PurchaseAllocation[]
```

En `model CompraDocumentoItem`:
```prisma
allocations PurchaseAllocation[]
```

**Constraints:**
- `cantidad` MUST ser positiva (>= 1)
- `compraDocumentoItemId` + `ventaItemId` SHOULD permitir múltiples registros (una venta puede tomar de varias compras, y una compra puede abastecer varias ventas)
- `tenantId` MUST coincidir entre todas las tablas relacionadas

### 1.2 Given/When/Then: FIFO Allocation Algorithm

#### GIVEN productos con múltiples compras a diferentes costos

| Escenario | Given | When | Then |
|-----------|-------|------|------|
| **FIFO básico** | Producto X: C1(100u, $10, fecha: ene) y C2(100u, $15, fecha: mar) | Se venden 30u de X en abril | Se crea 1 PurchaseAllocation: C1→venta, cantidad=30 |
| **FIFO cruza compras** | Producto X: C1(100u, $10, ene), C2(100u, $15, mar) | Se venden 150u de X en abril | 100u de C1 + 50u de C2. Dos registros: (C1→venta,100), (C2→venta,50) |
| **FIFO stock insuficiente** | Producto X: C1(50u, $10, ene) | Se venden 60u de X en abril | Error STOCK_INSUFICIENTE. No se crea ninguna allocation. Transacción rollback. |
| **FIFO sin compras** | Producto X: sin CompraDocumentoItem | Se vende 1u de X | No se crean allocations. El producto se marca como "sin asignación FIFO" para el reporte. |
| **FIFO lote agotado** | Producto X: C1(100u, $10, ene), ya vendidas 100u | Se vende 1u de X en mayo | Se asigna a la siguiente compra disponible (C2). Si no hay, error. |
| **Venta de productos sin compras** | Producto con `esCompuesto=true` o creado manualmente sin compras | Se vende | No se crean allocations. El producto queda fuera del reporte de rentabilidad por compra. |

### 1.3 Given/When/Then: FIFO Service API

```typescript
// allocateFifoForVentaItem
Given: VentaItem recién creado con {productoId, cantidad}
 When: allocateFifoForVentaItem(tx, {tenantId, ventaItemId, productoId, cantidad})
 Then: Busca CompraDocumentoItem WHERE productoId ORDER BY createdAt ASC
       Para cada uno, calcula disponible = cantidad - SUM(allocations previas)
       Asigna cantidad vendida FIFO hasta agotar
       Crea PurchaseAllocation records en batch
       Si no hay suficiente stock en ninguna compra → error

// getAvailableStock
Given: CompraDocumentoItem {compraDocumentoItemId, cantidad}
 When: getAvailableStock(compraDocumentoItemId)
 Then: Retorna cantidad - SUM(PurchaseAllocation.cantidad WHERE compraDocumentoItemId)

// allocateFifoForSale
Given: Venta recién creada con items
 When: allocateFifoForSale(tx, tenantId, ventaId)
 Then: Busca VentaItem WHERE ventaId
       Por cada item, ejecuta allocateFifoForVentaItem
       Si algún item falla → toda la transacción rollback
```

### 1.4 Given/When/Then: Integración con createVentaAction

| Escenario | Given | When | Then |
|-----------|-------|------|------|
| **Venta exitosa con FIFO** | Stock suficiente + compras disponibles | createVentaAction con items | Venta creada + VentaItems creados + Stock descontado + PurchaseAllocations creados |
| **Venta exitosa sin compras** | Stock suficiente + producto sin compras | createVentaAction | Venta creada sin allocations. No error. |
| **Venta falla por stock** | Stock insuficiente | createVentaAction | Error STOCK_INSUFICIENTE. Rollback total: no Venta, no VentaItem, no PurchaseAllocation. |
| **Venta falla en FIFO** | Stock suficiente pero compras insuficientes | createVentaAction | Error. Rollback total. |

---

## 2. Spec: Migration Script

### 2.1 Given/When/Then: Migración de ventas existentes

```
scripts/migrate-fifo-allocations.ts
```

| Escenario | Given | When | Then |
|-----------|-------|------|------|
| **Migración completa** | Base con ventas históricas + ComprasDocumento | Ejecutar migración | PurchaseAllocation creados para cada VentaItem con FIFO correcto |
| **Migración idempotente** | PurchaseAllocations ya existen | Ejecutar migración de nuevo | No duplica registros. Usa upsert o delete previo. |
| **Producto sin compras** | VentaItem de producto sin CompraDocumentoItem | Procesar ese item | No se crea PurchaseAllocation. Se loggea advertencia. |
| **Rendimiento** | 10,000+ VentaItems existentes | Ejecutar migración | Procesa en batches de 500. Loggea progreso cada batch. |
| **Rollback** | Migración falla a mitad | Error | Los batches completados persisten. Se recomienda reset y reintentar. |

### 2.2 Estrategia de migración

```typescript
// Procesar VentaItems en orden cronológico (más antiguos primero)
const BATCH_SIZE = 500;
let cursor: string | null = null;

do {
  const batch = await prisma.ventaItem.findMany({
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  for (const item of batch) {
    await allocateFifoForVentaItem(tx, {
      tenantId: /* infer from venta */,
      ventaItemId: item.id,
      productoId: item.productoId,
      cantidad: item.cantidad,
    });
  }

  cursor = batch.length === BATCH_SIZE ? batch[batch.length - 1].id : null;
} while (cursor);
```

---

## 3. Spec: Server Action del Reporte

### 3.1 API

```typescript
// src/features/reportes-financieros/actions-rentabilidad-compra.ts

'use server';

export const getRentabilidadCompraAction = withAction(
  async (compraId: string, user: AuthenticatedUser) => {
    // Returns: { compra, productos, resumen }
  }
);

export const searchComprasAction = withAction(
  async (params: {
    search?: string;
    page?: number;
    limit?: number;
  }, user: AuthenticatedUser) => {
    // Returns: { compras: [...], pagination: {...} }
  }
);
```

### 3.2 Return Types

```typescript
interface CompraAnalisis {
  compra: {
    compraDocumentoId: string;
    numeroFactura: string;
    fechaCompra: string;
    total: number;
    proveedor?: { vendorId: string; nombre: string } | null;
    estado: string;
    formaPago: string;
  };
  productos: ProductoAnalisis[];
  resumen: ResumenAnalisis;
}

interface ProductoAnalisis {
  productoId: string;
  productoNombre: string;
  cantidadComprada: number;
  costoUnitario: number;
  costTotal: number;
  unidadesVendidas: number;
  ingresos: number;
  costoVendido: number;
  ganancia: number;
  margen: number;       // porcentaje
  stockRestante: number;
  stockRestantePct: number;  // porcentaje
  diasPromedioVenta: number | null;
  velocidadVenta: number;    // unids/día
  tieneAllocations: boolean; // false si no hay datos FIFO
}

interface ResumenAnalisis {
  totalComprado: number;
  totalVendido: number;
  gananciaTotal: number;
  costoTotalVendido: number;
  stockRestante: number;
  cantidadComprada: number;
  roi: number;           // porcentaje
  margenPromedio: number; // porcentaje ponderado
}
```

### 3.3 Given/When/Then: Reporte Server Action

| Escenario | Given | When | Then |
|-----------|-------|------|------|
| **Compra con ventas** | Compra con 3 productos, todos vendidos parcialmente | getRentabilidadCompraAction(id) | Retorna 3 productos con métricas calculadas, resumen con totales |
| **Compra sin ventas** | Compra donde ningún producto se ha vendido aún | getRentabilidadCompraAction(id) | Retorna productos con unidadesVendidas=0, ganancia=0, margen=0, stockRestante=cantidadComprada |
| **Compra inexistente** | ID de compra que no existe | getRentabilidadCompraAction(invalidId) | Error NOT_FOUND |
| **Compra de otro tenant** | ID de compra de otro tenant | getRentabilidadCompraAction(id) | Error NOT_FOUND (requireTenant filtra) |
| **Compra sin allocations** | Compra existente, pero VentaItems sin migration aún | getRentabilidadCompraAction(id) | Productos con tieneAllocations=false. Se muestra banner "Ejecute la migración FIFO" |
| **Search sin query** | searchComprasAction({}) | — | Retorna primeras 20 compras |
| **Search con texto** | searchComprasAction({search: "ProveedorX"}) | — | Retorna compras donde proveedor.nombre, numeroFactura, o item.producto.nombre contengan "ProveedorX" |

---

## 4. Spec: Report Component

### 4.1 Component Tree

```
<ReporteRentabilidadCompra>                  ← Client Component "use client"
  ├── PurchaseSearchBar                      ← Input + combobox dropdown
  │     └── CompraResultItem                 ← List item en dropdown
  ├── PurchaseSummaryBar (condicional)       ← Info de compra seleccionada
  │     └── Badge: proveedor, factura, fecha, estado
  ├── SummaryCardsGrid (condicional)         ← 4-6 KPI cards
  │     └── SummaryCard (repeated)
  ├── ChartsSection (condicional)
  │     ├── IngresosVsCostoChart             ← BarChart (Recharts)
  │     ├── GananciaChart                    ← BarChart (Recharts)
  │     └── DiasParaVenderChart              ← BarChart horizontal (Recharts)
  ├── DetailTable (condicional)
  │     ├── ExportToolbar (PDF, CSV)
  │     └── ProductoRow (repeated)
  ├── EmptyState (sin compra)
  ├── LoadingState (skeleton)
  └── ErrorState (inline error)
```

### 4.2 States

#### Initial (sin compra seleccionada)

```typescript
if (!compraSeleccionada) {
  // Mostrar:
  // - SearchBar en foco
  // - EmptyState: ícono + "Seleccione una compra para analizar su rentabilidad"
  // - Sin KPIs, sin charts, sin tabla
}
```

#### Loading (después de seleccionar compra)

```typescript
if (isLoading) {
  // Mostrar:
  // - SearchBar (con compra seleccionada visible)
  // - Skeleton: 4 cards en grid
  // - Skeleton: chart area (300px)
  // - Skeleton: tabla rows (4)
}
```

#### Data (respuesta recibida)

```typescript
if (data) {
  // Mostrar todo el contenido con animaciones stagger
  // Si ningún producto tiene allocations → banner "Sin datos FIFO"
}
```

#### Error

```typescript
if (error) {
  // Mostrar:
  // - Toast notification con mensaje de error
  // - ErrorState inline en lugar del contenido
  // - SearchBar visible para reintentar
}
```

#### Edge cases

| Estado | Comportamiento |
|--------|---------------|
| **Producto sin unidades vendidas** | Mostrar "0" en vendido, "—" en días/velocidad. No incluir en charts de días. |
| **Producto con ganancia negativa** | Mostrar en rojo. Barra de ganancia en rojo. Margen negativo destacado. |
| **Stock restante = 0** | Badge "Agotado". Progress bar al 100%. |
| **Todos los productos agotados** | Mensaje "Lote completamente vendido". |


### 4.3 UI/UX Guidelines (de UI UX Pro Max + patrones existentes)

#### Estilo visual (consistente con reportes existentes)

```typescript
// Patrón de tarjetas glassmorphism
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

// Tarjetas con borde lateral
const cardBorderLeft = (color: string) => cn(
  surfaceCardClass,
  `border-l-4 border-l-${color}`,
);
```

#### Animaciones (framer-motion)

```typescript
// Stagger para contenedores
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  },
};
```

#### Charts (Recharts)

| Chart | Tipo | Data | Colores |
|-------|------|------|---------|
| Ingresos vs Costo | `BarChart` agrupado | 2 barras por producto | verde `#10b981` / naranja `#f59e0b` |
| Ganancia por producto | `BarChart` simple | 1 barra con color condicional | verde (ganancia>0) / rojo (ganancia<0) |
| Días para vender | `BarChart` horizontal (layout="vertical") | 1 barra por producto | azul `#3b82f6` |
| Distribución ingresos | `PieChart` | Participación de cada producto | paleta COLORS existente |

#### Responsive

```typescript
// Grid de KPIs
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

// Charts side by side en desktop, stacked en mobile
<div className="grid gap-6 lg:grid-cols-2">

// Tabla scroll horizontal en mobile
<div className="overflow-x-auto rounded-md border">
```

#### Accesibilidad

- `aria-label` en icon buttons
- `prefers-reduced-motion` respetado (usando `useReducedMotion()`)
- Focus ring visible en searchable combobox
- Skeleton loaders para content jump prevention

---

## 5. Design: Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ ← Reportes  │  Rentabilidad por Compra                         │
│ ᴿᵉᵖᵒʳᵗᵉ ᵒᵖᵉʳᵃᵗⁱᵛᵒ                                                          │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🔍 [Buscar compra por proveedor, factura o nº factura...] │ │
│ │  ┌──────────────────────────────────────────────────────┐ │ │
│ │  │ Proveedor XYZ · FV-000123 · 15/01/2026 · $15,000    │ │ │
│ │  │ Proveedor ABC · FV-000122 · 12/01/2026 · $12,500    │ │ │
│ │  │ ...                                                  │ │ │
│ │  └──────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌──── Compra: FV-000123 — Proveedor XYZ — 15/01/2026 ──────┐  │
│ │ ✅ Pagada  ·  Contado  ·  5 productos                      │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│ │Costo     │ │ Vendido  │ │ Ganancia │ │ ROI      │ │Stock │ │
│ │$15,000   │ │ $22,500  │ │ $7,500   │ │ 50%      │ │ 35%  │ │
│ │Total     │ │ Total    │ │ Neta     │ │          │ │Rest. │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘ │
│                                                                │
│ ┌─── Ingresos vs Costo ───┐ ┌─── Ganancia ────────────────┐  │
│ │  ████ Ingresos          │ │  ████ Ganancia               │  │
│ │  ████ Costo             │ │  ████ (rojo si negativa)    │  │
│ │  ┌──┬──┬──┬──┐         │ │  ┌──┬──┬──┬──┐               │  │
│ │  │██│  │██│  │         │ │  │██│  │██│  │               │  │
│ │  │██│██│██│  │         │ │  │██│  │██│  │               │  │
│ │  │██│██│██│██│         │ │  │██│██│██│██│               │  │
│ │  └──┴──┴──┴──┘         │ │  └──┴──┴──┴──┘               │  │
│ │  A  B  C  D            │ │  A   B  C  D                 │  │
│ └─────────────────────────┘ └──────────────────────────────┘  │
│ ┌─── Días para vender ─────────────────────────────────────┐  │
│ │  Producto A ████████████░░░░░░░░░░░░░░░░  45 días        │  │
│ │  Producto B ████████████████████████░░░░  85 días        │  │
│ │  Producto C ██████░░░░░░░░░░░░░░░░░░░░░░  20 días        │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ┌── Detalle ─────────────────────────────────── [PDF] [CSV] ┐ │
│ │ Producto │Comp│ Cost │ Vend│ Ingresos│Ganancia│Mgn│Días│  │ │
│ │──────────┼────┼──────┼─────┼─────────┼────────┼───┼────│  │ │
│ │ Prod A   │ 100│ $10  │ 80  │ $1,200  │ $400   │50%│ 45 │  │ │
│ │ Prod B   │ 50 │ $20  │ 50  │ $1,500  │ $500   │33%│ 85 │  │ │
│ │ Prod C   │ 200│ $5   │ 0   │ $0      │ -$1,000│—  │ —  │  │ │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Tasks (preliminary)

1. **Schema**: Agregar modelo PurchaseAllocation a schema.prisma + relaciones
   → `prisma/schema.prisma`
   → `pnpm exec prisma migrate dev --name add_purchase_allocations`

2. **FIFO Service**: Crear `src/lib/services/fifo-allocation.ts`
   → `allocateFifoForVentaItem()`
   → `getAvailableStock()`
   → `allocateFifoForSale()`

3. **Modificar createVentaAction**: Integrar FIFO en transacción
   → `src/features/ventas/actions.ts`

4. **Migration script**: Crear `scripts/migrate-fifo-allocations.ts`
   → Procesar VentaItems existentes en batches

5. **Server Actions reporte**: Crear actions con search y análisis
   → `src/features/reportes-financieros/actions-rentabilidad-compra.ts`

6. **Componentes UI**: 
   → PurchaseSearchBar + PurchaseSummary
   → SummaryCards
   → Charts (3)
   → DetailTable + Export
   → ReporteRentabilidadCompra (orquestador)

7. **Página server**:
   → `src/app/busy/reportes/rentabilidad-compra/page.tsx`
   → `src/app/busy/reportes/rentabilidad-compra/layout.tsx`

8. **Enlace navegación**: Actualizar página de reportes

9. **Tests**: unit tests para FIFO service + migración

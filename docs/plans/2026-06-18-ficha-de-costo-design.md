# Design: Módulo Ficha de Costo

**Change**: `add-cost-sheet-module`
**Fecha**: 2026-06-18
**Status**: Design complete
**Basado en**: Explore → Propose → Spec

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Component                         │
│              ficha-costo-page.tsx / ficha-costo-view.tsx     │
└──────────────────────┬──────────────────────────────────────┘
                       │ Server Action call
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server Actions (actions.ts)                 │
│  getFichaCostoAction │ getHistorialCostosAction              │
│  getComposicionCostoAction                                   │
│  (withAction wrapper → requireTenant → requireFeature)       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Pure calculation
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               Calculation Layer (lib/cost-calculator.ts)      │
│  calcularCPP() │ calcularCostoMateriales()                    │
│  normalizarMoneda() │ calcularMargen()                        │
│  PURE functions — no server imports, testable in isolation   │
└───────────┬──────────┬──────────┬───────────────────────────┘
            │          │          │
     ┌──────▼──┐ ┌────▼───┐ ┌───▼──────────┐
     │ Prisma  │ │ Prisma  │ │ Contabilidad │
     │ Compras │ │ Recetas │ │ ExchangeRate  │
     └─────────┘ └─────────┘ └──────────────┘
```

**Flujo de datos**:
1. Usuario navega a `/busy/productos/[id]/ficha-costo`
2. Page component llama a `getFichaCostoAction(productoId)`
3. Action resuelve tenant, verifica feature access
4. Consulta Prisma: Producto, CompraDocumentoItem, Receta, RecetaIngrediente
5. Pasa datos a `cost-calculator.ts` para cálculos puros (CPP, desglose, margen)
6. Si hay moneda USD, consulta ExchangeRate para normalizar
7. Retorna `FichaCostoData` al cliente
8. Componente UI renderiza según estado (loading / data / empty / error)

---

## 2. Estructura de Archivos

```
src/features/ficha-costo/
├── actions.ts                       # Server Actions (withAction wrapper)
├── lib/
│   └── cost-calculator.ts           # Lógica pura de cálculo (testeable sin servidor)
├── components/
│   ├── ficha-costo-page.tsx         # Page wrapper (app router) — Server Component
│   ├── ficha-costo-view.tsx         # Container principal con tabs
│   ├── ficha-costo-header.tsx       # Encabezado: nombre, código del producto
│   ├── resumen-costo.tsx            # Tarjeta resumen: CPP, precioCosto, precioVenta, margen
│   ├── composicion-costo.tsx        # Desglose para productos compuestos
│   ├── historial-costos.tsx         # Timeline paginado de compras
│   ├── indicador-margen.tsx         # Badge verde/amarillo/rojo con texto
│   └── ficha-costo-pdf.tsx          # Generación y descarga de PDF
└── __tests__/
    ├── cost-calculator.test.ts      # Tests unitarios de cálculo
    ├── actions.test.ts              # Tests de Server Actions
    └── ficha-costo-view.test.tsx     # Tests de componente
```

### Responsabilidad de cada archivo

| Archivo | Responsabilidad |
|---------|----------------|
| `actions.ts` | Server Actions: `getFichaCostoAction`, `getHistorialCostosAction`, `getComposicionCostoAction` |
| `lib/cost-calculator.ts` | Funciones puras de cálculo. Sin imports de servidor, sin Prisma. Recibe datos ya consultados. |
| `components/ficha-costo-page.tsx` | Server Component que obtiene datos vía Server Action y renderiza la vista |
| `components/ficha-costo-view.tsx` | Client Component con tabs: Resumen, Historial, Composición (solo compuestos) |
| `components/ficha-costo-header.tsx` | Muestra nombre, código interno, tipo (simple/compuesto) |
| `components/resumen-costo.tsx` | CPP, precio de costo registrado, precio de venta, margen absoluto y % |
| `components/composicion-costo.tsx` | Inputs de MO e indirectos, tabla de materiales, gráfico de torta de composición |
| `components/historial-costos.tsx` | Tabla paginada con filtros de fecha y proveedor |
| `components/indicador-margen.tsx` | Badge: verde (≥10%), amarillo (<10%), rojo (<0%) con texto |
| `components/ficha-costo-pdf.tsx` | Botón + lógica de generación de PDF |

---

## 3. Server Actions

### `getFichaCostoAction`

```typescript
export const getFichaCostoAction = withAction(
  async (productoId: string, user: AuthenticatedUser): Promise<FichaCostoData> => {
    const tenantId = requireTenant(user)
    requireFeature(user, 'produccion', 'gestionar producción') // o feature específica

    // 1. Verificar producto (404 si no existe o no pertenece al tenant)
    // 2. Si es simple: consultar CompraDocumentoItem + GastoCompra (12 meses)
    // 3. Si es compuesto: consultar Receta + RecetaIngrediente
    // 4. Pasar a cost-calculator.ts para cálculos
    // 5. Si hay USD en compras: consultar ExchangeRate
    // 6. Armar FichaCostoData y retornar
  }
)
```

**Retorno**:
```typescript
interface FichaCostoData {
  producto: {
    id: string
    nombre: string
    codigoInterno: string | null
    tipo: 'SIMPLE' | 'COMPUESTO'
    precioCosto: number
    precioVenta: number
  }
  costoCalculado: {
    valor: number
    metodo: 'CPP' | 'COMPOSICION'
    moneda: string
    componentes?: {
      materiales: number
      manoObra: number | null
      indirectos: number | null
      porcentajes: {
        materiales: number
        manoObra: number | null
        indirectos: number | null
      }
    }
  }
  margen: {
    valor: number        // absoluto
    porcentaje: number
    estado: 'SALUDABLE' | 'BAJO' | 'PERDIDA'
  }
  ultimaActualizacion: string  // ISO date
  advertencias: string[]       // ej. "Compras sin gasto asociado", "Tasa de cambio aproximada"
}
```

### `getHistorialCostosAction`

```typescript
export const getHistorialCostosAction = withAction(
  async (
    params: {
      productoId: string
      page?: number
      limit?: number
      fechaDesde?: string
      fechaHasta?: string
      proveedorId?: string
    },
    user: AuthenticatedUser
  ): Promise<HistorialCostosData> => { ... }
)
```

**Retorno**:
```typescript
interface HistorialCostosData {
  items: Array<{
    compraDocumentoItemId: string
    fecha: string
    proveedor: string
    cantidad: number
    precioUnitario: number
    total: number
    moneda: string
    precioUnitarioNormalizado: number
    gastoAsociado: number | null
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### `getComposicionCostoAction`

```typescript
export const getComposicionCostoAction = withAction(
  async (
    params: {
      productoId: string
      manoObra?: number
      indirectos?: number
    },
    user: AuthenticatedUser
  ): Promise<ComposicionCostoData> => { ... }
)
```

**Retorno**:
```typescript
interface ComposicionCostoData {
  materiales: Array<{
    ingredienteId: string
    nombre: string
    cantidad: number
    unidad: string
    costoUnitario: number
    costoTotal: number
    sinCosto: boolean
  }>
  manoObra: number | null
  indirectos: number | null
  total: number
  porcentajes: {
    materiales: number
    manoObra: number | null
    indirectos: number | null
  }
}
```

---

## 4. Lógica de Cálculo

### `lib/cost-calculator.ts`

Todas las funciones son PURAS — reciben datos ya consultados y retornan resultados.

```typescript
// ─── Tipos ──────────────────────────────────────────────

export interface CompraInput {
  cantidad: number
  precioUnitario: number       // ya normalizado a moneda base
  gastoProporcional: number    // gasto * (cant / totalCompras)
  monedaOriginal: string
}

export interface IngredienteInput {
  productoId: string
  cantidad: number
  desperdicio: number
  cppIngrediente: number | null  // null = sin costo calculado
}

// ─── Funciones ──────────────────────────────────────────

/**
 * Calcula CPP (Costo Promedio Ponderado).
 * CPP = Σ(cantidad × precioUnitario + gastoProporcional) / Σ(cantidad)
 */
export function calcularCPP(compras: CompraInput[]): number
```

**Algoritmo CPP**:
```
CPP = Σ(cantidad_i × precioUnitario_i + gastoProporcional_i)
      ──────────────────────────────────────────────
                    Σ(cantidad_i)
```

- `gastoProporcional_i = gastoTotal × (cantidad_i / Σ(cantidad))`
- Si no hay compras → retorna `NaN` (la UI muestra "N/A")
- Si hay 0 cantidades → evitar división por cero

```typescript
/**
 * Calcula costo de materiales para producto compuesto.
 * CostoMateriales = Σ(cantidad_ing × (1 + desperdicio/100) × CPP_ingrediente)
 */
export function calcularCostoMateriales(ingredientes: IngredienteInput[]): {
  total: number
  items: Array<{ productoId: string; costo: number; sinCosto: boolean }>
  ingredientesSinCosto: number
}
```

```typescript
/**
 * Normaliza un monto a la moneda base del tenant.
 * Si la moneda ya es la base, retorna el mismo valor.
 * Si no hay tasa, retorna null (para mostrar advertencia).
 *
 * La inyección del lookup permite que esta función sea pura:
 * el caller (Server Action) provee la función de consulta.
 */
export function normalizarMoneda(
  monto: number,
  monedaOrigen: string,
  monedaBase: string,
  obtenerTasa: (fecha: Date) => { tasa: number; fechaTasa: Date } | null
): { valor: number | null; tasaUsada?: { tasa: number; fecha: string }; nota?: string }
```

```typescript
/**
 * Calcula margen absoluto, porcentual y estado.
 * Margen% = (precioVenta - costo) / precioVenta * 100
 * estado: SALUDABLE (>=10%) | BAJO (>=0% y <10%) | PERDIDA (<0%)
 * Si precioVenta == 0 → margen null, estado 'SIN_PRECIO'
 */
export function calcularMargen(
  costo: number,
  precioVenta: number
): { absoluto: number | null; porcentaje: number | null; estado: 'SALUDABLE' | 'BAJO' | 'PERDIDA' | 'SIN_PRECIO' }
```

### Estrategia de inyección de dependencias

`cost-calculator.ts` es puro, no tiene acceso a Prisma ni a ExchangeRate. Para `normalizarMoneda` se usa **dependency injection**:

```typescript
// En actions.ts:
import { normalizarMoneda } from './lib/cost-calculator'
import { getExchangeRateForDate } from '@/features/contabilidad/actions-exchange'

const taux = (fecha: Date) => getExchangeRateForDate(fecha, monedaOrigen, monedaBase)
const resultado = normalizarMoneda(monto, 'USD', 'CUP', taux)
```

Esto permite:
- Testear `cost-calculator.ts` con mocks simples (pasar función mock)
- Reutilizar la lógica de cálculo sin depender del servidor
- Separar concerns: cálculo puro vs acceso a datos

---

## 5. Componentes UI

### Jerarquía

```
ficha-costo-page.tsx (Server Component)
└── ficha-costo-view.tsx (Client Component)
    ├── ficha-costo-header.tsx
    ├── Tabs
    │   ├── Tab: Resumen
    │   │   └── resumen-costo.tsx
    │   │       └── indicador-margen.tsx
    │   ├── Tab: Historial (siempre visible)
    │   │   └── historial-costos.tsx
    │   └── Tab: Composición (solo si es compuesto)
    │       └── composicion-costo.tsx
    └── ficha-costo-pdf.tsx (botón flotante)
```

### Estados de cada componente

| Componente | Loading | Data | Empty | Error |
|------------|---------|------|-------|-------|
| ficha-costo-view | Skeleton tabs | Tabs con datos | Mensaje "sin datos" | Error alert + retry |
| resumen-costo | Skeleton cards | Tarjetas con indicadores | "N/A" en cada campo | Badge error |
| composicion-costo | Spinner | Tabla + inputs + gráfico | "Sin receta" + link | Error alert |
| historial-costos | Skeleton rows | Tabla paginada | "Sin compras registradas" | Error alert |
| indicador-margen | — | Badge color+texto | Badge gris "N/A" | — |

### Props interfaces clave

```typescript
// resumen-costo.tsx
interface ResumenCostoProps {
  costoCalculado: number | null
  precioCosto: number
  precioVenta: number
  margen: { valor: number | null; porcentaje: number | null; estado: string }
  metodo: 'CPP' | 'COMPOSICION' | null
  advertencias: string[]
  moneda: string
}

// composicion-costo.tsx
interface ComposicionCostoProps {
  materiales: MaterialItem[]
  manoObra: number | null
  indirectos: number | null
  onManoObraChange: (valor: number) => void
  onIndirectosChange: (valor: number) => void
  recetaId: string | null
  tieneReceta: boolean
  loading: boolean
}

// indicador-margen.tsx
interface IndicadorMargenProps {
  porcentaje: number | null
  estado: 'SALUDABLE' | 'BAJO' | 'PERDIDA' | 'SIN_PRECIO'
}
```

---

## 6. Integración

### Ruta

Nuevo archivo: `src/app/busy/productos/[id]/ficha-costo/page.tsx`

```typescript
// Server Component
import { getFichaCostoAction } from '@/features/ficha-costo/actions'
import { FichaCostoView } from '@/features/ficha-costo/components/ficha-costo-view'

export default async function FichaCostoPage({ params }: { params: { id: string } }) {
  const result = await getFichaCostoAction(params.id)
  if (!result.success) {
    if (result.error?.code === 'NOT_FOUND') notFound()
    throw new Error(result.error?.message)
  }
  return <FichaCostoView data={result.data} />
}
```

### Botón en vista de producto

Modificar `src/app/busy/productos/[id]/page.tsx` (o el componente de detalle de producto) para agregar:

```tsx
<Link href={`/busy/productos/${producto.id}/ficha-costo`}>
  <Button variant="outline">
    <FileTextIcon className="mr-2 h-4 w-4" />
    Ver ficha de costo
  </Button>
</Link>
```

### Generación de PDF

Usar la API route existente del proyecto o una nueva ruta:
- `src/app/api/ficha-costo/[id]/pdf/route.ts`
- Generar PDF server-side con una lib como `@react-pdf/renderer` o `pdf-lib`
- O usar html2canvas + jsPDF client-side (más simple para MVP)

Opción recomendada para MVP: **Client-side PDF** usando `html2canvas` + `jsPDF` (ya suelen estar disponibles en Next.js projects con shadcn/ui). En fase 2 migrar a server-side.

---

## 7. Testing Strategy

### Unit tests (`cost-calculator.test.ts`)

| Test | Input | Expected |
|------|-------|----------|
| calcularCPP con compras normales | 3 compras en CUP | CPP correcto |
| calcularCPP con gastos | compras + gasto 3000 | CPP incluye gastos |
| calcularCPP sin compras | [] | NaN |
| calcularCPP con cantidades cero | [{cant: 0, pu: 100}] | NaN (división por cero) |
| calcularCostoMateriales normal | 3 ingredientes con CPP | suma ponderada |
| calcularCostoMateriales con desperdicio | ingrediente cant:10, desperdicio:10 | 11 unidades efectivas |
| calcularCostoMateriales sin CPP | ingrediente con CPP null | excluido, sinCosto=true |
| calcularMargen saludable | costo:500, pv:800 | {37.5%, SALUDABLE} |
| calcularMargen bajo | costo:750, pv:800 | {6.25%, BAJO} |
| calcularMargen pérdida | costo:900, pv:800 | {-12.5%, PERDIDA} |
| calcularMargen precio cero | costo:500, pv:0 | {null, SIN_PRECIO} |
| normalizarMoneda misma moneda | 1000 CUP → CUP | 1000 |
| normalizarMoneda USD → CUP | 10 USD, tasa:120 | 1200 |
| normalizarMoneda sin tasa | 10 USD, sin tasa | null |

### Server Action tests (`actions.test.ts`)

- Mock Prisma queries
- Test tenant isolation
- Test producto no encontrado → 404
- Test feature sin permiso → error

### Component tests (`ficha-costo-view.test.tsx`)

- Render con datos mock → ver CPP, margen, indicador
- Render sin compras → empty state
- Render error → error alert
- Toggle tabs → contenido cambia
- Input MO/indirectos → recálculo

---

## 8. Performance

### Prisma query optimization

```typescript
// CPP query — solo campos necesarios, usa índices existentes
const compras = await prisma.compraDocumentoItem.findMany({
  where: {
    productoId,
    tenantId,
    compraDocumento: {
      fechaCompra: { gte: doceMesesAtras }
    }
  },
  select: {
    cantidad: true,
    precioUnitario: true,
    totalLinea: true,
    moneda: true,           // inferred from factura
    compraDocumento: {
      select: {
        fechaCompra: true,
        proveedor: { select: { nombre: true } }
      }
    }
  },
  orderBy: { compraDocumento: { fechaCompra: 'desc' } }
})
```

### Prevención de N+1

Para productos compuestos con muchos ingredientes, cada ingrediente necesita su propio CPP. Esto puede causar N consultas a Prisma.

**Solución**: Batch lookup de CPPs.

```typescript
// En actions.ts — obtener CPPs en una sola consulta
async function obtenerMultiplesCPP(
  productoIds: string[],
  tenantId: string,
  meses: number
): Promise<Map<string, number>> {
  // Batch query: para todos los ingredientes a la vez
  const compras = await prisma.compraDocumentoItem.groupBy({
    by: ['productoId'],
    where: {
      productoId: { in: productoIds },
      tenantId,
      compraDocumento: { fechaCompra: { gte: startDate } }
    },
    _sum: { cantidad: true, totalLinea: true },
  })
  // Calcular CPP por producto y armar Map
}
```

### Caching

Para el MVP, no implementar caching Redis. Opciones futuras:
- Cache en memoria del servidor para CPP de ingredientes durante una solicitud (request-scoped cache)
- Considerar materializar CPP en columnas si el rendimiento es un problema

### Límites

- Historial: paginación de 20 items
- Ventana CPP: últimos 12 meses
- Productos sin compras en 12 meses → CPP = 0 (mostrar advertencia)
- Timeout de query: 5s (Prisma default)

---

## 9. Architecture Decisions Register

| ID | Decisión | Alternativas | Rationale |
|----|----------|-------------|-----------|
| AD-001 | Vista calculada on-demand | Entidad persistente | Zero migration risk, evita sync de datos duplicados |
| AD-002 | cost-calculator.ts puro | Lógica embebida en actions | Testeable sin servidor, reutilizable |
| AD-003 | Dependency injection para ExchangeRate | Import directo | Mantiene pureza de cost-calculator.ts |
| AD-004 | 12 meses de ventana CPP | Toda la historia | Balance entre precisión y performance |
| AD-005 | Client-side PDF en MVP | Server-side PDF | Más simple de implementar, migrar después |
| AD-006 | Batch CPP lookup para ingredientes | N+1 queries | Evita N consultas a DB para productos compuestos |

---

## 10. Open Questions

- [ ] ¿Usar una feature flag o permisos específicos para ficha de costo? (Spec sugiere reutilizar feature 'produccion')
- [ ] ¿El cálculo de CPP debe incluir compras con deletedAt no null?
- [ ] ¿La moneda base del tenant está disponible en el modelo Tenant? (verificar en schema)
- [ ] ¿Usar html2canvas+jsPDF o @react-pdf/renderer para PDF? Decidir según dependencias existentes

---

## 11. Resumen de cambios

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/features/ficha-costo/actions.ts` | Crear | 3 Server Actions |
| `src/features/ficha-costo/lib/cost-calculator.ts` | Crear | Funciones de cálculo puras |
| `src/features/ficha-costo/components/ficha-costo-page.tsx` | Crear | Server Component page |
| `src/features/ficha-costo/components/ficha-costo-view.tsx` | Crear | Client Component con tabs |
| `src/features/ficha-costo/components/ficha-costo-header.tsx` | Crear | Encabezado |
| `src/features/ficha-costo/components/resumen-costo.tsx` | Crear | Resumen con indicadores |
| `src/features/ficha-costo/components/composicion-costo.tsx` | Crear | Desglose + inputs |
| `src/features/ficha-costo/components/historial-costos.tsx` | Crear | Timeline paginado |
| `src/features/ficha-costo/components/indicador-margen.tsx` | Crear | Badge de margen |
| `src/features/ficha-costo/components/ficha-costo-pdf.tsx` | Crear | Export PDF |
| `src/features/ficha-costo/__tests__/cost-calculator.test.ts` | Crear | Tests unitarios |
| `src/features/ficha-costo/__tests__/actions.test.ts` | Crear | Tests integración |
| `src/features/ficha-costo/__tests__/ficha-costo-view.test.tsx` | Crear | Tests componente |
| `src/app/busy/productos/[id]/ficha-costo/page.tsx` | Crear | Ruta de la ficha |
| `src/app/busy/productos/[id]/page.tsx` | Modificar | Agregar botón "Ver ficha de costo" |
| `prisma/schema.prisma` | **Ninguno** | Sin cambios |

# Design: ficha-costo-reconciliacion-historial

## Overview

Enriquecer el historial de compras de un producto para que el usuario pueda
auditar el cálculo del CPP línea por línea. Cada línea mostrará si fue
incluida en la ventana de 12 meses, cuánto gasto proporcional se le imputó,
y si tuvo tasa de cambio aproximada. Adicionalmente, un resumen agrupado
por proveedor mostrará el peso de cada uno en el cálculo.

Cero cambios de schema, cero nuevas dependencias. Feature 100% aditiva.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ historial-costos.tsx (cliente)                              │
│   - Lee HistorialReconciliadoData                           │
│   - Muestra badge por línea, tabla de proveedores, banner   │
└────────────────────┬────────────────────────────────────────┘
                     │ Server Action call
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ actions-reconciliacion.ts (servidor)                        │
│   - getHistorialReconciliadoAction (nueva)                  │
│   - 1 query paginada + 1 query completa (max 1000 items)    │
│   - Calcula tasaAproximada por línea (normalizarMoneda)     │
│   - Llama al reconciliador puro                             │
└────────────────────┬────────────────────────────────────────┘
                     │ Función pura
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ lib/reconciliador-historial.ts (puro, sin Prisma)           │
│   - reconciliarHistorial(items, options) → ReconciliadorR…  │
│   - Marca enVentanaCPP, calcula gastoProporcional, agrupa  │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Tipos nuevos en `types.ts`

```typescript
export interface HistorialReconciliadoItem extends HistorialCostosItem {
  enVentanaCPP: boolean
  gastoProporcional: number
  tasaAproximada?: boolean
}

export interface HistorialProveedorResumen {
  proveedorId: string
  proveedorNombre: string
  cantidadTotal: number
  montoTotal: number
  participacionPorcentaje: number
  cantidadItems: number
}

export type EstadoCPP = 'CALCULADO' | 'CON_ADVERTENCIAS' | 'SIN_DATOS'

export interface HistorialReconciliadoData {
  items: HistorialReconciliadoItem[]
  pagination: HistorialCostosPagination
  proveedores: HistorialProveedorResumen[]
  estadoCPP: EstadoCPP
  advertencias: string[]
}

export interface GetHistorialReconciliadoInput extends GetHistorialCostosInput {}
```

### Tipos del calculador puro

```typescript
export interface ItemCompraMaterializado {
  compraDocumentoItemId: string
  productoId: string
  fecha: Date
  proveedorId: string
  proveedorNombre: string
  cantidad: number
  precioUnitario: number
  totalLinea: number
  compraDocumentoId: string
  tasaAproximada?: boolean
}

export interface ReconciliadorOptions {
  ventanaMeses: number
  fechaReferencia?: Date
  gastosPorDocumento?: Map<string, number>
}

export interface ItemReconciliado extends ItemCompraMaterializado {
  enVentanaCPP: boolean
  gastoProporcional: number
  tasaAproximada: boolean
}

export interface ResumenProveedor {
  proveedorId: string
  proveedorNombre: string
  cantidadTotal: number
  montoTotal: number
  participacionPorcentaje: number
  cantidadItems: number
}

export interface ReconciliadorResult {
  items: ItemReconciliado[]
  proveedores: ResumenProveedor[]
  advertencias: string[]
}

export function reconciliarHistorial(
  items: ItemCompraMaterializado[],
  options: ReconciliadorOptions,
): ReconciliadorResult
```

## API Contract

### Server Action: `getHistorialReconciliadoAction`

**Input** (extiende `GetHistorialCostosInput`):
```typescript
{
  productoId: string       // requerido
  page?: number            // default 1
  limit?: number           // default 20, max 100
  fechaDesde?: string      // ISO date
  fechaHasta?: string      // ISO date
  proveedorId?: string
}
```

**Output**:
```typescript
{
  success: true,
  data: HistorialReconciliadoData
}
// o error: NOT_FOUND, AUTH_REQUIRED
```

**Reglas**:
- Multi-tenant: `requireTenant(user)`
- Auth feature: `requireFeature(user, 'productos', 'ver el historial de costos')`
- Producto cross-tenant → `NOT_FOUND` opaco
- Sin auth → `AUTH_REQUIRED`
- Paginación: `page`, `limit`, `total`, `totalPages` (igual que historial actual)

**Performance**:
- Query 1: items paginados con todos los joins (igual que `getHistorialCostosAction`)
- Query 2: TODOS los items en ventana CPP (max 1000) para reconciliación
- Ambas queries corren en paralelo con `Promise.all`
- Indexes existentes: `compraDocumentoItem.productoId`, `compraDocumento.fechaCompra`

## Pure Calculator

### Algoritmo `reconciliarHistorial(items, options)`

```
1. fechaRef = options.fechaReferencia ?? new Date()
2. Para cada item:
     diasDiff = (fechaRef - item.fecha) en días
     enVentana = diasDiff <= options.ventanaMeses * 30.5
     enVentanaCPP = enVentana

3. Para cada item, calcular gastoProporcional:
     - Si options.gastosPorDocumento tiene item.compraDocumentoId:
       * Buscar todos los items con misma compraDocumentoId
       * cantTotalDoc = suma(items.cantidad)
       * Si cantTotalDoc > 0:
           item.gastoProporcional = (item.cantidad / cantTotalDoc) * gastosPorDocumento[docId]
         Sino: 0
     - Sino: 0

4. Filtrar items con enVentanaCPP = true
5. Agrupar por proveedorId:
     - cantidadTotal = suma(cantidad)
     - montoTotal = suma(cantidad * precioUnitario + gastoProporcional)
     - cantidadItems = count
     - proveedorNombre = primer item.proveedorNombre del grupo
6. Calcular participacionPorcentaje por proveedor:
     - Si montoTotalGeneral > 0:
         participacion = (montoProveedor / montoTotalGeneral) * 100
       Sino: 0
7. Devolver { items: items reconciliados, proveedores, advertencias: [] }
```

**Edge cases**:
- Lista vacía → `{ items: [], proveedores: [] }`
- Todos fuera de ventana → `proveedores: []`
- Un solo proveedor → `participacionPorcentaje = 100`
- Items sin `gastosPorDocumento` → `gastoProporcional = 0` para todos
- `cantTotalDoc = 0` → `gastoProporcional = 0` (no dividir por cero)

**Pureza**:
- No accede a Prisma, filesystem, ni red
- No muta los inputs
- Determinista para mismas entradas y misma `fechaReferencia`
- Sin `Date.now()` implícito: usa `options.fechaReferencia ?? new Date()`

## UI Changes (`historial-costos.tsx`)

### Cambios funcionales

1. **Cambiar Server Action**: `getHistorialCostosAction` → `getHistorialReconciliadoAction`
2. **Cambiar tipo de estado**: `HistorialCostosData` → `HistorialReconciliadoData`
3. **Agregar banner de estado CPP** arriba de los filtros:
   - `CALCULADO` → verde "CPP calculado con N compras en ventana"
   - `CON_ADVERTENCIAS` → amarillo "CPP calculado con advertencias: [lista]"
   - `SIN_DATOS` → gris "No hay compras en los últimos 12 meses"
4. **Agregar columna "En CPP"** en la tabla con badge verde/gris
5. **Agregar columna "Gasto prop."** (solo si hay gastos) con el monto
6. **Agregar sección "Resumen por proveedor"** al final con tabla:
   - Proveedor | Cantidad | Monto | Items | Participación
7. **Caption aclaratorio** en la sección de proveedores: "Calculado sobre todas las compras en ventana (no solo la página actual)"

### Cambios de accesibilidad

- El banner de estado usa `role="status"` para `CALCULADO`/`CON_ADVERTENCIAS`
- `role="alert"` para `SIN_DATOS` (caso excepcional)
- Tabla de proveedores con `aria-label="Resumen de compras por proveedor"`

## Test Strategy (TDD strict)

### Calculador puro: `__tests__/reconciliador-historial.test.ts`

10+ tests:

1. **Ventana inclusiva**: item a 364 días → enVentanaCPP = true
2. **Ventana exclusiva por 1 día**: item a 367 días → enVentanaCPP = false
3. **Item dentro de ventana**: item a 30 días → enVentanaCPP = true
4. **fechaReferencia por defecto**: si no se pasa, usa new Date()
5. **Prorrateo igualitario**: 3 items mismo doc, gasto 300 → cada uno 100
6. **Prorrateo desigual**: items cant 10/20, gasto 300 → 100/200
7. **Items sin gasto**: sin gastosPorDocumento → todos en 0
8. **Invariante numérico**: suma(gastoProporcional) por documento ≈ gasto total ± 0.01
9. **Múltiples proveedores**: 3 de A, 1 de B → 2 grupos
10. **Un solo proveedor**: 100% participación
11. **Resumen solo items en ventana**: items fuera de ventana excluidos del resumen
12. **Lista vacía**: retorna items y proveedores vacíos
13. **No mutación**: inputs originales intactos
14. **Determinismo**: mismas entradas → mismas salidas (con fecha fija)

### Server Action: `__tests__/actions-reconciliacion.test.ts`

6+ tests:

1. **Happy path**: producto con 3 compras → 3 items reconciliados, resumen por proveedor
2. **Paginación**: 25 items, page 2 limit 10 → 10 items en página 2
3. **Multi-tenant**: producto de otro tenant → NOT_FOUND
4. **Producto inexistente**: → NOT_FOUND
5. **Sin auth**: getCurrentUser devuelve null → error
6. **Sin compras**: estadoCPP = SIN_DATOS, items vacíos
7. **Con advertencias**: estadoCPP = CON_ADVERTENCIAS
8. **Filtro por proveedor**: respeta filtro
9. **Filtro por fecha**: respeta filtro

### UI: `__tests__/historial-costos.test.tsx` (nuevo)

2 tests:

1. Renderiza el banner de estado CPP
2. Renderiza la tabla de resumen por proveedor

## Decisions Resolved

### 1. Paginación

**Decisión**: El endpoint pagina items (igual que el actual), pero el resumen
por proveedor se calcula sobre el set completo en ventana.

**Justificación**: Mantiene performance del listado (no traer miles de items
a memoria) sin sacrificar la utilidad del resumen (que perdería sentido si
solo mostrara una página). El caption en la UI aclara al usuario que el
resumen no respeta la paginación.

**Trade-off aceptado**: El cálculo del resumen requiere una segunda query
completa (max 1000 items) por request. Es aceptable porque la ventana es
12 meses y los productos rara vez tienen más de 1000 compras en un año.

### 2. Mock de Prisma

**Decisión**: Dos queries paralelas con `Promise.all`: una paginada (igual
que el actual) y una completa (max 1000 items) para reconciliación.

**Justificación**: La query completa no pagina porque el reconciliador
necesita TODOS los items en ventana para calcular el gasto proporcional
correctamente (prorrateo por documento requiere sumar cantidades del
mismo documento). La paginación rompería el cálculo.

**Trade-off aceptado**: Doble query por request. Mitigación: índice
existente en `compraDocumentoItem.productoId` y `compraDocumento.fechaCompra`.

### 3. Flag `tasaAproximada`

**Decisión**: La action calcula el flag usando `normalizarMoneda` (helper
existente en `cost-calculator.ts`) y lo pasa al reconciliador como parte
del input materializado. El reconciliador solo lo proyecta al output.

**Justificación**: Mantiene el reconciliador puro y testeable. La action
es la responsable de consultar el estado real de la tasa de cambio (que
sí depende de Prisma y del cache de tasas). El reconciliador no necesita
saber cómo se calcula, solo reflejar el flag.

**Trade-off aceptado**: El reconciliador recibe un parámetro opcional que
no usa para calcular nada, solo para proyectar. Es aceptable porque es
un flag derivado, no un input del cálculo.

## Risks & Mitigations

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|-----------|
| Performance: doble query por request | Media | Índice existente, max 1000 items en query completa |
| Inconsistencia: queries paralelas pueden divergir | Baja | $transaction si se detecta en implementación |
| Memoria: producto con miles de compras | Baja | Límite duro 1000 items para query completa |
| UI: resumen por proveedor no respeta paginación | Baja | Caption aclaratorio en la UI |
| Refactor: getHistorialCostosAction queda obsoleto | Media | Mantenerlo intacto en este change; migrar consumidores en follow-up |

## Migration Plan

### Pasos de implementación (orden)

1. **RED**: Crear `__tests__/reconciliador-historial.test.ts` con tests del calculador puro
2. **GREEN**: Crear `lib/reconciliador-historial.ts` con la función pura
3. **RED**: Crear `__tests__/actions-reconciliacion.test.ts` con tests del action
4. **GREEN**: Crear `actions-reconciliacion.ts` con `getHistorialReconciliadoAction`
5. **GREEN**: Agregar tipos nuevos a `types.ts`
6. **GREEN**: Actualizar `actions.ts` (barrel) para re-exportar
7. **RED**: Crear `__tests__/historial-costos.test.tsx` con tests UI
8. **GREEN**: Actualizar `historial-costos.tsx` con banner, columnas, resumen
9. **REFACTOR**: Code review + ajustes
10. **VERIFY**: Correr `pnpm run lint` y `pnpm test:run`
11. **COMMIT**: Un commit por work unit (calculador, action, UI)

### Rollback

Revertir los commits en orden inverso. No hay migraciones de schema ni
cambios destructivos, así que el rollback es seguro.

## Out of Scope

- Filtro por rango de fechas en el resumen por proveedor (se puede agregar después)
- Paginación del resumen por proveedor
- Exportación CSV del historial reconciliado
- Endpoint para marcar/desmarcar líneas como "incluidas en CPP" manualmente
- Cambios en `getHistorialCostosAction` (queda intacto, puede deprecarse después)
- Cambios en `getFichaCostoAction` (la ficha principal no se toca)

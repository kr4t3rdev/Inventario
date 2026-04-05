# Design: Módulo de Producción - Refactoring de Recetas

## Technical Approach

Se refactoriza el módulo de recetas de producción para simplificar la gestión de productos. En lugar de un sistema complejo de "ingredientes abstractos", las recetas ahora tienen:

1. **Un producto final** (destino de producción y base de costo)
2. **Productos agregados directamente** (mediante búsqueda expandida)

La interfaz de usuario presenta un **área expandida de búsqueda** que ocupa el espacio principal del formulario, permitiendo descubrimiento intuitivo de productos.

El costo unitario se calcula como: `(precioCosto_ProductoFinal + Σ(cantidadProducto × precioCosto)) / rendimiento`

Arquitectura:
- **Capa de datos**: Prisma (RecetaIngrediente con nueva semántica de "productos agregados")
- **Capa de API**: Next.js Routes (endpoints existentes, ajustes en cálculo de costo)
- **Capa de estado**: Redux Toolkit + RTK Query (sin cambios)
- **Capa de presentación**: React componentes reorganizados con área expandida de búsqueda

## Architecture Decisions

### Decision: Mantener RecetaIngrediente vs crear RecetaProducto

**Choice**: Mantener tabla `RecetaIngrediente` existente pero cambiar semántica: ya no son "ingredientes" sino "productos agregados a la receta".

**Alternatives considered**:
1. Crear tabla `RecetaProducto` nueva - duplicaría lógica y requeriría migración
2. Embeber productos como JSON - dificulta índices y búsquedas
3. Eliminar completamente - breaking change de datos

**Rationale**: Evita migración destructiva. La tabla ya funciona correctamente. Cambio de semántica sin cambio de estructura es viable mediante comentarios y nombres de variables actualizados en código.

### Decision: Búsqueda local de productos sin API adicional

**Choice**: Filtrar lista `productosTyped` localmente en el cliente (ya cargada en Redux) con debounce de 300ms.

**Alternatives considered**:
1. Llamar API de búsqueda - latencia innecesaria, productos ya están en memoria
2. Sin debounce - renders excesivos
3. API GraphQL con búsqueda - overhead innecesario

**Rationale**: Los productos ya están en Redux mediante `useGetProductosQuery()`. Reutilizar evita N+1 y es más rápido. Offline-ready.

### Decision: Mostrar costo unitario en tabla

**Choice**: Columna "Costo Unitario" visible en tabla de recetas con formato moneda 2 decimales ($XX.XX).

**Alternatives considered**:
1. No mostrar - pierde KPI importante
2. Expandible/tooltip - oculta info
3. Dashboard separado - fragmenta experiencia

**Rationale**: Costo es KPI central en producción. Visible en listado facilita análisis rápido de rentabilidad.

### Decision: Estructura de Dialog para crear/editar receta

**Choice**: Reorganizar Dialog actual en 3 secciones:
1. **Arriba**: Nombre, Rendimiento, Producto Final (controles básicos)
2. **Centro (GRANDE)**: Área búsqueda de productos (discovery)
3. **Abajo**: Productos agregados (lista + eliminar)

**Alternatives considered**:
1. Página separada - overhead de navegación
2. Sidebar flotante - sincronización compleja de estado
3. Tabs - oculta la búsqueda

**Rationale**: Mantiene flujo Dialog (conocido para usuario). Área grande facilita búsqueda. Espacialmente intuitiva.

### Decision: Eliminar concepto de desperdicio por ahora

**Choice**: Mantener campo `desperdicio` en BD pero ignorar en cálculos y UI (v2 feature).

**Alternatives considered**:
1. Eliminar columna - breaking change
2. Usar en cálculos - agrega complejidad innecesaria

**Rationale**: Simplifica spec actual. Campo existe para futuras iteraciones sin migración de datos.

---

## Data Flow

### Crear Receta

```
Usuario → Dialog Nueva Receta
   ├─ Sección 1: Nombre, Rendimiento, Producto Final (input/select)
   │
   ├─ Sección 2: Área Búsqueda (EXPANDIDA)
   │  ├─ Input búsqueda ("Buscar productos...")
   │  ├─ onChange → filterProductos(query, productosTyped) [local]
   │  ├─ Resultados lista:
   │  │   formato: "NombreProducto | Categoría | $XX.XX | Stock: N"
   │  │
   │  └─ Click en producto:
   │     ├─ Muestra Input Cantidad + Select Unidad
   │     └─ Botón "Agregar a Receta"
   │        ├─ Validar: no duplicado
   │        ├─ setEditItems([...editItems, {productoId, cantidad, unidad}])
   │        └─ Recalcula costoUnitario localmente
   │
   └─ Sección 3: Productos Agregados (tabla)
      ├─ Fila por producto: Nombre | Cantidad | Unidad | [Eliminar]
      ├─ Botón Eliminar → recalcula costo
      │
      └─ Botón "Guardar Receta"
         ├─ POST /api/produccion/recetas
         │   {nombre, rendimiento, productoId}
         │   respuesta: {recetaId, costoUnitario...}
         │
         └─ POST /api/produccion/recetas/[id]/ingredientes
             [productos agregados]
             └─ Actualiza tabla Recetas en tiempo real
                └─ Muestra costoUnitario calculado
```

### Calcular Costo Unitario

```
Función: calculateCostoUnitario(productoFinal, productosAgregados[], rendimiento)

1. costoProductoFinal = productoFinal.precioCosto ?? 0
2. costoProductosAgregados = Σ(producto.cantidad × producto.precioCosto)
3. costoTotal = costoProductoFinal + costoProductosAgregados
4. costoUnitario = costoTotal / rendimiento

Ej:
  Producto Final: "Refresco 1L" ($50)
  Productos Agregados:
    - "Azúcar" 2 kg ($5/kg) = $10
    - "Agua" 1 L ($1/L) = $1
  Rendimiento: 1
  
  costoUnitario = ($50 + $10 + $1) / 1 = $61.00

Se recalcula en:
  - Crear receta (inicial)
  - Agregar producto
  - Editar cantidad
  - Eliminar producto
  - Cambiar rendimiento
  - Cambiar productoFinal
```

---

## File Changes

| File | Action | Reason |
|------|--------|--------|
| `src/app/busy/produccion/page.tsx` | **Modify** | Reorganizar Dialog receta: Sección 1 (controles) + Sección 2 (búsqueda expandida) + Sección 3 (lista agregados). Agregar función `filterProductos()`. Mostrar `costoUnitario` en tabla. Remover lógica de desperdicio de UI. |
| `src/app/api/produccion/recetas/route.ts` | **Modify** | POST: calcular `costoUnitario = (precioCosto_productoFinal + Σ productosAgregados) / rendimiento`. GET: retornar `costoUnitario` en respuesta. |
| `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` | **Verify** | Endpoint existente. POST agrega, GET retorna, DELETE elimina. Validar no-duplicados. Recalcular costo en padre. |
| `src/lib/redux/services/produccionApi.ts` | **Verify** | RTK Query queries/mutations. Sin cambios mayores, solo asegurar costoUnitario en respuestas. |
| `prisma/schema.prisma` | **No Change** | RecetaIngrediente permanece igual. Futuro: renombrar a RecetaProducto (breaking change, v2). |

---

## Interfaces / Contracts

### Receta con Costo Unitario Visible

```typescript
interface Receta {
  recetaId: string
  nombre: string
  rendimiento: number
  costoUnitario: number // ← NUEVO: calculado y visible
  productoId?: string | null
  producto?: {
    id: string
    nombre: string
    precioCosto: number
    stock: number
  } | null
  RecetaIngrediente: ProductoAgregado[]
  createdAt: Date
  updatedAt: Date
}

interface ProductoAgregado {
  id: string
  recetaId: string
  productoId: string
  cantidad: number
  unidadSimbolo?: string | null // ej: "kg", "L", null
  desperdicio: number // No usar (siempre 0 por ahora)
  producto: {
    id: string
    nombre: string
    precioCosto: number
    stock: number
  }
  createdAt: Date
  updatedAt: Date
}
```

### Búsqueda Local

```typescript
// Función pura para filtrar productos
const filterProductos = (query: string, productos: Producto[]): Producto[] => {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return productos.filter(p =>
    p.nombre.toLowerCase().includes(q) ||
    (p.categoria?.toLowerCase().includes(q))
  ).slice(0, 20) // Top 20 resultados
}

// Uso en componente
const [busqueda, setBusqueda] = useState('')
const resultados = filterProductos(busqueda, productosTyped || [])
```

### POST /api/produccion/recetas

Request:
```json
{
  "nombre": "Refresco 1L",
  "rendimiento": 1,
  "productoId": "prod_123"
}
```

Response (201):
```json
{
  "recetaId": "rec_001",
  "nombre": "Refresco 1L",
  "rendimiento": 1,
  "costoUnitario": 50,
  "productoId": "prod_123",
  "producto": { "id": "prod_123", "nombre": "Refresco 1L", "precioCosto": 50 },
  "RecetaIngrediente": [],
  "createdAt": "2025-04-05T10:00:00Z"
}
```

---

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| **Unit** | `filterProductos()` | Test: query vacío ([]); case-insensitive; parcial match; límite 20. |
| **Unit** | `calculateCostoUnitario()` | Test: vacío (0); 1 producto; múltiples; rendimiento > 1; costo 0. |
| **Integration** | POST /api/produccion/recetas | Crea receta, calcula costo inicial (productoFinal / rendimiento). |
| **Integration** | POST /api/produccion/recetas/[id]/ingredientes | Agrega producto, rechaza duplicado, recalcula costo padre. |
| **Integration** | Dialog en page.tsx | Renderiza, permite buscar, agregar, eliminar, ve actualización tabla. |
| **E2E** | Flujo completo | Usuario: crea receta → busca "Azúcar" → agrega cantidad 2 → ve costo recalculado → edita cantidad → ve actualización → elimina → ve actualización. |

---

## Migration / Rollout

**No migration required.**

- RecetaIngrediente schema idéntico
- Cambios son semánticos (nomenclatura) + lógica de cálculo
- Datos legados con `desperdicio != 0` se ignoran (ignorar en cálculos, v2 feature)
- Rollout: cambios frontend + backend simultáneamente en single release

---

## Component Structure

```
ProduccionPage
└─ Tab: Recetas
   ├─ Búsqueda tabla (top)
   ├─ Tabla Recetas
   │  ├─ Columnas: Nombre | Rendimiento | ProductoFinal | # Productos Agregados | COSTO UNITARIO | Fecha | [Editar][Eliminar]
   │  └─ Filas: data.map(receta => <TableRow costoUnitario={formatCurrency(receta.costoUnitario)} />)
   │
   └─ Dialog: Nueva/Editar Receta
      ├─ SECCIÓN 1 (arriba, pequeña):
      │  ├─ Input nombre
      │  ├─ Input rendimiento
      │  └─ Select productoFinal
      │
      ├─ SECCIÓN 2 (centro, GRANDE, 60% espacio):
      │  ├─ Label "Agregar Productos"
      │  ├─ Input búsqueda
      │  ├─ Resultados lista (virtualized si muchos)
      │  │   ├─ Item: Producto
      │  │   ├─ Click → muestra Cantidad + Unidad + [Agregar]
      │  │   └─ [Agregar] → agrega a editItems, recalcula costo
      │  └─ Display costo actualizado abajo búsqueda: "Costo Unitario: $XX.XX"
      │
      └─ SECCIÓN 3 (abajo, tabla):
         ├─ Label "Productos en Receta"
         ├─ Tabla productos agregados
         │  └─ Columns: NombreProducto | Cantidad | Unidad | [Eliminar]
         │     onclick Eliminar → recalcula costo
         └─ Botones: [Cancelar] [Guardar Receta]
            onclick Guardar → POST receta + POST ingredientes
```

---

## Implementation Checklist

- [ ] Reorganizar Dialog receta (3 secciones)
- [ ] Función pura `filterProductos(query, list) → list`
- [ ] Función pura `calculateCostoUnitario(productoFinal, items[], rendimiento) → number`
- [ ] Input búsqueda con debounce 300ms
- [ ] Mostrar resultados lista (Nombre | Categoría | $Precio | Stock)
- [ ] Input Cantidad + Select Unidad al clickear resultado
- [ ] Botón "Agregar a Receta" → validar duplicado
- [ ] Tabla productos agregados con botón [Eliminar]
- [ ] Actualizar costo en tiempo real (editItems cambia)
- [ ] Mostrar costoUnitario en tabla recetas (2 decimales, $XX.XX)
- [ ] Ajustar POST /api/produccion/recetas para calcular costo
- [ ] Tests unitarios para filterProductos
- [ ] Tests unitarios para calculateCostoUnitario
- [ ] Tests integración POST receta
- [ ] E2E test flujo receta

---

## Open Questions

- [ ] ¿Renombrar RecetaIngrediente a RecetaProducto? **Answer**: Dejar para v2 (breaking change). Por ahora mantener.
- [ ] ¿Máximo de productos por receta? **Answer**: Sin límite inicial. Índices en BD garantizan performance.
- [ ] ¿Debounce de búsqueda: 300ms o 500ms? **Answer**: 300ms (estándar).
- [ ] ¿Mostrar stock disponible de producto en búsqueda? **Answer**: Sí, formato "Stock: N" para awareness.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Cálculo de costo incorrecto | **High** | Función pura + unit tests exhaustivos + verificación manual |
| Duplicado de productos en receta | Medium | Validación cliente + servidor. Tests. |
| Performance: búsqueda en 10k+ productos | Low | Filtro local + debounce. Indexing DB después si necesario. |
| Precio producto cambia, costo receta no actualiza | Low | Soft-recalc en siguiente fetch. Documentar. Trigger BD v2. |

---

**Status**: Ready for task breakdown (sdd-tasks)

**Alternatives considered**: Calcular en tiempo real durante toda la orden

**Rationale**: Los costos pueden cambiar (precios de proveedores fluctúan). Calcular al completar asegura que el costo registrado sea el real del momento de producción. Además, reduce carga computacional.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ ProductionPage │  │ RecetasForm      │  │ ValeSalidaForm    │ │
│  │ (lista + tabs) │  │ (Dialog)         │  │ (Dialog)          │ │
│  └────────┬────────┘  └────────┬─────────┘  └─────────┬──────────┘ │
│           │                     │                      │             │
│           └─────────────────────┼──────────────────────┘             │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │  Redux Toolkit (RTK)    │                      │
│                    │  produccionApi.ts       │                      │
│                    └────────────┬────────────┘                      │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Next.js API Routes    │
                    │  /api/produccion/*       │
                    └─────────────┬─────────────┘
                                  │
┌─────────────────────────────────┼────────────────────────────────────┐
│                         BACKEND                                      │
│                    ┌────────────▼────────────┐                      │
│                    │      Prisma ORM         │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
│  ┌──────────────────────────────┼───────────────────────────────┐  │
│  │                    DATABASE (PostgreSQL)                     │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────┐             │  │
│  │  │ Receta   │  │ OrdenProduccion│  │ ValeSalida │             │  │
│  │  │ (ext)    │  │ (ext)          │  │ (new)      │             │  │
│  │  └──────────┘  └────────────────┘  └─────────────┘             │  │
│  │       │                │                  │                     │  │
│  │       └────────────────┼──────────────────┘                     │  │
│  │              ┌─────────▼─────────┐                               │  │
│  │              │    Producto       │ ◄── Stock actualizado        │  │
│  │              └───────────────────┘                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Flujo de Producción de Producto

```
1. Usuario crea Receta → Receta.productoId = producto del inventario
2. Usuario crea OrdenProduccion → selecciona Receta + cantidad
3. Usuario aprueba orden → decrementa stock de ingredientes (reserva)
4. Usuario completa orden → 
   a) incrementa stock del producto terminado
   b) calcula costo = Σ(ingrediente.cantidad × producto.precioCosto)
   c) actualiza estado a "completada"
   d) crea registro en ReconciliacionGasto (integración contabilidad)
   e) registra historial de estado en OrdenProduccionHistorial
```

### Flujo de Vale de Salida

```
1. Usuario crea ValeSalida → selecciona concepto (de GastosDE.tipo)
2. Sistema valida stock disponible
3. Usuario confirma → decrementa stock de productos
4. Vale queda registrado para historial
```

## File Changes

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `prisma/schema.prisma` | Agregar campos a modelo Receta y crear ValeSalida |
| `src/app/api/produccion/recetas/route.ts` | CRUD de recetas para productos |
| `src/app/api/produccion/recetas/[id]/route.ts` | GET/PATCH/DELETE receta específica |
| `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` | Gestión de ingredientes |
| `src/app/api/produccion/ordenes/route.ts` | CRUD de órdenes de producción |
| `src/app/api/produccion/ordenes/[id]/route.ts` | GET orden específica |
| `src/app/api/produccion/ordenes/[id]/aprobar/route.ts` | Aprobar orden (reservar materiales) |
| `src/app/api/produccion/ordenes/[id]/completar/route.ts` | Completar orden |
| `src/app/api/produccion/ordenes/[id]/cancelar/route.ts` | Cancelar orden |
| `src/app/api/produccion/vales/route.ts` | CRUD de vales de salida |
| `src/app/api/produccion/vales/[id]/route.ts` | GET vale específica |
| `src/app/api/produccion/conceptos/route.ts` | GET tipos de GastosDE para conceptos |
| `src/app/api/produccion/vales/[id]/pdf/route.ts` | Generar PDF del vale |
| `src/lib/redux/services/produccionApi.ts` | RTK Query endpoints |
| `src/components/produccion/production-page.tsx` | Página principal del módulo |
| `src/components/produccion/recetas-list.tsx` | Lista de recetas |
| `src/components/produccion/receta-form.tsx` | Formulario crear/editar receta |
| `src/components/produccion/ordenes-list.tsx` | Lista de órdenes de producción |
| `src/components/produccion/orden-form.tsx` | Formulario crear orden |
| `src/components/produccion/vales-list.tsx` | Lista de vales de salida |
| `src/components/produccion/vale-form.tsx` | Formulario crear vale |
| `src/app/models/model.ts` | Agregar tipos de producción |
| `src/app/produccion/page.tsx` | Ruta de la página |

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Agregar `productoId` a Receta, crear modelo ValeSalida |
| `src/lib/redux/store.ts` | Agregar `produccionApi` al store |
| `src/components/ui/sidebar.tsx` | Agregar enlace al módulo de producción |
| `src/app/models/model.ts` | Agregar tipos `ValeSalida`, `EstadoValeSalida` |
| `src/app/api/contabilidad/logs/route.ts` | Agregar endpoint para registrar costo de producción |

## Interfaces / Contracts

### Tipos TypeScript (model.ts)

```typescript
// Enum para estados de orden de producción
export enum EstadoProduccion {
  PENDIENTE = 'pendiente',
  EN_PROCESO = 'en_proceso',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada',
}

// Enum para estados de vale de salida
export enum EstadoValeSalida {
  PENDIENTE = 'pendiente',
  COMPLETADA = 'completada',
  ANULADA = 'anulada',
}

// Modelo ValeSalida
export interface ValeSalida {
  valeSalidaId: string;
  concepto: string;
  observaciones?: string;
  estado: EstadoValeSalida;
  createdAt: Date;
  updatedAt: Date;
  usuarioId: string;
  items: ValeSalidaItem[];
}

export interface ValeSalidaItem {
  valeSalidaItemId: string;
  valeSalidaId: string;
  productoId: string;
  cantidad: number;
  producto?: Producto;
}

// Receta extendida para productos
export interface RecetaProduccion {
  recetaId: string;
  nombre: string;
  rendimiento: number;
  costoUnitario: number;
  productoId?: string; // Nuevo campo - producto del inventario
  producto?: Producto;  // Producto resultado de la producción
  ingredientes: RecetaIngrediente[];
}

// Orden de producción
export interface OrdenProduccion {
  ordenProduccionId: string;
  recetaId: string;
  cantidad: number;
  estado: EstadoProduccion;
  observaciones?: string;
  fechaProduccion: Date;
  costoMateriales?: number;
  costoUnitario?: number;
  createdAt: Date;
  updatedAt: Date;
  receta?: RecetaProduccion;
}
```

### Esquema Prisma (adiciones)

```prisma
// En modelo Receta existente, agregar:
model Receta {
  // ... campos existentes ...
  productoId String?    // Nuevo: producto del inventario como resultado
  producto   Producto?  @relation(fields: [productoId], references: [id])
}

// Nuevo modelo ValeSalida
model ValeSalida {
  valeSalidaId   String           @id @default(cuid())
  concepto       String
  observaciones String?
  estado         String           @default("pendiente")
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  usuarioId      String
  items          ValeSalidaItem[]
}

model ValeSalidaItem {
  valeSalidaItemId String     @id @default(cuid())
  valeSalidaId     String
  productoId       String
  cantidad         Int
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  valeSalida       ValeSalida @relation(fields: [valeSalidaId], references: [valeSalidaId], onDelete: Cascade)
  producto         Producto   @relation(fields: [productoId], references: [id])
}

// Nuevo modelo Historial de Estados de Orden de Producción
model OrdenProduccionHistorial {
  historialId       String   @id @default(cuid())
  ordenProduccionId String
  estadoAnterior     String?
  estadoNuevo       String
  observaciones     String?
  usuarioId         String
  createdAt         DateTime @default(now())
}
```

### Contratos de API

```
GET    /api/produccion/recetas              - Listar recetas (con filtro search)
POST   /api/produccion/recetas             - Crear receta
GET    /api/produccion/recetas/[id]         - Obtener receta específica
PATCH  /api/produccion/recetas/[id]        - Actualizar receta
DELETE /api/produccion/recetas/[id]        - Eliminar receta
POST   /api/produccion/recetas/[id]/ingredientes - Agregar/actualizar ingredientes

GET    /api/produccion/ordenes              - Listar órdenes (con filtro estado)
POST   /api/produccion/ordenes             - Crear orden
GET    /api/produccion/ordenes/[id]         - Obtener orden específica
POST   /api/produccion/ordenes/[id]/aprobar  - Aprobar orden (reservar materiales)
POST   /api/produccion/ordenes/[id]/completar - Completar orden (actualizar inventario)
POST   /api/produccion/ordenes/[id]/cancelar  - Cancelar orden

GET    /api/produccion/vales               - Listar vales de salida
POST   /api/produccion/vales              - Crear vale de salida
GET    /api/produccion/vales/[id]          - Obtener vale específica
PATCH  /api/produccion/vales/[id]          - Actualizar vale
DELETE /api/produccion/vales/[id]          - Anular vale
GET    /api/produccion/vales/[id]/pdf      - Generar PDF del vale

GET    /api/produccion/conceptos           - Obtener conceptos (tipos de GastosDE)
```

## Testing Strategy

| Capa | Qué probar | Enfoque |
|------|------------|---------|
| **Unit** | Funciones utilitarias (cálculo de costos, validación de inventario) | Vitest con mocks de Prisma |
| **API** | Endpoints CRUD, validaciones, transacciones | Pruebas de integración con `supertest` |
| **Components** | Rendering de tablas, formularios, diálogos | React Testing Library |
| **E2E** | Flujo completo: crear receta → orden → completar | Playwright |

### Pruebas Unitarias Prioritarias

- `calcularCostoProduccion(receta, cantidad)` - Retorna costo total y unitario
- `validarDisponibilidadMateriales(ingredientes, stock)` - Retorna faltantes
- `calcularMaterialesReservados(orden)` - Retorna materiales a reservar

### Pruebas de Integración Prioritarias

- Crear receta con ingredientes → verificar en DB
- Aprobar orden con materiales suficientes → verificar decremento stock
- Aprobar orden sin materiales suficientes → verificar error 400
- Completar orden → verificar incremento stock producto y decremento ingredientes
- Crear vale → verificar decremento stock

## Migration / Rollout

### Fase 1: Base de Datos
1. Ejecutar migración Prisma para agregar `productoId` a Receta
2. Crear nuevas tablas `ValeSalida` y `ValeSalidaItem`

### Fase 2: API Backend
1. Desplegar nuevas rutas de API
2. Verificar que las rutas existentes de recetas de restaurante sigan funcionando

### Fase 3: Frontend
1. Agregar enlace en sidebar al nuevo módulo
2. Desplegar página de producción

### Feature Flags
- No se requieren feature flags ya que es un módulo completamente nuevo
- La funcionalidad de recetas existentes del restaurante no se ve afectada

### Rollback Plan
1. Revertir migración de Prisma si hay errores
2. Las recetas de restaurante seguirán funcionando (relación Plato no se modifica)

## Open Questions

- [x] **¿Se requiere integración con el módulo de contabilidad para registrar costos de producción como gasto?** → **SÍ** - Crear registro en `ReconciliacionGasto` al completar orden de producción
- [x] **¿Los vales de salida requieren aprobación para decrementar inventario o se hacen directamente?** → **Directamente** - Se decrementa al crear el vale (con validación de disponibilidad)
- [x] **¿Se necesita exportar/generar PDF de los vales de salida?** → **SÍ** - Agregar botón para generar PDF del vale
- [x] **¿El historial de cambios de estado de órdenes debe guardarse en tabla separada o es suficiente con timestamps?** → **Tabla separada** - Crear modelo `OrdenProduccionHistorial`

## UI/UX Pattern Reference

Basado en el análisis de `tabla-gastos.tsx` y componentes existentes:

- **Layout**: Cards con resúmenes + Tabs para secciones
- **Tablas**: Usar `Table`, `TableHeader`, `TableRow`, `TableCell` de Shadcn
- **Badges**: Para estados (color según estado: verde=completado, amarillo=pendiente, rojo=cancelado)
- **Formularios**: Dialog de Shadcn con Form +-zod
- **Botones**: `Button` de Shadcn con variantes (default, outline, destructive)
- **Iconos**: Lucide React (importados en componentes)
- **Fechas**: `date-fns` con `format(new Date(fecha), "dd/MM/yyyy")`
- **Currency**: `Intl.NumberFormat("es-ES", { style: "currency", currency: "CUP" })`
- **Estados de carga**: Skeleton o Spinner durante carga de datos

### Paleta de colores (sistema existente)
- Primary: Blue
- Success: Green (para estados completados)
- Warning: Yellow (para estados pendientes)
- Error/Destructive: Red (para cancelados, errores)
- Muted: Gray (para textos secundarios)

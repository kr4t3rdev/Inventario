# Design: Módulo de Producción

## Technical Approach

Se implementará un nuevo módulo de producción que extiende el sistema existente de recetas del restaurante pero orientado a productos del inventario. El módulo utilizará:

- **API Routes** en `/src/app/api/produccion/` siguiendo el patrón RESTful del proyecto
- **Redux Toolkit** con RTK Query para estado (extendiendo el patrón de `restauranteRecetasProduccionApi`)
- **Componentes UI** con Shadcn/ui siguiendo el patrón de `tabla-gastos.tsx`
- **Modelo de datos** expandiendo el esquema de Prisma existente

La arquitectura sigue el principio de separación de responsabilidades con:
- Capa de datos: Prisma models
- Capa de API: Next.js API Routes con autenticación
- Capa de estado: Redux Toolkit con RTK Query
- Capa de presentación: Componentes React con Tailwind CSS

## Architecture Decisions

### Decision: Reutilizar modelo de Receta existente vs crear nuevo

**Choice**: Extender el modelo `Receta` existente para soportar tanto Plato como Producto

**Alternatives considered**: Crear un modelo `RecetaProducto` completamente nuevo

**Rationale**: El modelo `Receta` ya tiene la estructura necesaria (`recetaId`, `nombre`, `rendimiento`, `ingredientes`). Solo se necesita agregar una relación opcional a `Producto` para indicar que el producto resultado de la receta aparece en el inventario. Esto reduce duplicación de código y mantiene la consistencia del esquema.

### Decision: Vales de salida como nuevo modelo vs extensión de GastosDE

**Choice**: Crear nuevo modelo `ValeSalida` separado de `GastosDE`

**Alternatives considered**: Extender el modelo `GastosDE` para incluir productos

**Rationale**: Los vales de salida operan sobre productos del inventario (decrementan stock) mientras que `GastosDE` registra gastos monetarios. Aunque comparten conceptos (tipos de gasto), son funcionalmente diferentes. Mantenerlos separados permite:
- Escalabilidad independiente
- Historial de vales con productos específicos
- Reporting diferenciado

### Decision: Patrón de UI para formularios

**Choice**: Usar `Dialog` + `Form` de Shadcn/ui para crear/editar recetas y vales

**Alternatives considered**: Crear páginas dedicadas para cada operación

**Rationale**: El patrón de Dialog mantiene al usuario en contexto y es consistente con el resto del sistema (ej: `tabla-gastos.tsx` usa este patrón en el código comentado). Además, reduce la navegación entre páginas.

### Decision: Cálculo de costos en momento de completado

**Choice**: Calcular costos de producción solo al completar la orden

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

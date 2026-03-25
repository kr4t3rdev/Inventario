# Design: Productos Compuestos (Cajas/Conjuntos)

## Technical Approach

La funcionalidad de productos compuestos permite definir un producto "padre" (ej: caja de cigarros) que contiene una cantidad específica de un producto "hijo" (ej: cigarro individual). El sistema automáticamente crea el producto hijo con precio calculado y gestiona el stock de forma sincronizada.

**Mapeo a especificaciones:**
- Requirement: Composite Product Configuration → Sección en formulario con checkbox y campos condicionales
- Requirement: Automatic Child Product Creation → Lógica en API POST /productos
- Requirement: Stock Management → Triggers/transacciones en backend
- Requirement: Product Relationship Integrity → Validaciones y relaciones en Prisma

---

## Architecture Decisions

### Decision: Storage Strategy for Parent-Child Relationship

**Choice**: Agregar campo `productoPadreId` (self-referencing) en el modelo Producto + campo `cantidadEnPack` en Producto.

**Alternatives considered**:
- Tabla separada `ProductoPack` con relación N:N
- Campo JSON `contenido` con array de {productoId, cantidad}

**Rationale**: Mantiene la simplicidad del modelo existente. Un producto hijo pertenece a un solo padre (1:1 en práctica). El campo `cantidadEnPack` en el producto hijo indica cuántas unidades del padre representa.

---

### Decision: Child Product Creation Timing

**Choice**: Crear el producto hijo en el mismo request POST del padre, dentro de una transacción Prisma.

**Alternatives considered**:
- Crear hijo en request separado
- Crear hijo lazily (lazy creation) al primera venta

**Rationale**: Garantiza integridad transaccional. Si falla la creación del hijo, no se crea el padre. El usuario espera ver ambos productos en el catálogo tras crear uno compuesto.

---

### Decision: Price Calculation

**Choice**: Calcular precio del hijo = precio del padre / cantidad. Redondear al entero más cercano y mostrar warning si hay pérdida por redondeo.

**Alternatives considered**:
- Calcular solo al momento de venta
- No permitir precios no divisibles

**Rationale**: El usuario necesita saber el precio del producto individual al crear. El redondeo es práctica común en retail (ej: $100/3 = $33).

---

### Decision: Stock Synchronization

**Choice**: NO sincronizar stock automáticamente. Cada producto (padre e hijo) tiene stock independiente. El inventario reporta ambos por separado.

**Alternatives considered**:
- Sincronizar stock en tiempo real (complejo, riesgo de inconsistencias)
- Solo permitir venta del padre (pierde flexibilidad)

**Rationale**: Caso de uso real: una tienda puede vender cajas enteras Y unidades individuales. Ambos stocks se gestionan independientemente. El padre representa "cajas en almacén" y el hijo "unidades sueltas disponibles para venta".

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Form)                           │
├─────────────────────────────────────────────────────────────────┤
│  ProductoForm.tsx                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ Checkbox "Es Compuesto" │──▶│ Sección compuestos (oculta) │  │
│  │ toggles visibility     │    │ - Select producto secundario │ │
│  └─────────────────────┘    │ - Input cantidad             │  │
│                             │ - Preview precio calculado    │  │
│                             └─────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/productos                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Validar campos compuestos                            │   │
│  │ 2. Crear producto padre (esCompuesto = true)           │   │
│  │ 3. Calcular precio hijo = padre.precioVenta / cantidad │   │
│  │ 4. Crear producto hijo con:                             │   │
│  │    - nombre: "Cigarro (unidad)"                        │   │
│  │    - codigoNegocio: input del usuario                 │   │
│  │    - cantidadEnPack: cantidad                         │   │
│  │    - productoPadreId: padre.id                         │   │
│  │    - heredados: categoría, unidad, almacen             │   │
│  │ 5. Transacción atómica (todo o nada)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Changes

### Base de Datos (Prisma)

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Agregar campos `esCompuesto: Boolean`, `cantidadEnPack: Int?`, `productoPadreId: String?` al modelo Producto |

### API Layer

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/productos/route.ts` | Modify | Agregar lógica de creación de producto compuesto en POST |
| `src/app/api/productos/[id]/route.ts` | Modify | Agregar validación al eliminar producto compuesto con hijos |
| `src/app/api/productos/route.ts` | Modify | Agregar endpoint GET con filtro `esCompuesto` |

### Frontend - Components

| File | Action | Description |
|------|--------|-------------|
| `src/components/productos/productos-form.tsx` | Modify | Agregar sección de configuración de producto compuesto |
| `src/components/productos/compound-product-section.tsx` | Create | Nuevo componente para la sección de productos compuestos |
| `src/components/productos/product-select-with-preview.tsx` | Create | Componente selector de producto con preview de precio |

### Frontend - Redux/State

| File | Action | Description |
|------|--------|-------------|
| `src/lib/redux/services/productosApi.tsx` | Modify | Agregar endpoint para obtener productos padres disponibles |
| `src/app/models/model.ts` | Modify | Agregar tipos TypeScript para productos compuestos |

### Tests

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/productos/compound.test.ts` | Create | Tests unitarios para lógica de productos compuestos |

---

## Interfaces / Contracts

### Prisma Schema Changes

```prisma
model Producto {
  // ... existing fields ...
  
  // New fields for compound products
  esCompuesto       Boolean  @default(false)
  cantidadEnPack    Int?
  productoPadreId   String?
  productoPadre     Producto? @relation("ProductoCompuesto", fields: [productoPadreId], references: [id])
  productosHijos    Producto[] @relation("ProductoCompuesto")
  
  @@index([esCompuesto])
  @@index([productoPadreId])
}
```

### TypeScript Interfaces

```typescript
// New types for compound products
interface CompoundProductConfig {
  esCompuesto: boolean
  cantidadEnPack?: number
  productoSecundarioId?: string // Producto hijo existente (opcional)
  codigoNegocioHijo?: string   // Código para nuevo producto hijo
  nombreHijo?: string           // Nombre para nuevo producto hijo
}

interface ProductoCompuesto extends Producto {
  esCompuesto: true
  cantidadEnPack: number
  productoHijo?: Producto
}

interface ProductoHijo extends Producto {
  productoPadreId: string
  cantidadEnPack: number
}
```

### API Request/Response

```typescript
// POST /api/productos - new payload
interface CreateProductoPayload {
  // ... existing fields ...
  
  // Compound product optional fields
  esCompuesto?: boolean
  cantidadEnPack?: number
  // If creating a new child product:
  nombreHijo?: string
  codigoNegocioHijo?: string
}

// Response includes both parent and child
interface CreateProductoCompuestoResponse {
  productoPadre: Producto
  productoHijo: Producto
}
```

---

## UI/UX Design (Following Established Patterns)

### Visual Design (Based on Existing Form)

El componente de productos compuestos seguirá los patrones visuales establecidos:

1. **Card Container**: 
   - `bg-gradient-to-br from-primary/[0.05] via-background to-purple-500/[0.08]`
   - `border-dashed` para sección colapsable

2. **Animations** (framer-motion):
   - Entrada: `initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}`
   - Duración: `transition={{ duration: 0.35 }}`
   - Delays escalonados para campos

3. **Form Fields**:
   - Labels con iconos (Lucide React)
   - Input con `focus-visible:ring-primary/30`
   - Select con `SelectTrigger className="transition-all duration-200"`

4. **Component Structure**:
   ```
   ┌─ Checkbox "Es Producto Compuesto" (toggle) ─┐
   │  └─ Animación collapse con AnimatePresence  │
   │                                             │
   └─ Sección revealed cuando checked:           │
       ┌────────────────────────────────────────┐ │
       │ Product Selector (hijo)                │ │
       │ + Input: Cantidad en pack              │ │
       │ + Preview: Precio unitario calculado   │ │
       │ + Input: Código negocio hijo           │ │
       └────────────────────────────────────────┘ │
   ```

### Accessibility (per ui-ux-pro-max)

- [ ] Checkbox con `aria-label` descriptivo
- [ ] Labels vinculados a inputs (`htmlFor`)
- [ ] Focus states visibles
- [ ] Error messages cerca del campo проблем
- [ ] Loading states durante creación

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Lógica de cálculo de precio | Vitest con casos: divisible, no divisible, cero |
| Unit | Validación de schema Zod | Casos: sin secundario, cantidad=0, código duplicado |
| API | Creación de compuesto |happy path, error en hijo, transacción fallida |
| API | Eliminación de padre con hijos | Verificar rechazo de eliminación |
| E2E | Flow completo: crear compuesto | Playwright: form → submit → verificar ambos productos |

---

## Migration / Rollout

### Database Migration

```sql
-- Migration will add new columns (nullable initially)
ALTER TABLE "Producto" ADD COLUMN "esCompuesto" BOOLEAN DEFAULT false;
ALTER TABLE "Producto" ADD COLUMN "cantidadEnPack" INTEGER;
ALTER TABLE "Producto" ADD COLUMN "productoPadreId" TEXT REFERENCES "Producto"("id");

-- Add indexes for query performance
CREATE INDEX "idx_producto_esCompuesto" ON "Producto"("esCompuesto");
CREATE INDEX "idx_producto_productoPadreId" ON "Producto"("productoPadreId");
```

### Feature Flag

No se requiere feature flag. La funcionalidad es additive y no afecta productos existentes.

### Rollout Phases

1. **Phase 1**: Deploy schema + API + crear solo nuevo componente
2. **Phase 2**: Validar con un par de productos compuestos de prueba
3. **Phase 3**: Documentar y comunicar a usuarios

---

## Open Questions

- [ ] **¿El producto hijo debe tener código de negocio diferente o puede ser el mismo?** El diseño actual requiere código diferente, pero ¿deberíamos permitir clones con sufijo "-U" (unidad)?
- [ ] **¿Se permite editar la configuración de un compuesto existente?** Por ahora, no. Solo crear nuevos. ¿Necesitamos esta funcionalidad?
- [ ] **¿Los productos hijos aparecen en listados normales de productos?** Sí, aparecen como productos independientes. ¿Deben tener algún indicador visual en la UI?

---

## Next Steps

1. Crear migración de Prisma
2. Modificar schema de Prisma
3. Implementar lógica en API
4. Crear componente de UI
5. Agregar tests

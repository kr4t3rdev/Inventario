# Design: Plantilla de ficha de costo

## Resumen

Feature para persistir plantillas versionadas de ficha de costo por producto. Permite sugerir precios de venta, comparar la ficha actual contra una plantilla activa, y aplicar el precio sugerido de forma explícita. El diseño se integra orgánicamente con la vista existente de ficha de costo (`ficha-costo-view`) y reutiliza los patrones de Server Actions, shadcn/ui y multi-tenant del proyecto.

---

## 1. Arquitectura Técnica

### 1.1 Modelo de Datos

**Decisión**: Opción A — modelo único con `version Int` y soft-delete via `deletedAt`. Es suficiente para el caso de uso, evita joins innecesarios y mantiene la lógica de "una activa por producto" en una única tabla.

```prisma
model ProductoCostSheetTemplate {
  id              String   @id @default(cuid())
  tenantId        String
  productoId      String
  version         Int
  nombre          String
  materiales      Json     // [{ productoId, nombre, cantidad, costoUnitario, subtotal }]
  manoObra        Decimal  @default(0) @db.Decimal(10, 2)
  indirectos      Decimal  @default(0) @db.Decimal(10, 2)
  margenObjetivo  Decimal  @default(0.30) @db.Decimal(5, 4)
  costoTotal      Decimal  @default(0) @db.Decimal(10, 2)
  precioSugerido  Decimal  @default(0) @db.Decimal(10, 2)
  esActiva        Boolean  @default(false)
  notas           String?
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdById     String

  producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  tenant   Tenant   @relation(fields: [tenantId], references: [tenantId])
  creador  User     @relation(fields: [createdById], references: [userId])

  @@unique([productoId, version])
  @@unique([productoId, esActiva])
  @@index([tenantId])
  @@index([productoId])
}
```

**Notas sobre el schema**:
- `Decimal` para todos los campos monetarios y porcentuales para evitar errores de punto flotante en cálculos financieros.
- `materiales` se almacena como `Json` para flexibilidad sin necesidad de una tabla relacional adicional. El array se normaliza en la action antes de persistir.
- `deletedAt` implementa soft-delete. Todas las queries filtran `deletedAt: null`.
- `@@unique([productoId, esActiva])` a nivel de DB garantiza la unicidad de la activa. Prisma lanzará `P2002` si una race condition rompe la regla.

### 1.2 Server Actions

Nuevo archivo: `src/features/ficha-costo/actions-plantilla.ts`

Todas las actions usan el wrapper `withAction`, validan tenant con `requireTenant`, y validan feature con `requireFeature(user, 'productos', '...')`.

```typescript
// Queries
export const getPlantillasAction = withAction(async (productoId: string, user) => {
  // Listar versiones ordenadas DESC, excluyendo soft-deleted
})

export const getPlantillaActivaAction = withAction(async (productoId: string, user) => {
  // Devolver la plantilla activa (o null) con desglose completo
})

// Mutations
export const createPlantillaAction = withAction(async (input: CreatePlantillaInput, user) => {
  // Validar producto pertenece al tenant
  // Calcular next version = max(version) + 1
  // Calcular costoTotal y precioSugerido en el servidor
  // Persistir con esActiva: false
})

export const updatePlantillaAction = withAction(async (input: UpdatePlantillaInput, user) => {
  // Solo permitir actualizar notas/nombre de plantillas inactivas y no borradas
  // Rechazar actualización de campos calculados
})

export const activarPlantillaAction = withAction(async (templateId: string, user) => {
  // Dentro de prisma.$transaction:
  //   1. Buscar la plantilla a activar (validar tenant)
  //   2. Desactivar la actualmente activa del mismo producto (si existe)
  //   3. Activar la nueva
  // Si el unique constraint falla (race), la transacción hace rollback y retorna error P2002 mapeado
})

export const deletePlantillaAction = withAction(async (templateId: string, user) => {
  // Soft-delete. Rechazar si esActiva === true con ActionError('CANNOT_DELETE_ACTIVE_TEMPLATE')
})

export const aplicarPrecioSugeridoAction = withAction(async (input: AplicarPrecioInput, user) => {
  // Requiere requireManagerRole(user, 'aplicar precio sugerido')
  // Validar que templateId corresponde a plantilla activa del producto
  // Si precioVenta actual === precioSugerido → no-op
  // Actualizar Producto.precioVenta dentro de $transaction
  // Crear audit log: AuditLogService.log({ entidad: 'PRODUCTO', accion: 'UPDATE', ... })
})
```

**Cálculo del precio sugerido** (centralizado en `src/features/ficha-costo/lib/template-calc.ts`):

```typescript
export function calcularPrecioSugerido(
  costoTotal: Decimal,
  margenObjetivo: Decimal,
): Decimal {
  if (margenObjetivo.gte(1)) {
    throw new ActionError('El margen objetivo no puede ser igual o superior al 100%', 'INVALID_MARGIN')
  }
  if (margenObjetivo.lte(0)) {
    return costoTotal
  }
  return costoTotal.div(new Decimal(1).minus(margenObjetivo))
}
```

### 1.3 Data Flow

```
┌─────────────────────────────┐
│  ficha-costo-view.tsx       │
│  (Tabs: resumen | plantilla)│
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
ResumenCosto  PlantillaTab
    │             │
    │      ┌──────┴──────┐
    │      ▼             ▼
    │ ComparacionCard PlantillaVersiones
    │      │             │
    │      │      ┌──────┴──────┐
    │      │      ▼             ▼
    │      │ PlantillaForm  PlantillaEmptyState
    │      │      │
    │      │      ▼
    │      │ ComposicionCosto (reutilizado)
    │      │
    ▼      ▼
getPlantillaActivaAction
getPlantillasAction
```

- `FichaCostoView` es el contenedor. Recibe `FichaCostoData` del server component padre.
- La pestaña "Plantilla" se renderiza para **todos** los productos (no solo compuestos), porque una plantilla puede existir para productos simples (ej: para fijar un margen objetivo sobre el CPP).
- `ResumenCosto` consulta la plantilla activa vía `getPlantillaActivaAction` en un `useEffect` para mostrar la tarjeta de comparación sin bloquear el render inicial.

### 1.4 Archivos a crear / modificar

**Nuevos archivos**:
- `prisma/migrations/..._add_producto_cost_sheet_template/migration.sql`
- `src/features/ficha-costo/actions-plantilla.ts`
- `src/features/ficha-costo/lib/template-calc.ts`
- `src/features/ficha-costo/types-plantilla.ts`
- `src/features/ficha-costo/components/plantilla-tab.tsx`
- `src/features/ficha-costo/components/plantilla-versiones.tsx`
- `src/features/ficha-costo/components/plantilla-form.tsx`
- `src/features/ficha-costo/components/plantilla-empty-state.tsx`
- `src/features/ficha-costo/components/comparacion-plantilla-card.tsx`
- `src/features/ficha-costo/__tests__/actions-plantilla.test.ts`
- `src/features/ficha-costo/__tests__/plantilla-tab.test.tsx`
- `src/features/ficha-costo/__tests__/template-calc.test.ts`

**Archivos modificados**:
- `prisma/schema.prisma` — agregar modelo `ProductoCostSheetTemplate` y relaciones en `Producto`, `Tenant`, `User`
- `src/features/ficha-costo/components/ficha-costo-view.tsx` — agregar tab "Plantilla"
- `src/features/ficha-costo/components/resumen-costo.tsx` — integrar `ComparacionPlantillaCard`
- `src/features/ficha-costo/actions.ts` — re-exportar actions de plantilla
- `src/features/ficha-costo/types.ts` — merge con tipos de plantilla (o importar desde barrel)

---

## 2. Dirección Visual

### 2.1 Filosofía de diseño para esta feature

La plantilla de costo es una herramienta de **planificación financiera** dentro de un ERP. El diseño debe comunicar:
- **Claridad numérica**: los números son el protagonista.
- **Estado visible**: qué versión está activa debe ser identificable en <200ms.
- **Confianza**: las acciones destructivas (activar, aplicar precio) tienen fricción intencional (confirmaciones).

No se introduce un nuevo design system. Se extiende el lenguaje existente de shadcn/ui (cards, tabs, tables, badges) con un toque de jerarquía tipográfica más agresiva en los montos clave.

### 2.2 Paleta y tokens

Usar los tokens existentes de Tailwind/shadcn:
- `--background`, `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`.

Tokens específicos para esta feature (agregar a `globals.css` o usar clases arbitrarias):

| Token | Uso |
|-------|-----|
| `text-emerald-600` / `bg-emerald-50` | Versión activa, delta positivo (precio actual > sugerido) |
| `text-amber-600` / `bg-amber-50` | Advertencias, delta negativo (precio actual < sugerido) |
| `text-rose-600` / `bg-rose-50` | Errores de validación, margen ≥ 100% |
| `border-dashed` | Campos calculados (no editables) |
| `ring-2 ring-primary ring-offset-2` | Foco en fila activa de la tabla de versiones |

### 2.3 Tipografía

- **Montos**: `text-lg font-semibold tabular-nums` (siempre `tabular-nums` para alineación decimal).
- **Labels**: `text-xs uppercase tracking-wide text-muted-foreground`.
- **Títulos de sección**: `text-sm font-medium`.
- **Precio sugerido destacado**: `text-2xl font-bold text-primary` dentro de su propio contenedor con fondo sutil (`bg-primary/5`).

### 2.4 Layout

#### Tab "Plantilla" (2 columnas en desktop, 1 en mobile)

```
┌──────────────────────────────────────────────┐
│  Plantilla activa                            │
│  ┌────────────────────────────────────────┐  │
│  │  Materiales                            │  │
│  │  • Madera  2 × 5.00 = 10.00            │  │
│  │  • Pintura 1 × 8.50 =  8.50            │  │
│  ├────────────────────────────────────────┤  │
│  │  Mano de obra        15.00             │  │
│  │  Indirectos           5.00             │  │
│  │  ─────────────────────────────────     │  │
│  │  Costo total         30.00             │  │
│  │  Margen objetivo     30%               │  │
│  │  ┌────────────────────────────────┐    │  │
│  │  │  Precio sugerido:   42.86 CUP  │    │  │
│  │  └────────────────────────────────┘    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Aplicar precio sugerido]  ← solo manager   │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  Historial de versiones                      │
│  ┌────────────────────────────────────────┐  │
│  │ v3  2024-05-01  30.00  [Activar]       │  │
│  │ v2  2024-04-15  28.50  [Activar]       │  │
│  │ v1  2024-03-01  25.00  ● Activa        │  │
│  └────────────────────────────────────────┘  │
│  [+ Nueva versión]                           │
└──────────────────────────────────────────────┘
```

#### Card de comparación en "Resumen"

Insertada como última fila del grid de `ResumenCosto` (o como card separada debajo):

```
┌─────────────────────────────────────────────────────┐
│  Comparación con plantilla activa (v2)              │
├──────────────────────┬──────────────────────────────┤
│  Costo real (ficha)  │  32.00 CUP                   │
│  Costo plantilla     │  30.00 CUP                   │
│  Diferencia          │  -2.00  (real mayor)         │
├──────────────────────┼──────────────────────────────┤
│  Precio venta actual │  45.00 CUP                   │
│  Precio sugerido     │  42.86 CUP                   │
│  Diferencia          │  +2.14  (venta por encima)   │
└──────────────────────┴──────────────────────────────┘
```

Colores de diferencia:
- Verde (`text-emerald-600`) cuando el precio de venta actual ≥ precio sugerido (margen protegido).
- Ámbar (`text-amber-600`) cuando el precio de venta actual < precio sugerido (riesgo de margen).

### 2.5 Animaciones y micro-interacciones

| Interacción | Implementación | Detalle |
|-------------|----------------|---------|
| **Cambio de tab a Plantilla** | CSS `animate-in fade-in slide-in-from-bottom-2 duration-300` | Lazy-load con `React.lazy` + `Suspense` para no bloquear la ficha principal |
| **Activar versión** | Optimistic UI + `useTransition` | El badge "Activa" se mueve con un `layout` animation (si se usa Framer Motion) o un simple fade con reordenamiento de lista |
| **Aplicar precio sugerido** | `disabled` + spinner en botón | Durante la mutación, el botón entra en estado `loading`. Al completar, un toast `success` aparece |
| **Fila activa en tabla** | `bg-primary/5` + `border-l-4 border-primary` | Destaque sutil pero inmediato |
| **Empty state** | Ilustración SVG inline + `animate-in zoom-in-95 duration-500` | Icono de documento vacío con líneas punteadas |

---

## 3. Decisiones de Diseño y Tradeoffs

### 3.1 Modelo único (Opción A) vs. Dos modelos (Opción B)

**Elegido**: Opción A.

| Criterio | A | B |
|----------|---|---|
| Complejidad | Baja | Media (joins, lógica de versión separada) |
| Queries | Simples | Requieren relación Template→Version |
| Extensibilidad futura | Agregar campos a la misma tabla | Mejor para metadatos de versión |
| Race condition activa | `@@unique` + transacción | `@@unique` + transacción |

**Tradeoff**: Si en el futuro se necesita guardar metadatos pesados por versión (PDF, firmas, aprobaciones), podría justificarse migrar a B. Por ahora, A es más simple y performante.

### 3.2 `Decimal` vs `Int` para campos monetarios

**Elegido**: `Decimal(10,2)` para campos de plantilla.

Aunque el modelo `Producto` usa `Int` para `precioCosto` y `precioVenta` (posiblemente por legacy o para evitar float en DB), el feature nuevo opera con precisión de 2 decimales y porcentajes de 4 decimales. `Decimal` evita errores de redondeo en el cálculo `costoTotal / (1 - margen)`.

**Tradeoff**: La serialización a JSON requiere atención. `serializePrismaData` probablemente convierte Decimal a string. Las actions deben convertir a `number` en el cliente si los componentes esperan `number`, o bien los componentes deben aceptar `string | number` y formatear con `Intl.NumberFormat`. **Decisión**: las actions retornan `number` (convertido vía `.toNumber()` o parse) para mantener compatibilidad con el resto del sistema, y el cálculo interno usa `Decimal`.

### 3.3 Materiales como `Json` vs tabla relacional

**Elegido**: `Json`.

Los materiales de la plantilla son un snapshot (no una relación viva a `Producto`). Si la receta cambia, la plantilla conserva los valores con los que fue creada. Una tabla relacional (`TemplateMaterial`) añadiría 1 join y 1 modelo sin beneficio funcional claro.

**Tradeoff**: No hay integridad referencial en DB para `productoId` dentro del JSON. Se mitiga validando los IDs al crear la plantilla (buscando que existan en el tenant) y almacenando también `nombre` denormalizado para display sin joins.

### 3.4 Soft-delete vs hard-delete

**Elegido**: Soft-delete (`deletedAt`).

Preserva la historia de versiones para auditoría. El spec lo exige explícitamente.

**Tradeoff**: Todas las queries deben incluir `deletedAt: null`. Se puede crear un helper Prisma middleware o simplemente recordarlo en cada action. Dado que es un feature pequeño, se filtra manualmente.

### 3.5 Permisos

- **Ver plantilla**: `requireFeature(user, 'productos', 'ver la ficha de costo')` (mismo que ficha).
- **Crear/editar/activar/eliminar plantilla**: `requireFeature` + `requireManagerRole` para escritura.
- **Aplicar precio sugerido**: `requireManagerRole(user, 'aplicar precio sugerido')` explícitamente.

**Tradeoff**: El spec menciona `products:edit-price`. Si ese permiso existe en el sistema, se puede usar. De lo contrario, se usa `requireManagerRole` como guardián de acciones destructivas.

### 3.6 Dónde calcular `costoTotal` y `precioSugerido`

**Elegido**: Cálculo 100% en Server Action.

El cliente envía los inputs crudos (`materiales`, `manoObra`, `indirectos`, `margenObjetivo`). El servidor calcula y persiste `costoTotal` y `precioSugerido`. Esto evita:
- Manipulación del cliente.
- Divergencia de lógica entre cliente y servidor.

**Tradeoff**: No hay preview de precio sugerido en tiempo real mientras se edita el formulario. Para mitigar, se puede agregar un botón "Vista previa" en el formulario que llame a una action de cálculo sin persistir, o se puede calcular en el cliente con un disclaimer. **Decisión**: para la primera versión, el cálculo es en submit. Si el UX lo requiere, se agrega `previewPlantillaAction` posteriormente.

### 3.7 Integración con `ResumenCosto`

**Elegido**: Card de comparación condicional debajo del grid de stats.

No se modifica la estructura del grid existente (3 columnas) para no romper el layout establecido. La comparación aparece como una card adicional que ocupa el ancho completo.

---

## 4. Testing Strategy

### 4.1 Tests de Server Actions (`actions-plantilla.test.ts`) — 8+ tests

1. `getPlantillasAction` — retorna versiones ordenadas DESC excluyendo soft-deleted.
2. `getPlantillaActivaAction` — retorna null si no hay activa.
3. `createPlantillaAction` — asigna version auto-incremental.
4. `createPlantillaAction` — calcula costoTotal y precioSugerido correctamente.
5. `createPlantillaAction` — rechaza crear para producto de otro tenant (NOT_FOUND).
6. `activarPlantillaAction` — desactiva la anterior y activa la nueva (transaccional).
7. `deletePlantillaAction` — soft-delete exitosa de plantilla inactiva.
8. `deletePlantillaAction` — rechaza eliminar plantilla activa (`CANNOT_DELETE_ACTIVE_TEMPLATE`).
9. `aplicarPrecioSugeridoAction` — actualiza precioVenta y crea audit log.
10. `aplicarPrecioSugeridoAction` — no-op si precio actual ya coincide.

### 4.2 Tests de cálculo (`template-calc.test.ts`)

1. Cálculo con margen 30% → resultado esperado.
2. Margen 0% → precio = costo.
3. Margen 100% → error `INVALID_MARGIN`.
4. Margen negativo → error.
5. Precisión decimal (evitar `0.1 + 0.2 !== 0.3`).

### 4.3 Tests de UI (`plantilla-tab.test.tsx`) — 4+ tests

1. Renderiza empty state cuando no hay plantillas.
2. Renderiza plantilla activa con desglose de materiales y precio sugerido.
3. Lista versiones y muestra botón "Activar" solo en inactivas.
4. Botón "Aplicar precio sugerido" visible solo para manager (mock de `useUser` o prop).
5. Confirmación de activación dispara `activarPlantillaAction`.

---

## 5. Plan de Migración

1. **Prisma**: Agregar modelo a `schema.prisma`.
2. **Generar migración**: `pnpm prisma migrate dev --name add_cost_sheet_template`.
3. **Seed de permisos** (si aplica): asegurar que el feature key `productos` esté disponible en planes.
4. **Deploy**: migración primero, luego deploy del frontend.
5. **Rollback**: si hay problemas, el feature es aditivo; eliminar migración y revertir código.

---

## 6. Checklist de Diseño

- [ ] Schema Prisma actualizado con relaciones.
- [ ] `actions-plantilla.ts` creado con todas las actions y transacciones.
- [ ] `template-calc.ts` con lógica de cálculo y validaciones.
- [ ] Tipos en `types-plantilla.ts` o mergeados a `types.ts`.
- [ ] `ficha-costo-view.tsx` con tab "Plantilla".
- [ ] `resumen-costo.tsx` con `ComparacionPlantillaCard`.
- [ ] Componentes de plantilla creados y con JSDoc.
- [ ] Tests unitarios de actions, cálculo y UI.
- [ ] Audit log en `aplicarPrecioSugeridoAction`.
- [ ] Manejo de error `P2002` en `activarPlantillaAction` mapeado a mensaje amigable.

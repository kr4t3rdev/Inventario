# Design: Migrar Productos a Server Components

## Technical Approach

La migración se hará en dos capas: primero corregir la base funcional de Productos y después mover la obtención de datos al server. La página `/busy/products` dejará de ser `use client` y pasará a ser Server Component para resolver el listado inicial y los catálogos base. La UI rica se mantendrá como client islands: `ProductosForm`, `EnhancedDataTable`, `ProductFilters` y los dialogs seguirán siendo client, pero recibirán datos ya resueltos desde server o desde helpers compartidos.

El cleanup previo es obligatorio: `RestockHistoryDialog` no puede seguir dependiendo de un hook RTK inexistente, y `updateProductoAction` debe ser atómica antes de tocar más piezas del árbol.

## Architecture Decisions

### Decision: Server Component para el page shell, client islands para interacción

**Choice**: `src/app/busy/products/page.tsx` será Server Component y pasará props al árbol client.

**Alternatives considered**:
- Mantener todo como Client Component: rechazado porque perpetúa el fetch client-side y el bundle grande.
- Volver todo Server Component: rechazado porque tabla, formularios, modales y filtros necesitan interactividad local.

**Rationale**: la página principal es composición + datos. La interacción rica debe quedar aislada en componentes cliente pequeños.

### Decision: Arreglar el historial de restock con contrato server/shared, no con RTK Query

**Choice**: `RestockHistoryDialog` dejará de depender del hook inexistente y consumirá un contrato server/shared estable.

**Alternatives considered**:
- Crear un nuevo slice RTK Query: rechazado porque va contra el objetivo server-first.
- Hacer fetch directo desde el dialog client: rechazado porque mantiene la dependencia del browser.

**Rationale**: el historial debe provenir del server para reducir JS, evitar duplicación de lógica y alinear la feature con Server Components.

### Decision: Encapsular `updateProductoAction` en una transacción

**Choice**: usar `prisma.$transaction` para agrupar validación de existencia, upserts de precios y update del producto.

**Alternatives considered**:
- Dejar la lógica separada: rechazado porque deja escrituras parciales.
- Dividir en múltiples acciones: rechazado porque rompe atomicidad y complica el UI.

**Rationale**: las escrituras de producto y precios forman una sola unidad de negocio.

### Decision: Mantener `ProductosForm` como Client Component

**Choice**: el formulario seguirá siendo client-side, pero con catálogos y defaults precargados desde server.

**Alternatives considered**:
- Migrarlo completo a server: rechazado porque usa React Hook Form, toasts, previews y eventos interactivos.
- Dejar todos los fetches dentro del form: rechazado porque contradice server-first.

**Rationale**: el form necesita estado local; lo que debe salir del cliente es la obtención de datos base.

## Data Flow

```text
Server request
  ↓
/busy/products/page.tsx (Server Component)
  ↓ prisma / server actions / server helpers
  ↓ initial props
Client islands:
  - EnhancedDataTable
  - ProductFilters
  - ProductosForm
  - RestockHistoryDialog
  - CostHistoryDialog
```

### Historial de restock

```text
RestockHistoryDialog (client shell)
  ↓
server/shared history contract
  ↓
RestockHistory (presentation)
```

### Update de producto

```text
updateProductoAction(input)
  ↓
validate → requireTenant → $transaction
  ↓
producto + precios actualizados atómicamente
  ↓
revalidatePath('/busy/products')
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/products/page.tsx` | Modify | Convertir a Server Component y resolver datos iniciales en server |
| `src/features/productos/actions.ts` | Modify | Hacer atómica `updateProductoAction` y ajustar helpers |
| `src/features/productos/schemas.ts` | Modify | Alinear contratos que usen historial/update si hace falta |
| `src/features/productos/components/restock-history-dialog.tsx` | Modify | Eliminar dependencia RTK inexistente y usar contrato server/shared |
| `src/features/productos/components/restock-history.tsx` | Modify | Consumir data ya resuelta, sin depender de RTK Query |
| `src/features/productos/components/productos-form.tsx` | Modify | Recibir catálogos y defaults desde server |
| `src/features/productos/components/enhanced-data-table.tsx` | Modify | Mantener interacción client-only sobre datos server-provided |
| `src/features/productos/components/product-filters.tsx` | Modify | Mantener filtros controlados con props precargadas |
| `src/features/productos/api/*` | Modify/Remove | Depurar hooks RTK de Productos cuando queden sin consumidores |
| `src/lib/restock-utils.ts` o helper equivalente | Modify/Create | Extraer lógica compartida del historial si hace falta |

## Interfaces / Contracts

```typescript
interface RestockHistoryResponse {
  history: RestockHistoryItem[];
  summary: {
    totalRestocks: number;
    totalQuantityAdded: number;
    totalCostSpent: number;
    averageCostPerRestock: number;
    priceChanges: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `updateProductoAction` transaccional | Vitest con mocks de Prisma y tenant |
| Unit | contrato de historial de restock | Vitest sobre helper/shared contract |
| Integration | page de products como Server Component | render server-side y props de initial data |
| Integration | `ProductosForm` con datos precargados | Testing Library para verificar que no fetchee catálogos |
| E2E | flujo de productos | Playwright para create/edit/restock en la nueva estructura |

## Migration / Rollout

1. Corregir issues funcionales (historial + transacción).
2. Convertir el page shell a Server Component.
3. Pasar catálogos/datos base al árbol client.
4. Reducir RTK Query residual.
5. Validar con typecheck y tests focalizados.

No hay migración de datos.

## Open Questions

- [ ] ¿El historial de restock se servirá como props server-side o como contrato shared consumido por un client dialog?
- [ ] ¿Cuánto del listado de productos debe resolverse en server antes de que los filtros pasen a query params?

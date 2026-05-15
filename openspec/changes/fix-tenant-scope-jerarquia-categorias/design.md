# Design: Tenant isolation en jerarquía de categorías

## Technical Approach

Agregar el filtro de `tenantId` en `getCategoriaHierarchyAction` usando el mismo patrón que el resto de las acciones del archivo: `requireTenant(user)` + `where: { tenantId }` en el `prisma.categoria.findMany`.

Este es el enfoque más mínimo posible — una línea de código que cierra la fuga de datos multi-tenant.

## Architecture Decisions

### Decision: Ubicación del filtro

**Choice**: Agregar `where: { tenantId }` directamente en `getCategoriaHierarchyAction`

**Alternatives considered**:
- Crear un middleware separado de tenant-scope para hierarchy
- Usar `scopedWhere()` helper de `@/lib/services/tenant-scope`

**Rationale**: El patrón existente en las otras 4 acciones del mismo archivo usa `requireTenant(user)` + `where: { tenantId }` inline. Cambiar solo esta acción mantiene consistencia con el resto del archivo. `scopedWhere()` es útil cuando hay múltiples condiciones en el where, acá solo necesitamos una.

### Decision: No corregir API route legacy

**Choice**: Dejar `getCategoriasHierarchyHandler` en `handlers.ts` sin cambios

**Rationale**: El handler legacy está siendo reemplazado por Server Actions. Según las convenciones del proyecto (`AGENTS.md`), las API routes solo se mantienen para exportación de archivos e integraciones externas. Corregirlo ahora sería invertir esfuerzo en código que se va a eliminar.

### Decision: Mantener `_user` como parámetro

**Choice**: No cambiar la firma de la función; usar el parámetro `user` que ya existe (actualmente ignorado como `_user`)

**Rationale**: `withAction` ya pasa el usuario autenticado; solo necesitamos usarlo en lugar de ignorarlo.

## Data Flow

```
Cliente (page.tsx / category-hierarchy-tree.tsx)
    │
    └─→ getCategoriaHierarchyAction(void)
            │
            ├─→ withAction() verifica auth ✓
            │
            ├─→ requireTenant(user) → tenantId
            │
            ├─→ prisma.categoria.findMany({
            │       where: { tenantId },    ← NUEVO
            │       select: HIERARCHY_SELECT
            │   })
            │
            └─→ Retorna jerarquía filtrada
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/features/categorias/actions.ts` | Modificar | Agregar `const tenantId = requireTenant(user)` y `where: { tenantId }` en `getCategoriaHierarchyAction` (línea 131-137) |
| `src/features/categorias/__tests__/actions.test.ts` | Modificar | Agregar aserción que verifique `tenantId: 'tenant-test'` en el test `'retorna jerarquía de categorías del tenant'` (línea 154-162) |

## Interfaces / Contracts

No hay cambios de interfaz. La función mantiene su firma:

```typescript
export const getCategoriaHierarchyAction = withAction(
  async (_input: void, user: AuthenticatedUser) => { ... }
)
```

El tipo de retorno (`ActionResponse<CategoriaHierarchy[]>`) no cambia.

## Testing Strategy

| Test | Archivo | Qué verificar |
|------|---------|---------------|
| Unit: filtro tenantId | `actions.test.ts` | `prisma.categoria.findMany` fue llamado con `where: { tenantId: 'tenant-test' }` |
| Unit: jerarquía retornada | `actions.test.ts` | `result.data` contiene datos (test existente) |
| Unit: auth requerido | `actions.test.ts` | Si `getCurrentUser()` retorna null, `success: false` (ya cubierto por `withAction`) |

## Migration / Rollout

No requiere migración de datos. Es un fix de seguridad que solo afecta consultas. Los tenants verán menos datos (solo los suyos) pero correctos.

Rollback: `git revert <commit>` — solo 2 archivos tocados.

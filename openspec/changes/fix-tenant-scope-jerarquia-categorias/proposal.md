# Proposal: Tenant isolation en jerarquía de categorías

## Intent

`getCategoriaHierarchyAction` no filtra por `tenantId`, lo que expone las categorías de **todos los tenants** a cualquier usuario autenticado. Las otras acciones del mismo archivo (`getCategoriasAction`, `createCategoriaAction`, `updateCategoriaAction`, `deleteCategoriaAction`) sí lo hacen. Esto es una violación del aislamiento multi-tenant.

## Scope

### In Scope
- Corregir `getCategoriaHierarchyAction` en `src/features/categorias/actions.ts` para filtrar por `tenantId`
- Actualizar el test existente en `__tests__/actions.test.ts` para verificar el filtro de tenant
- Opcional: corregir `getCategoriasHierarchyHandler` en el API handler legacy si aplica

### Out of Scope
- Cambios a otras Server Actions o features (ya filtran correctamente)
- Migración de datos existentes
- Cambios en la UI (el componente se comporta igual, solo recibe menos datos)
- Refactor del handler legacy de API (está en proceso de migración a Server Actions)

## Capabilities

### Modified Capabilities
- `catalogo`: consulta de jerarquía de categorías con aislamiento de tenant

## Approach

1. En `getCategoriaHierarchyAction`, agregar `const tenantId = requireTenant(user)` y pasar `where: { tenantId }` al `prisma.categoria.findMany`
2. En el test, agregar `expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-test' }) })` para verificar que el filtro se aplica
3. Ejecutar tests existentes para confirmar que no se rompe nada

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/features/categorias/actions.ts` | Modificado | Agregar filtro tenantId en `getCategoriaHierarchyAction` |
| `src/features/categorias/__tests__/actions.test.ts` | Modificado | Agregar aserción de tenantId en test de hierarchy |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Romper componente que espera datos de otros tenants | Baja | El componente `CategoryHierarchyTree` ya muestra error si la action falla; con el fix solo ve sus propias categorías |
| La API route legacy tiene el mismo bug | Media | Documentado en hallazgos; queda como deuda técnica fuera de scope |

## Rollback Plan

- Revertir el commit del cambio (solo 2 archivos tocados)
- No hay migración de datos ni cambios de esquema

## Success Criteria

- [ ] `getCategoriaHierarchyAction` filtra por `tenantId` en el `where` de Prisma
- [ ] El test existente `'retorna jerarquía de categorías del tenant'` verifica el filtro
- [ ] Todos los tests de `src/features/categorias/__tests__/actions.test.ts` pasan

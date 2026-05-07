# Proposal: Feature-Based Migration — Gestión

## Intent

Migrar 8 features del dominio de Gestión (Productos, Categorías, Unidades, Almacenes, Puntos de Venta, Listas de Precios, Proveedores, Clientes) de la organización por capas técnicas a organización por feature (Feature-Based Architecture), siguiendo el patrón establecido con la feature VENTAS como POC.

**Problema actual**: Lógica de negocio dispersa entre `app/api/`, `components/`, `lib/redux/services/`, `lib/services/`. Para modificar una feature hay que tocar 5+ directorios distintos.

**Solución**: Colocar todo el código de una feature bajo `src/features/<feature>/`, dejando `app/api/` como pasamanos (thin wrappers) y re-exports para backward compatibility.

## Scope

### In Scope
1. **Productos** — API route (572 líneas), Redux slice, ~10 componentes
2. **Categorías** — API route (100 líneas), Redux slice, ~6 componentes, 2 hooks
3. **Unidades** — API route (45 líneas), Redux slice, ~2 componentes
4. **Almacenes** — API route (50 líneas), Redux slice, ~2 componentes
5. **Puntos de Venta** — API route (36 líneas), Redux slice, ~2 componentes
6. **Listas de Precios** — API route (73 líneas), Redux slice, ~2 componentes
7. **Proveedores (Vendors)** — API route (111 líneas), Redux slice, ~2 componentes
8. **Clientes** — API route (54 líneas), Redux slice, ~2 componentes

Para cada feature:
- Extraer lógica de negocio de `route.ts` → `features/<feature>/api/handlers.ts`
- Adelgazar `app/api/<feature>/route.ts` a <15 líneas
- Mover Redux slice a `features/<feature>/api/<feature>Api.ts` con re-export en ubicación vieja
- Crear `features/<feature>/types.ts` e `index.ts`
- Actualizar tests existentes (o crear nuevos)

### Out of Scope
- Features de Contabilidad, Compras, Empleados, etc. (futuras fases)
- Refactorizar lógica de negocio (solo moverla)
- Agregar nuevos tests (solo migrar/mantener existentes)
- Cambiar comportamiento de endpoints (preservar 1:1)

## Approach

1. **Pattern**: Feature-Based Architecture con Thin App Directory (ya validado con VENTAS)
2. **Strategy**: Migrar feature por feature, en orden de menor a mayor complejidad (Puntos de Venta → Clientes → Vendors → Unidades → Almacenes → Listas de Precios → Categorías → Productos)
3. **Backward compat**: Re-exports en ubicaciones viejas para no romper 111+ imports
4. **Verification**: Después de cada feature: `npx vitest run <tests>`, `pnpm run lint`, `git commit`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/<feature>/route.ts` (8 archivos) | Modified | Adelgazados a pasamanos (<15 líneas) |
| `src/app/api/<feature>/[id]/route.ts` (8 archivos) | Modified | Adelgazados a pasamanos |
| `src/features/<feature>/api/handlers.ts` (8 archivos) | New | Lógica de negocio extraída |
| `src/features/<feature>/api/<feature>Api.ts` (8 archivos) | New | Redux RTK Query slices |
| `src/features/<feature>/types.ts` e `index.ts` (16 archivos) | New | Tipos y API pública |
| `src/lib/redux/services/<feature>Api.*` (8 archivos) | Modified | Re-exports al nuevo feature |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tests rotos por mocks de prisma (default vs named export) | Medium | Mismos mocks que VENTAS: exportar ambos `default` y `prisma` |
| Componentes con imports relativos rotos al copiar | Medium | Actualizar `../../` a `@/` en copias |
| Pre-existing type errors (tenantId) confunden | Low | Filtrar typecheck por `src/features/` para ver solo errores nuevos |
| Re-export circular si un feature importa a otro | Low | Verificar grafo de dependencias antes de mover |

## Rollback Plan

1. `git revert <commit>` por feature si algo se rompe
2. Los re-exports en ubicaciones viejas permiten rollback parcial sin afectar consumers
3. Los archivos originales de `app/api/<feature>/route.ts` se pueden regenerar desde `handlers.ts`

## Dependencies

- POC de VENTAS ya completado y validado (10 tests pasando)
- Patrón de Thin App Directory + Re-exports confirmado

## Success Criteria

- [ ] Las 8 features migradas a `src/features/`
- [ ] Todos los `app/api/<feature>/route.ts` tienen <20 líneas
- [ ] Tests pasan para cada feature después de migrar
- [ ] `pnpm run lint` pasa para cada feature
- [ ] Re-exports existen en ubicaciones viejas (no imports rotos)
- [ ] 8 commits separados, uno por feature

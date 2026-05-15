# Proposal: Completar Migración a Server Actions + Eliminar Legacy

## Intent

El proyecto ya tiene Server Actions en **43 features** (gracias a la migración piloto previa), pero conviven con **32 handlers legacy** (`api/handlers.ts`), **90+ API routes** (`app/api/`), y **Redux/RTK Query**. Esta propuesta completa la migración: eliminar handlers redundantes, remover Redux, y dejar el proyecto 100% Server Actions + Server Components.

**Estado actual**: 🏗️ Híbrido (SA + handlers + Redux coexistiendo)
**Estado deseado**: ✅ Solo Server Actions + Server Components + infraestructura mínima (upload, exchange, health)

## Scope

### In Scope

1. **Eliminar handlers legacy redundantes** — features donde SA ya cubren 100% de la funcionalidad
2. **Migrar handlers con lógica extra** — features donde SA existen pero handlers tienen funcionalidad no migrada
3. **Eliminar Redux/RTK Query** — productoSlice (dead code), themeSlice (CSS), contabilidadSlice (useState), apiSlice (sin endpoints reales), prestamosCashApi (→ SA)
4. **Eliminar ReduxProvider, store, hooks** — una vez que no haya consumidores
5. **Migrar componentes cliente → servidor** — después de eliminar Redux

### Out of Scope

- No migrar API routes de infraestructura (`/api/upload`, `/api/exchange`, `/api/health`, `/api/metrics`, `/api/image`)
- No cambiar modelos Prisma ni base de datos
- No modificar lógica de negocio (solo el transporte)
- No migrar el POS (punto de venta) — por su naturaleza interactiva sigue siendo Client Component
- No migrar lógica de generación de PDF/archivos que dependa de API routes con response streaming

## Approach

### Fase 0: Dead Code
- Eliminar `productoSlice.tsx` (0 líneas, vacío)

### Fase 1: Handlers → SA por lotes
- **Lote A (bajo riesgo)**: Features con SA que cubren TODO lo que hace el handler
  - `categorias` — caso de validación, handlers son 100% duplicados
- **Lote B (riesgo medio)**: Features con SA + handlers con lógica extra
  - `productos`, `ventas`, `clientes`, `almacenes`, `empleados`, etc.
- **Lote C (alto riesgo)**: Contabilidad
  - Handler de 525+ líneas con lógica financiera compleja

### Fase 2: Redux → Estado Local
- Eliminar `productoSlice.tsx` ✅ (Fase 0)
- Migrar `themeSlice` → CSS `prefers-color-scheme` + localStorage
- Migrar `contabilidadSlice` → URL search params (filtros) + useState (loading, error) + Server Actions directas (data)
- Eliminar `ReduxProvider`, `store.tsx`, `hooks.ts`
- Migrar `prestamosCashApi` → Server Actions directas

### Fase 3: Server Components
- Reevaluar `'use client'` en componentes que solo usaban Redux
- Convertir a Server Components donde sea posible

## Affected Areas

| Area | Impact | Prioridad |
|------|--------|-----------|
| `src/features/*/api/handlers.ts` | Eliminar (32 archivos) | Alta |
| `src/app/api/**/route.ts` | Eliminar (excepto infraestructura) | Alta |
| `src/lib/redux/` | Eliminar completo (7 archivos) | Media |
| `src/features/contabilidad/slices/` | Eliminar | Media |
| `src/features/*/components/` | Reevaluar 'use client' | Baja |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Handler tiene lógica no replicada en SA | Media | Verificar feature por feature antes de eliminar |
| Componente legacy sigue llamando a API route | Baja | Feature flag temporal: SA + handler coexistiendo |
| API route usada externamente | Baja | Agregar advertencia y mantener endpoints documentados |
| RTK Query cache invalidation perdida | Baja | `revalidatePath`/`revalidateTag` en cada SA mutation |
| Contabilidad: reportes financieros en handler no migrados | Alta | Dejar contabilidad para el final, migrar con cuidado |

## Priorización

```
Fase 0 ───── productoSlice (dead code) ───── 1 commit
Fase 1A ──── categorias (handlers → SA) ──── 1 commit  
Fase 1B ──── features restantes (handlers) ── 3-5 commits
Fase 1C ──── contabilidad (handler pesado) ── 2-3 commits
Fase 2 ───── eliminar Redux completo ──────── 1-2 commits
Fase 3 ───── Server Components ────────────── 2-3 commits
```

## Success Criteria

- [ ] Todos los handlers legacy eliminados
- [ ] Redux/RTK Query eliminado del proyecto
- [ ] `ReduxProvider` eliminado del layout
- [ ] Sin `useAppSelector`/`useAppDispatch` en features
- [ ] Tests pasan después de cada fase
- [ ] Build de producción exitoso
- [ ] Sin regresiones funcionales en features migradas

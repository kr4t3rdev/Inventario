# Design: Migración Completa a Server Actions

## Decisiones Técnicas

### D1: Verificación pre-eliminación de handlers
**Problema**: ¿Cómo saber si un handler es 100% reemplazable por SA sin romper nada?
**Decisión**: Por cada handler, ejecutar estos checks:
1. ¿Existe SA que exponga la misma operación? (mismos parámetros, mismo return type)
2. ¿Hay componentes que importen el handler o la API route directamente? (grep de imports)
3. ¿Hay clientes externos que consuman la ruta? (revisar analytics/logs si existen)
4. ¿El handler tiene lógica adicional no presente en SA?
**Si todos los checks pasan → eliminar handler y route.**

### D2: Mantener handlers durante transición
**Problema**: Eliminar un handler puede romper componentes que todavía lo usan.
**Decisión**: No eliminar handlers hasta que:
1. La SA que lo reemplaza esté en producción funcionando
2. Todos los componentes que llamaban al handler hayan sido actualizados
3. Los tests pasen sin el handler
4. Build exitoso sin el handler
**Rollback**: `git revert` del commit que elimina el handler.

### D3: Reemplazo de contabilidadSlice
**Decisión**: Dividir el estado en 3 capas independientes:
- **URL search params**: `selectedCuentaId`, `filtros` (fechaInicio, fechaFin, cuentaId, tipo)
- **useState local**: loading, error (por componente)
- **Server Actions**: data fetching (cuentas, monedas, tasas, reconciliaciones)
**No usar Context ni estado global compartido.** Cada página/componente obtiene sus propios datos.

### D4: Tema (themeSlice) → next-themes
**Problema**: El themeSlice maneja light/dark mode en Redux.
**Decisión**: Usar `next-themes` (ya preparado para Next.js App Router):
- Soporta `prefers-color-scheme` automático
- Persiste en localStorage
- No requiere Redux
- API simple: `useTheme()` hook
- Tailwind `dark:` classes ya funcionan

### D5: RTK Query prestamosCashApi → SA wrapper
**Decisión**: Migrar cada endpoint a su propia Server Action en `src/features/contabilidad/actions-prestamos-cash.ts`:
- `getPrestamosCashAction(params?)`
- `getPrestamosCashStatsAction()`
- `getPrestamoCashAction(id)`
- `createPrestamoCashAction(input)`
- `updatePrestamoCashAction(id, data)`
- `registrarPagoPrestamoAction(id, data)`
Cada SA usa `withAction` + `requireTenant` + Zod validation.

### D6: Contabilidad handler (525 líneas)
**Decisión**: Dejar para el final. El handler tiene:
- Reporte de movimientos (getMovimientosReport) → migrar a SA con URL params
- Exportación PDF de movimientos → mantener API route (usa pdf-lib, response streaming)
- Cierres contables → SA ya existe en `actions-cierres.ts`
- Anticipos workflow → SA ya existe en `actions-anticipos.ts`
**Estrategia**: Migrar las queries a SA primero, dejar las rutas de exportación PDF como API routes.

### D7: API routes de infraestructura
**Decisión**: Conservar como API routes:
| Ruta | Razón |
|------|-------|
| `/api/upload` | File upload necesita multipart/form-data, SA no lo soporta bien |
| `/api/exchange` | Proxy a API externa, no hay SA que reemplace |
| `/api/health` | Health check necesita endpoint HTTP público |
| `/api/metrics` | Métricas de sistema |
| `/api/image` | Servir imágenes almacenadas |

## Arquitectura Post-Migración

```
ANTES:
Componente (useClient) → fetch('/api/...') → handler.ts → Prisma
Componente (useClient) → RTK Query hook → fetch('/api/...') → handler.ts → Prisma
Componente (Client) → useAppSelector(Redux) → slice → (data de handler previo)
Layout → ReduxProvider → store → slices + apiSlice + middleware

DESPUÉS:
Server Component → await getXxxAction() → Prisma (sin HTTP, sin JS)
Client Component (solo interactivo) → useState/useEffect → getXxxAction() → Prisma
Theme → next-themes (CSS + localStorage)
Filtros → URL search params
Loading/Error → useState local
```

## Archivos a Modificar por Fase

### Fase 0: Dead Code (1 archivo)
| Archivo | Acción |
|---------|--------|
| `src/lib/redux/slices/productoSlice.tsx` | Eliminar |

### Fase 1A: Categorías (2 archivos)
| Archivo | Acción |
|---------|--------|
| `src/features/categorias/api/handlers.ts` | Eliminar |
| `src/app/api/categorias/**/route.ts` | Eliminar (si existe) |

### Fase 1B: Features restantes (~30 archivos)
| Archivos | Acción |
|----------|--------|
| `src/features/*/api/handlers.ts` | Verificar + Eliminar |
| `src/app/api/*/**/route.ts` | Verificar + Eliminar |

### Fase 1C: Contabilidad handler (~10 archivos)
| Archivos | Acción |
|----------|--------|
| `src/features/contabilidad/api/handlers.ts` | Migrar queries a SA, mantener PDF |
| `src/app/api/contabilidad/**/route.ts` | Eliminar (excepto PDF/exports) |

### Fase 2: Redux (~15 archivos)
| Archivo | Acción |
|---------|--------|
| `src/lib/redux/store.tsx` | Eliminar |
| `src/lib/redux/provider.tsx` | Eliminar |
| `src/lib/redux/hooks.ts` | Eliminar |
| `src/lib/redux/services/apiSlice.tsx` | Eliminar |
| `src/lib/redux/services/prestamosCashApi.tsx` | Migrar a SA + Eliminar |
| `src/lib/redux/slices/contabilidadSlice.tsx` | Eliminar |
| `src/lib/redux/slices/themeSlice.tsx` | Eliminar |
| `src/lib/redux/selectors/contabilidadSelectors.ts` | Eliminar |
| `src/lib/redux/utils/contabilidadUtils.ts` | Mover a `src/features/contabilidad/utils/` |
| `src/lib/redux/contabilidad/index.ts` | Eliminar |
| `src/features/contabilidad/slices/contabilidadSlice.ts` | Eliminar |
| `src/lib/redux/provider.tsx` (import en layout) | Eliminar del layout |
| `package.json` | Remover `@reduxjs/toolkit`, `react-redux` |

**Total: ~50 archivos eliminados o migrados.**

## Testing Strategy

| Aspecto | Enfoque |
|---------|---------|
| SA existentes | Tests ya existen, deben seguir pasando |
| Redux → SA | Tests unitarios de SA cubren la lógica |
| Handlers eliminados | Verificar que tests no referencien handlers |
| Regresión | `pnpm run test:run` y `pnpm run build` después de cada commit |
| Contabilidad | Tests manuales de reportes financieros post-migración |

## Rollback Plan

- Cada fase es un commit independiente → `git revert <commit>` por fase
- Fase 0 (dead code): riesgo mínimo, rollback trivial
- Fase 1A-1C: mantener handlers durante transición, eliminar solo después de verificar
- Fase 2: Redux es el más risky porque toca el layout y provider. Hacer último.
- Si algo falla: restaurar handlers + routes desde git, deshacer eliminación de Redux

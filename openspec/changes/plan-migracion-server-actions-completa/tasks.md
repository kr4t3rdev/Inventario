# Tasks: Plan de Migración Completa a Server Actions

> **Nota**: Este cambio es un **plan de acción**. Las tasks definen qué hacer y en qué orden. La implementación real de cada task será un cambio SDD independiente.

---

## Review Workload Forecast

- **Total estimated changes**: ~50 files affected across all phases
- **400-line budget risk**: High (each phase individually < 400 lines, but aggregate is 1500+)
- **Chained PRs recommended**: Yes — each phase is an independent slice
- **Decision needed before apply**: No (this is a planning change with commits per phase)

**Strategy**: Each phase below is designed as an independent, reviewable work unit. Implement one phase at a time, verify, then proceed.

---

## Fase 0: Dead Code Removal (1 archivo, ~5 min)

**Dependencies**: None
**Risk**: Minimal

- [ ] **0.1** Eliminar `src/lib/redux/slices/productoSlice.tsx` (archivo vacío, 0 líneas)
- [ ] **0.2** Verificar que no haya imports rotos: `grep -r "productoSlice" src/`
- [ ] **0.3** `pnpm run build` → OK
- [ ] **0.4** `pnpm run test:run` → OK

---

## Fase 1A: Categorías — Handlers → SA (2 archivos, ~15 min)

**Dependencies**: Fase 0
**Risk**: Low (handlers 100% duplicados por SA)

### Verificación pre-eliminación
- [ ] **1A.1** Verificar que `categorias/actions.ts` cubre TODAS las operaciones de `categorias/api/handlers.ts`:
  - `getCategoriasHandler` ↔ `getCategoriasAction` ✅
  - `createCategoriaHandler` ↔ `createCategoriaAction` ✅
  - `getCategoriaByIdHandler` ↔ `getCategoriaByIdAction` ✅
  - `updateCategoriaHandler` ↔ `updateCategoriaAction` ✅
  - `deleteCategoriaHandler` ↔ `deleteCategoriaAction` ✅
  - `getCategoriasHierarchyHandler` ↔ `getCategoriaHierarchyAction` ✅ (ya fixeado)
  - `validateCategoriaHandler` — validación ya existe en schemas + SA
- [ ] **1A.2** Buscar imports de handlers: `grep -r "categorias/api/handlers" src/`
- [ ] **1A.3** Buscar API routes de categorías: `ls src/app/api/categorias*/**`

### Eliminación
- [ ] **1A.4** Eliminar `src/features/categorias/api/handlers.ts`
- [ ] **1A.5** Eliminar API routes de categorías en `src/app/api/categorias/**`
- [ ] **1A.6** Eliminar barrel exports si existen

### Verificación
- [ ] **1A.7** `pnpm run build` → OK
- [ ] **1A.8** `pnpm run test:run` → OK
- [ ] **1A.9** Navegar manualmente a categorías en UI → funciona

---

## Fase 1B: Features Restantes — Handlers → SA (20-30 archivos, ~2-3h)

**Dependencies**: Fase 1A (validar proceso)
**Risk**: Medium

### Features a migrar (por orden sugerido)

| Orden | Feature | Handlers | SA | Riesgo |
|-------|---------|----------|----|--------|
| 1 | `unidades` | CRUD básico | ✅ Completa | Bajo |
| 2 | `almacenes` | CRUD básico | ✅ Completa | Bajo |
| 3 | `vendors` | CRUD básico | ✅ Completa | Bajo |
| 4 | `clientes` | CRUD básico | ✅ Completa | Bajo |
| 5 | `series-facturacion` | CRUD básico | ✅ Completa | Bajo |
| 6 | `puntos-venta` | CRUD básico | ✅ Completa | Bajo |
| 7 | `listas-precios` | CRUD básico | ✅ Completa | Bajo |
| 8 | `ofertas` | CRUD básico | ✅ Completa | Bajo |
| 9 | `mermas` | CRUD + stats | ✅ Completa | Medio |
| 10 | `notificaciones` | CRUD + stock check | ✅ Completa | Medio |
| 11 | `transferencias` | CRUD + notii + confirmar | ✅ Completa | Medio |
| 12 | `perfil` | CRUD | ✅ Completa | Bajo |
| 13 | `planes` | CRUD | ✅ Completa | Bajo |
| 14 | `licencias` | CRUD + generar + validar | ✅ Completa | Medio |
| 15 | `dashboard` | Queries agregadas | ✅ Completa | Medio |
| 16 | `facturas` | CRUD | ✅ Completa | Bajo |
| 17 | `gastosDE` | CRUD + conceptos | ✅ Completa | Medio |
| 18 | `cuadre-diario` | CRUD | ✅ Completa | Bajo |
| 19 | `pago-salario` | CRUD | ✅ Completa | Bajo |
| 20 | `reportes-financieros` | Query compleja | ✅ Completa | Medio |
| 21 | `empleados` | CRUD + nómina + asistencia + vacaciones | ✅ Completa | Alto |
| 22 | `contratos` | CRUD + versiones + firmas + archivos | ✅ Completa | Alto |
| 23 | `compras-productos` | CRUD | ✅ Completa | Bajo |
| 24 | `compras-servicios` | CRUD | ✅ Completa | Bajo |
| 25 | `ventas` | CRUD | ✅ Completa | Medio |
| 26 | `venta-servicios` | CRUD | ✅ Completa | Medio |
| 27 | `servicios` | CRUD | ✅ Completa | Bajo |
| 28 | `productos` | CRUD + bulkUpdate + restock | ✅ Completa | **Alto** |
| 29 | `admin` | Activity logs | ✅ Completa | Medio |
| 30 | `auth` | Auth handlers | ✅ Completa | **Alto** |

### Proceso por feature
- [ ] **1B.n.1** Verificar cobertura handlers ↔ SA (como en 1A.1)
- [ ] **1B.n.2** Buscar imports de handlers y routes
- [ ] **1B.n.3** Eliminar handler + routes
- [ ] **1B.n.4** Build + tests
- [ ] **1B.n.5** Commit independiente por feature o batch de 3-5

### Tasks grupales
- [ ] **1B.31** Migrar features de riesgo bajo (1-13) en batches
- [ ] **1B.32** Migrar features de riesgo medio (14-25) en batches
- [ ] **1B.33** Migrar features de riesgo alto (26-30) uno por uno
- [ ] **1B.34** Verificación global: `grep -r "api/handlers" src/features/` → solo debe quedar contabilidad
- [ ] **1B.35** Verificación global: `pnpm run build && pnpm run test:run` → OK

---

## Fase 1C: Contabilidad — Handler Complejo (10+ archivos, ~3-4h)

**Dependencies**: Fase 1B
**Risk**: High

- [ ] **1C.1** Analizar `src/features/contabilidad/api/handlers.ts` (525+ líneas):
  - Mapear cada función exportada, qué hace, y si ya tiene SA
  - Identificar qué usa pdf-lib (exportación → mantener API route)
  - Identificar qué es puramente query (→ migrar a SA)
- [ ] **1C.2** Migrar queries de reportes a SA en `actions-reportes.ts`
- [ ] **1C.3** Migrar anticipos workflow (si no está en `actions-anticipos.ts`)
- [ ] **1C.4** Verificar que cierres contables están cubiertos en `actions-cierres.ts`
- [ ] **1C.5** Mantener rutas de exportación PDF como API routes
- [ ] **1C.6** Eliminar handlers migrados del archivo, dejar solo exportación PDF
- [ ] **1C.7** Eliminar API routes de contabilidad que ya no se usan
- [ ] **1C.8** `pnpm run build && pnpm run test:run` → OK
- [ ] **1C.9** Test manual: reportes financieros funcionan

---

## Fase 2: Eliminar Redux/RTK Query (15+ archivos, ~3-4h)

**Dependencies**: Fase 1C (contabilidad handlers migrados)
**Risk**: High (toca layout y provider)

### 2A: Dead code (ya hecho en Fase 0)
- [ ] ✅ productoSlice.tsx eliminado

### 2B: Tema → next-themes
- [ ] **2B.1** Instalar `next-themes`
- [ ] **2B.2** Configurar `ThemeProvider` en layout
- [ ] **2B.3** Agregar `next-themes` config en tailwind.config
- [ ] **2B.4** Actualizar toggle de tema para usar `useTheme()` de next-themes
- [ ] **2B.5** Eliminar `themeSlice.tsx`

### 2C: Contabilidad state → URL params + useState
- [ ] **2C.1** Migrar `selectedCuentaId` y `filtros` a URL search params
- [ ] **2C.2** Migrar `loading` y `error` a useState local en componentes
- [ ] **2C.3** Migrar data fetching (cuentas, monedas, tasas) a SA directas
- [ ] **2C.4** Eliminar `contabilidadSlice.tsx` de features
- [ ] **2C.5** Eliminar `contabilidadSlice.tsx` de redux
- [ ] **2C.6** Eliminar `selectors/contabilidadSelectors.ts`
- [ ] **2C.7** Mover `utils/contabilidadUtils.ts` a `src/features/contabilidad/utils/`
- [ ] **2C.8** Eliminar `contabilidad/index.ts`

### 2D: prestamosCashApi → SA
- [ ] **2D.1** Crear SA para cada endpoint de prestamosCashApi en `actions-prestamos-cash.ts`
- [ ] **2D.2** Actualizar componentes que usan RTK Query hooks para usar SA
- [ ] **2D.3** Eliminar `src/lib/redux/services/prestamosCashApi.tsx`

### 2E: apiSlice + store cleanup
- [ ] **2E.1** Eliminar `src/lib/redux/services/apiSlice.tsx`
- [ ] **2E.2** Eliminar `src/lib/redux/store.tsx`
- [ ] **2E.3** Eliminar `src/lib/redux/hooks.ts`
- [ ] **2E.4** Eliminar `src/lib/redux/provider.tsx` (archivo)
- [ ] **2E.5** Eliminar `<ReduxProvider>` del layout
- [ ] **2E.6** Eliminar toda la carpeta `src/lib/redux/`
- [ ] **2E.7** Remover `@reduxjs/toolkit` y `react-redux` de `package.json`
- [ ] **2E.8** `pnpm install` → sin errores
- [ ] **2E.9** `pnpm run build && pnpm run test:run` → OK

---

## Fase 3: Server Components (10+ archivos, ~2-3h)

**Dependencies**: Fase 2 (Redux eliminado)
**Risk**: Medium

- [ ] **3.1** Identificar componentes con `'use client'` que solo lo tenían por Redux
- [ ] **3.2** Convertir a Server Components:
  - Sacar `'use client'`
  - Reemplazar SA en useEffect por SA directo (await)
  - Mover data fetching al Server Component padre
- [ ] **3.3** Componentes con interacción real (onClick, formularios) → mantener Client Components
- [ ] **3.4** `pnpm run build && pnpm run test:run` → OK
- [ ] **3.5** Verificar reducción de bundle size

---

## Resumen de Tasks

| Fase | Tasks | Archivos | Dependencia | Riesgo |
|------|-------|----------|-------------|--------|
| **Fase 0** | 4 | 1 | — | ✅ Mínimo |
| **Fase 1A** | 9 | 2-5 | Fase 0 | ✅ Bajo |
| **Fase 1B** | ~90 | 20-30 | Fase 1A | ⚠️ Medio |
| **Fase 1C** | 9 | 10+ | Fase 1B | 🔴 Alto |
| **Fase 2** | ~20 | 15+ | Fase 1C | 🔴 Alto |
| **Fase 3** | 5 | 10+ | Fase 2 | ⚠️ Medio |

## Recomendación de Implementación

1. Hacer **Fase 0 + Fase 1A** primero (1-2 commits, riesgo bajo)
2. Validar que la app funciona correctamente sin handlers de categorías
3. Si OK → continuar con **Fase 1B** en batches de 5 features
4. Dejar **Fase 1C + Fase 2** para después de tener confianza
5. **Fase 3** es opcional y post-Redux

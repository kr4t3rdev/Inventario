# Exploration: Plan de Migración Completa a Server Actions + Server Components

## Current State

El proyecto TCP tiene una **arquitectura híbrida** donde conviven patrones legacy y modernos. La migración a Server Actions ya está **parcialmente avanzada** (43 archivos `actions.ts`), pero queda código legacy significativo.

### Resumen de hallazgos

| Categoría | Cantidad | Estado |
|-----------|----------|--------|
| Server Actions (`actions.ts`) | 43 archivos | ✅ Moderno |
| Legacy handlers (`api/handlers.ts`) | 32 archivos | ⚠️ Legacy |
| API Routes (`app/api/**/route.ts`) | 90+ archivos | ⚠️ Legacy/Infra |
| Redux Slices | 3 (theme, contabilidad, producto) | ⚠️ Legacy |
| RTK Query APIs | 1 (prestamosCashApi) | ⚠️ Legacy |
| Componentes con Redux hooks | 4 componentes | ⚠️ Legacy |

---

## 1. Legacy Handlers Inventory (handlers.ts)

Cada feature tiene un `api/handlers.ts` con operaciones CRUD que **duplican** las Server Actions existentes.

### Features con handlers + Server Actions (32 features):

| Feature | Handlers | Server Actions | Migración |
|---------|----------|---------------|-----------|
| `categorias` | 5 handlers (CRUD + hierarchy + validate) | `actions.ts` completo ✅ | **Listo para eliminar handlers** |
| `productos` | 6 handlers (CRUD + bulkUpdate + restock) | `actions.ts` ✅ | Handlers tienen lógica extra (restock complejo) |
| `ventas` | handlers | `actions.ts` ✅ | Verificar cobertura |
| `clientes` | handlers | `actions.ts` ✅ | Verificar cobertura |
| `contabilidad` | handler complejo (525+ líneas) | 8 actions-*.ts ✅ | **Feature más complejo** |
| `almacenes` | handlers | `actions.ts` ✅ | Verificar cobertura |
| `empleados` | handlers | `actions.ts` ✅ | Verificar cobertura |
| ... 26 más ... | handlers | `actions.ts` ✅ | Verificar cobertura |

Para **categorías** como caso de estudio: handlers y Server Actions tienen EXACTAMENTE las mismas operaciones (CRUD + hierarchy + validate), pero los handlers se llaman desde API routes que las exponen como REST. Las Server Actions ya están siendo usadas desde componentes.

### Infraestructura API Routes (conservar):

| Ruta | Propósito | Acción |
|------|-----------|--------|
| `/api/upload` | Subida de archivos | ✅ Conservar (infraestructura) |
| `/api/exchange` | Tasas de cambio externas | ✅ Conservar |
| `/api/health` | Health check | ✅ Conservar |
| `/api/metrics` | Métricas | ✅ Conservar |
| `/api/image` | Servir imágenes | ✅ Conservar |

---

## 2. Redux / RTK Inventory

### 2.1 themeSlice (23 lines)
- Estado: `mode: 'light' | 'dark'`
- Uso: Tema claro/oscuro
- Alternativa: CSS `prefers-color-scheme` + `localStorage` + Tailwind `darkMode: 'class'`
- **Prioridad: Baja** — simple, no blocking

### 2.2 productoSlice (0 lines — VACÍO)
- **Dead code**. Sin acciones ni estado.
- **Prioridad: Inmediata** — eliminación simple

### 2.3 contabilidadSlice (402 lines)
- Estado extenso: cuentas bancarias, monedas, tasas, reconciliaciones, transferencias, UI state (selectedCuenta, filtros, loading, error)
- 13 acciones (setSelectedCuenta, setFiltros, setLoading, setError, etc.)
- 15 selectores (incluyendo computed con createSelector)
- Usado desde:
  - `historial-ajustes-table.tsx` — importa useAppSelector
  - `reconciliacion-ventas-form.tsx` — useAppSelector(selectMonedasActivas)
  - `reconciliacion-servicios-form.tsx` — useAppSelector(selectMonedasActivas)
  - `reconciliacion-gastos-form.tsx` — useAppSelector(selectMonedasActivas)
- **Prioridad: Alta** — es el único bloqueante real de Redux, pero su lógica de UI (filtros, loading, error) se reemplaza con URL search params + useState

### 2.4 RTK Query: apiSlice (130 lines)
- Base query apunta a `/api/...` (handlers legacy)
- 50+ tagTypes registrados pero **endpoints vacíos** (endpoints: () => ({}))
- Actúa como registro central de tags

### 2.5 RTK Query: prestamosCashApi (69 lines)
- 6 endpoints reales (getPrestamosCash, createPrestamoCash, etc.)
- Inyectados via `apiSlice.injectEndpoints()`
- Contabilidad: prestamos, stats, pagos
- **Prioridad: Media** — reemplazar con Server Actions

---

## 3. Server Components Candidates

Por ahora el foco es **migrar backend (handlers → Server Actions)**. Los componentes cliente se pueden reevaluar DESPUÉS de eliminar Redux.

Sin embargo, hay una oportunidad inmediata: una vez que SA reemplacen handlers, los componentes que llaman a RTK Query/API routes pueden cambiar a llamar SA directo desde `useEffect` sin cambiar su estado actual.

---

## 4. Migraciones Previas (openspec/)

El proyecto ya tiene cambios de migración documentados:

| Cambio | Estado |
|--------|--------|
| `server-first-server-actions` | Proposal + Specs + Design + Tasks |
| `migrate-cuentas-server-actions` | Proposal + Specs + Design + Tasks |
| `migrate-compras-server-actions` | Proposal + Specs + Design + Tasks |
| `migrate-productos-server-components` | Proposal + Design + Tasks |
| `feature-migration-gestion` | Proposal + Tasks |

Esto confirma que **la migración ya está en marcha**, pero no se ha completado ni consolidado.

---

## 5. Migration Strategy Recommendation

### Approach: Por capas (handlers → Redux → Components)

```
Fase 0: Limpieza
  └── Eliminar productoSlice.tsx (dead code)
  
Fase 1: Handlers → Server Actions (3 iteraciones)
  ├── Iteración 1: Features con SA completas + handlers redundantes
  │   └── categorias (caso más simple, handlers 100% duplicados)
  ├── Iteración 2: Features con SA + handlers con lógica extra
  │   └── productos, ventas, clientes, almacenes, empleados...
  └── Iteración 3: Feature complejo
      └── contabilidad (handler 525+ líneas, 8 SA files)

Fase 2: Redux → Estado Local + URL Params
  ├── Eliminar productoSlice (dead code)
  ├── Migrar themeSlice a CSS + localStorage
  ├── Migrar contabilidadSlice a useState + URL search params
  └── Eliminar ReduxProvider + store + hooks

Fase 3: RTK Query → Server Actions
  └── Reemplazar prestamosCashApi endpoints con SA

Fase 4: Client → Server Components
  └── Reevaluar 'use client' después de eliminar Redux
```

### Esfuerzo estimado

| Fase | Archivos | Riesgo | Prioridad |
|------|----------|--------|-----------|
| Fase 0 | 1 | Ninguno | Alta |
| Fase 1.1 | 2-3 | Bajo | Alta |
| Fase 1.2 | 20-30 | Medio | Alta |
| Fase 1.3 | 10-15 | Alto | Media |
| Fase 2 | 5-8 | Medio | Media |
| Fase 3 | 3-5 | Bajo | Media |
| Fase 4 | ? | Variable | Baja |

### Recomendación

Arrancar con **Fase 0 + Fase 1.1 (categorías)** como caso de prueba para validar el proceso antes de escalar. Esto permite:

1. Verificar que ningún componente se rompe al eliminar handlers (porque los componentes ya usan SA)
2. Establecer el patrón de migración para el resto de features
3. Ganar confianza antes de tocar contabilidad

### Riesgos

- **Contabilidad**: El handler tiene lógica financiera compleja (reports, PDF generation). Las SA existentes cubren CRUD pero no necesariamente todo lo del handler.
- **API routes usadas externamente**: Si algún cliente externo usa las rutas `/api/...`, migrar a SA rompe la integración.
- **RTK Query cache invalidation**: La red de tags es compleja. Al migrar a SA, hay que asegurar que `revalidatePath`/`revalidateTag` cubra los mismos casos.
- **Regresión silenciosa**: Handlers y SA pueden tener lógica ligeramente diferente. Hay que verificar que el comportamiento sea idéntico.

### Ready for Proposal

**Sí.** La exploración es completa. Recomiendo:

1. Empezar con un PR pequeño (Fase 0 + Fase 1.1 = categorías) para validar
2. Luego escalar al resto de features
3. Dejar contabilidad para el final

# Tasks: Admin Users Page Refactor

## Contexto

La página `/admin/usuarios` vive en el **Panel de Control Global** (super-admin) pero consume APIs **tenant-scoped** (`/api/admin/users`, `/api/admin/users/user-metrics`). Esto provoca que un admin global sin `tenantId` vea datos vacíos o incompletos. Además, la página tiene redundancia de charts (`UserActivityCharts` + `TemporalDashboard` con los mismos datos), un monolito de 873 líneas (`UserMonitoringPanel`), inconsistencia de roles entre tabla y dialogs, y ausencia de patrones fundamentales como validación cliente, paginación server-side, y filtro por tenant.

---

## Phase 1: Foundation — APIs Globales y Modelo de Autorización

**Objetivo**: Que el admin global pueda ver y gestionar usuarios de TODOS los tenants sin depender de `user.tenantId`.

- [ ] **1.1 Crear `GET /api/admin/global/users`**
  - **Archivo**: `src/app/api/admin/global/users/route.ts`
  - **Qué**: Lista usuarios de TODOS los tenants con sus memberships. Soporte query params: `tenantId` (filtro), `search` (name/email), `role`, `isActive`, `page`, `limit`, `sortBy`, `sortOrder`.
  - **Auth**: `isAdminRole(authUser.role)` (global admin only).
  - **Response**: `{ users: UsuarioWithTenant[], total: number, page: number, pages: number }`
  - **Tags RTK**: `GlobalUsers`

- [ ] **1.2 Crear `GET /api/admin/global/users/metrics`**
  - **Archivo**: `src/app/api/admin/global/users/metrics/route.ts`
  - **Qué**: Métricas temporales agregadas a nivel plataforma. Query param opcional `tenantId` para drill-down.
  - **Auth**: Global admin only.
  - **Tags RTK**: `GlobalUserMetrics`

- [ ] **1.3 Extender `GET /api/admin/users/user-metrics` con `tenantId` opcional**
  - **Archivo**: `src/app/api/admin/users/user-metrics/route.ts`
  - **Qué**: Agregar query param `tenantId`. Si se provee, filtrar por ese tenant. Si no, y el usuario es global admin, retornar métricas globales. Si es tenant admin, usar su `tenantId` actual.
  - **Nota**: Mantiene backward compat con `/busy/admin/usuarios` (tenant-scoped).

- [ ] **1.4 Extender `GET /api/admin/activity-logs` con `tenantId` opcional**
  - **Archivo**: `src/app/api/admin/activity-logs/route.ts`
  - **Qué**: Agregar query param `tenantId`. Filtrar logs por usuarios que pertenecen a ese tenant (join via `UserActivityLog.user → TenantMembership`).

- [ ] **1.5 Extender `GET /api/admin/sessions` con `tenantId` opcional**
  - **Archivo**: `src/app/api/admin/sessions/route.ts`
  - **Qué**: Igual que 1.4 pero para sesiones.

- [ ] **1.6 Agregar endpoints RTK Query globales**
  - **Archivo**: `src/lib/redux/services/adminApi.tsx`
  - **Qué**: 
    - `getGlobalUsers: builder.query<GlobalUsersResponse, GlobalUsersQuery>`
    - `getGlobalUserMetrics: builder.query<GlobalUserMetricsResponse, { months: number; tenantId?: string }>`
  - **Tags**: `GlobalUsers`, `GlobalUserMetrics`
  - **Invalidaciones**: `addUser`, `updateUser`, `deleteUser`, `lockUser`, `unlockUser` deben invalidar `GlobalUsers` además de `Admin`.

- [ ] **1.7 Definir tipos TypeScript para usuario con tenant**
  - **Archivo**: `src/app/models/model.ts` o `src/lib/types/admin.ts`
  - **Qué**: `interface UsuarioWithTenant extends Usuario { tenantId: string; tenantName: string; tenantRole: string; }`

- [ ] **1.8 Verificar Zod schemas para queries paginadas**
  - **Archivo**: `src/lib/admin/schemas.ts`
  - **Qué**: Agregar `globalUsersQuerySchema` con validación de `page`, `limit` (max 100), `sortBy`, `sortOrder`, `tenantId` (uuid opcional), `search` (string opcional, max 100 chars).

---

## Phase 2: Core UI Refactor — Redundancia, Monolitos y Scope

**Objetivo**: Eliminar duplicación, dividir responsabilidades, y que `/admin/usuarios` use las APIs globales.

- [ ] **2.1 Refactorizar `/admin/usuarios/page.tsx` para usar APIs globales**
  - **Archivo**: `src/app/admin/usuarios/page.tsx`
  - **Qué**: 
    - Reemplazar `useGetUserQuery` por `useGetGlobalUsersQuery`.
    - Reemplazar `useGetUserMetricsQuery` por `useGetGlobalUserMetricsQuery`.
    - Mantener `useGetTenantLicenseQuery` solo para mostrar consumo del tenant seleccionado (ver 2.7).
    - Eliminar el estado `tenantLicense` de la página principal si no aplica al scope global.

- [ ] **2.2 Unificar `UserActivityCharts` y `TemporalDashboard`**
  - **Archivo**: `src/components/admin/user-activity-charts.tsx`
  - **Qué**: Crear un único componente `UserAnalyticsPanel` que combine lo mejor de ambos:
    - Header con selector de meses (3/6/12/18/24).
    - Grid de KPIs resumen (total users, logins, bloqueados, crecimiento).
    - Tabs internos: "Tendencias" (área/line chart), "Roles" (bar/pie chart), "Crecimiento" (line chart), "Comparativa" (tabla mes a mes).
  - **Archivos a eliminar**: `user-activity-charts.tsx`, `temporal-dashboard.tsx`.
  - **Nota**: Usar `dynamic import` con `ssr: false` como ya se hace.

- [ ] **2.3 Extraer sub-componentes de `UserMonitoringPanel`**
  - **Archivo base**: `src/components/admin/user-monitoring-panel.tsx`
  - **Qué**: Dividir en 4 componentes independientes:
    - `ActivityLogsTab` — tabla + paginación de logs.
    - `SessionsTab` — tabla + paginación de sesiones + acción cerrar sesión.
    - `BlockedUsersTab` — tabla de bloqueados + desbloqueo.
    - `ExpiringUsersTab` — tabla de expiración + envío de notificaciones.
  - **Cada uno** recibe sus props de data y callbacks. El panel padre solo maneja el estado de `activeTab` y renderiza el componente activo.
  - **Lazy loading por tab**: Cada tab debe hacer su propio `useQuery` y no cargar hasta que esté activa. Actualmente el panel padre hace 4 queries al mismo tiempo.

- [ ] **2.4 Crear hook `useAdminUsersFilters`**
  - **Archivo**: `src/hooks/use-admin-users-filters.ts`
  - **Qué**: Encapsular estado de filtros de la tabla: `search`, `roleFilter`, `statusFilter`, `tenantFilter`, `page`, `limit`, `sortBy`, `sortOrder`.
  - **Devuelve**: `{ filters, setFilter, resetFilters, queryString }` para pasar directo al endpoint RTK.

- [ ] **2.5 Refactorizar `AdminUsersTable` para server-side pagination, sorting y tenant column**
  - **Archivo**: `src/components/admin/admin-users-table.tsx`
  - **Qué**:
    - Agregar prop `total` y `page` + callback `onPageChange`.
    - Agregar columnas sortables: Usuario (name), Email, Fecha de Creación, Expira. Click en header togglea sort.
    - Agregar columna "Tenant" (nombre del tenant) solo cuando `showTenantColumn === true` (modo global).
    - Reemplazar paginación client-side por componente `Pagination` de shadcn/ui (server-side).
    - Reemplazar export CSV manual (`fetch` + `getAuthToken`) por mutation de RTK Query: `exportGlobalUsers`.

- [ ] **2.6 Sincronizar roles en create/edit dialogs**
  - **Archivos**: `src/components/admin/create-user-dialog.tsx`, `src/components/admin/edit-user-dialog.tsx`
  - **Qué**: Ambos Selects de rol deben incluir TODOS los valores del enum `AppUserRole`: `manager`, `admin`, `economico`, `dependiente`, `regularUser`. Actualmente faltan `manager` y `economico`.

- [ ] **2.7 Extraer `TenantConsumptionCard` como componente standalone**
  - **Archivo**: `src/components/admin/tenant-consumption-card.tsx`
  - **Qué**: El card de "Plan Consumption" que vive actualmente inline en `page.tsx`. Extraerlo para poder reutilizarlo en otras páginas (ej. `/admin/tenants/[id]`).

---

## Phase 3: UX & Polish — Validaciones, Filtros y Acciones Masivas

**Objetivo**: Elevar la calidad de UX a nivel profesional.

- [ ] **3.1 Agregar validación Zod en cliente para create/edit dialogs**
  - **Archivos**: `create-user-dialog.tsx`, `edit-user-dialog.tsx`
  - **Qué**: Importar `createUserBodySchema` y `updateUserBodySchema` desde `src/lib/admin/schemas.ts`. Validar `onSubmit` ANTES de llamar a la mutation. Mostrar errores inline por campo (patrón ya usado en otras partes del proyecto).
  - **Mejora extra**: En edit dialog, validar que el email no esté duplicado (debounce + check contra lista de usuarios).

- [ ] **3.2 Agregar filtro por tenant en `AdminUsersTable`**
  - **Archivo**: `src/components/admin/admin-users-table.tsx`
  - **Qué**: 
    - Agregar `<Select>` de tenants arriba de los filtros actuales.
    - Usar `useGetAdminTenantsQuery` para poblar el select.
    - Opciones: "Todos los tenants" (default) + cada tenant por nombre.
    - Al cambiar, resetear `page` a 1.

- [ ] **3.3 Implementar bulk actions en la tabla**
  - **Archivo**: `src/components/admin/admin-users-table.tsx`
  - **Qué**:
    - Agregar checkboxes en cada fila y un checkbox de header para seleccionar todos.
    - Barra flotante de acciones masivas que aparece al seleccionar ≥1 fila: "Activar", "Desactivar", "Eliminar", "Exportar seleccionados".
    - Crear endpoints batch: `POST /api/admin/global/users/bulk` con body `{ userIds: string[]; action: 'activate' | 'deactivate' | 'delete' }`.

- [ ] **3.4 Agregar búsqueda server-side con debounce**
  - **Archivo**: `src/components/admin/admin-users-table.tsx`
  - **Qué**: El input de búsqueda actual filtra client-side. Cambiar a server-side:
    - Usar `useDeferredValue` o `useDebounce` (300ms).
    - Pasar `search` al query param del endpoint.
    - Mostrar estado de "Buscando..." mientras carga.

- [ ] **3.5 Mejorar empty states y estados de error**
  - **Archivos**: `AdminUsersTable`, `UserMonitoringPanel`, `UserAnalyticsPanel`
  - **Qué**: 
    - Estados vacíos con ilustración/icono y mensaje contextual (ej. "No hay usuarios en este tenant" vs "Ningún usuario coincide con tu búsqueda").
    - Estados de error con botón "Reintentar" que llama a `refetch`.

- [ ] **3.6 Agregar skeleton loaders consistentes**
  - **Archivo**: `src/components/admin/admin-users-table.tsx`
  - **Qué**: Reemplazar `AdminTableLoader` (usado actualmente solo en loading inicial) por skeletons de shadcn/ui (`Skeleton`) en cada celda durante cambios de página/filtro. Evitar layout shift.

---

## Phase 4: Testing — Cobertura y Regresión

**Objetivo**: Que nada de lo anterior se rompa y las nuevas APIs estén testeadas.

- [ ] **4.1 Tests unitarios para Zod schemas nuevos**
  - **Archivo**: `src/lib/admin/__tests__/schemas.test.ts`
  - **Qué**: Validar `globalUsersQuerySchema` con casos válidos e inválidos (page negativo, limit > 100, search > 100 chars, tenantId no uuid).

- [ ] **4.2 Tests de integración para `GET /api/admin/global/users`**
  - **Archivo**: `src/app/api/admin/global/users/__tests__/route.test.ts`
  - **Qué**: 
    - Global admin accede → 200 + array de usuarios con `tenantName`.
    - Tenant admin intenta acceder → 403.
    - Filtro por `tenantId` → solo usuarios de ese tenant.
    - Search por nombre/email → resultados correctos.
    - Pagination → `total`, `page`, `pages` correctos.
    - Sorting por `createdAt` ASC/DESC → orden correcto.

- [ ] **4.3 Tests de integración para `GET /api/admin/global/users/metrics`**
  - **Archivo**: `src/app/api/admin/global/users/metrics/__tests__/route.test.ts`
  - **Qué**: Retorna monthlyData agregado de todos los tenants. Filtro por tenantId funciona.

- [ ] **4.4 Tests de componente para `AdminUsersTable`**
  - **Archivo**: `src/components/admin/__tests__/admin-users-table.test.tsx`
  - **Qué**: 
    - Renderiza lista de usuarios con columna tenant.
    - Cambio de página dispara `onPageChange`.
    - Click en header de columna dispara `onSortChange`.
    - Selección de filas activa bulk action bar.

- [ ] **4.5 Tests E2E para flujo completo de admin global**
  - **Archivo**: `src/__tests__/e2e/admin-global-users.test.ts`
  - **Qué**: 
    - Login como admin global → navega a `/admin/usuarios`.
    - Ve usuarios de múltiples tenants.
    - Filtra por tenant → lista se reduce.
    - Busca por nombre → resultados filtrados.
    - Crea usuario → aparece en tabla + RTK invalida cache.

---

## Phase 5: Cleanup y Documentación

**Objetivo**: Dejar el codebase limpio y documentar decisiones.

- [ ] **5.1 Eliminar archivos muertos**
  - **Qué**: Eliminar `src/components/admin/user-activity-charts.tsx` y `src/components/admin/temporal-dashboard.tsx` luego de verificar que `UserAnalyticsPanel` cubre toda la funcionalidad.
  - **Nota**: Verificar que no se importen en ningún otro lugar (grep).

- [ ] **5.2 Actualizar `openspec/changes/administracion/design.md`**
  - **Qué**: Agregar sección "Phase 2: Admin Users Page Refactor" documentando:
    - Decisión de crear APIs globales `/api/admin/global/*` separadas de las tenant-scoped.
    - Decisión de unificar charts y dividir `UserMonitoringPanel`.
    - Tabla de endpoints actualizados con los nuevos globales.

- [ ] **5.3 Actualizar `AGENTS.md` si hay convenciones nuevas**
  - **Qué**: Si se establece patrón nuevo (ej. "APIs globales van bajo `/api/admin/global/`"), documentarlo en `AGENTS.md`.

- [ ] **5.4 Run lint y type-check**
  - **Comandos**: `pnpm run lint`, `npx tsc --noEmit`
  - **Meta**: 0 errores, 0 warnings nuevos.

---

## Dependencias Entre Tareas

```
Phase 1 (APIs)
  ├── 1.1, 1.2, 1.3, 1.4, 1.5 (paralelas, independientes entre sí)
  ├── 1.6 depende de 1.1–1.5 (necesita endpoints definidos)
  └── 1.7, 1.8 (paralelas, no dependen de nada)

Phase 2 (UI Core)
  ├── 2.1 depende de 1.1, 1.2, 1.6
  ├── 2.2, 2.3, 2.4, 2.7 (paralelas, independientes)
  ├── 2.5 depende de 2.1 y 2.4
  ├── 2.6 independiente (cambia enums en dialogs)
  └── 2.7 independiente

Phase 3 (UX)
  ├── 3.1 depende de 2.6 (schemas ya en cliente)
  ├── 3.2 depende de 2.5 (tabla con tenant column)
  ├── 3.3 depende de 2.5 (tabla con checkboxes)
  ├── 3.4 depende de 2.5 (tabla con server pagination)
  └── 3.5, 3.6 (paralelas, independientes)

Phase 4 (Testing)
  ├── 4.1 depende de 1.8
  ├── 4.2 depende de 1.1
  ├── 4.3 depende de 1.2
  ├── 4.4 depende de 2.5
  └── 4.5 depende de 2.1 + 2.5 + 3.2

Phase 5 (Cleanup)
  └── Todo el resto debe estar merged.
```

---

## Métricas de Éxito

1. `/admin/usuarios` muestra usuarios de todos los tenants para un global admin.
2. La carga inicial de la página disminuye en ≥30% (menos queries paralelas, un solo chart component).
3. `UserMonitoringPanel` tiene < 300 líneas (vs 873 actuales).
4. 0 errores de lint / type-check.
5. Cobertura de tests en nuevos endpoints ≥ 80%.
6. Un admin global puede filtrar, buscar, ordenar y paginar usuarios por tenant sin recargar la página.

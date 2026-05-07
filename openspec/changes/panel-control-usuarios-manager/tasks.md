# Tasks: Panel de Control de Usuarios para Manager

## Phase 1: Infrastructure & APIs

### Task 1.1: Agregar rutas frontend a permisos del manager
- **File**: `src/lib/permissions.ts`
- **Action**: Verificar que las rutas `/busy/configuracion/usuarios` y `/api/admin/memberships/*` estén accesibles para el rol `manager`
- **Validation**: `manager` ya tiene `['*']`, pero confirmar que no hay excepciones

### Task 1.2: Verificar APIs existentes funcionan para manager
- **Files**: 
  - `src/app/api/admin/global/users/route.ts`
  - `src/app/api/admin/memberships/pending/route.ts`
  - `src/app/api/admin/memberships/[id]/route.ts`
- **Action**: Confirmar que `isTenantAdminRole` incluye a `manager` y que el filtrado por tenant funciona
- **Validation**: Correr tests existentes de estas rutas

## Phase 2: RTK Query API Slice

### Task 2.1: Crear tenantUsersApi
- **File**: `src/lib/redux/services/tenantUsersApi.ts`
- **Endpoints**:
  - `getTenantUsers(tenantId)` → `GET /api/admin/global/users?tenantId={tenantId}`
  - `getPendingMemberships()` → `GET /api/admin/memberships/pending`
  - `approveMembership({ id, tenantRole })` → `PATCH /api/admin/memberships/{id}`
  - `rejectMembership(id)` → `PATCH /api/admin/memberships/{id}`
- **Tags**: `['TenantUsers', 'PendingMemberships']` para invalidación de cache

### Task 2.2: Registrar el API slice en el store
- **File**: `src/lib/redux/store.ts`
- **Action**: Agregar `tenantUsersApi.reducerPath` y `tenantUsersApi.middleware`

## Phase 3: Components

### Task 3.1: Crear TenantUsersStats
- **File**: `src/components/tenant-users/tenant-users-stats.tsx`
- **Props**: `{ total: number, active: number, admins: number, pending: number }`
- **UI**: 4 cards con iconos (Users, UserCheck, Shield, Clock)
- **Validation**: Renderiza correctamente con datos de ejemplo

### Task 3.2: Crear TenantUsersTable
- **File**: `src/components/tenant-users/tenant-users-table.tsx`
- **Props**: `{ users: TenantUser[], isLoading: boolean }`
- **Columns**: Nombre, Email, Rol (badge), Estado (badge), Fecha
- **Features**: Búsqueda por nombre/email, paginación
- **Validation**: Tests unitarios con datos mock

### Task 3.3: Crear PendingMembershipsTable
- **File**: `src/components/tenant-users/pending-memberships-table.tsx`
- **Props**: `{ memberships: PendingMembership[], onApprove, onReject }`
- **Columns**: Nombre, Email, Tipo, Fecha, Acciones
- **Actions**: Botones Aprobar (con selección de rol) / Rechazar
- **Validation**: Tests unitarios con interacciones

### Task 3.4: Crear MembershipActionDialog
- **File**: `src/components/tenant-users/membership-action-dialog.tsx`
- **Props**: `{ membership: PendingMembership | null, open: boolean, onClose, onConfirm }`
- **UI**: Diálogo con dropdown de roles (dependiente, economico, admin) para aprobar
- **Validation**: Confirmar que el rol seleccionado se envía correctamente

### Task 3.5: Crear TenantUsersPage (layout con tabs)
- **File**: `src/components/tenant-users/tenant-users-page.tsx`
- **UI**: Tabs de shadcn ("Usuarios" y "Solicitudes Pendientes")
- **Integration**: Usa los componentes de las tasks 3.1-3.4
- **State**: Tab activa, datos cargados via RTK Query

## Phase 4: Page & Navigation

### Task 4.1: Crear página principal
- **File**: `src/app/busy/configuracion/usuarios/page.tsx`
- **Content**: Renderiza `TenantUsersPage` dentro del layout de `/busy/`
- **Guard**: Verificar que el usuario tenga `tenantRole` manager/admin antes de renderizar

### Task 4.2: Agregar link al sidebar
- **File**: `src/components/app-sidebar2.tsx`
- **Action**: Agregar item "Usuarios" en la sección "Configuración", visible solo si `isTenantAdminRole(user.tenantRole)`
- **Badge**: Mostrar conteo de solicitudes pendientes (opcional, puede ser fase 2)

## Phase 5: Testing

### Task 5.1: Tests unitarios de componentes
- **Files**:
  - `src/components/tenant-users/__tests__/tenant-users-table.test.tsx`
  - `src/components/tenant-users/__tests__/pending-memberships-table.test.tsx`
  - `src/components/tenant-users/__tests__/membership-action-dialog.test.tsx`
- **Coverage**: Renderizado, interacciones, estados vacíos

### Task 5.2: Tests de integración de la página
- **File**: `src/app/busy/configuracion/usuarios/__tests__/page.test.tsx`
- **Coverage**: Carga de datos, cambio de tabs, acciones de aprobar/rechazar

### Task 5.3: Verificar permisos
- **File**: Test manual o E2E
- **Verificar**: 
  - Manager ve el link y accede
  - Dependiente NO ve el link
  - Admin global (role: admin) sigue viendo el panel de admin global

## Phase 6: Verification

### Task 6.1: Run lint
- **Command**: `pnpm run lint`
- **Check**: Sin errores en archivos nuevos

### Task 6.2: Run tests
- **Command**: `pnpm test:run`
- **Check**: Todos los tests pasan

### Task 6.3: Manual QA
- **Steps**:
  1. Loguear como manager
  2. Verificar link en sidebar
  3. Navegar al panel
  4. Verificar lista de usuarios
  5. Verificar solicitudes pendientes
  6. Aprobar/rechazar una solicitud
  7. Verificar que dependiente NO ve el link

## Dependencies

```
Task 1.1, 1.2 (independiente)
  ↓
Task 2.1, 2.2 (independiente)
  ↓
Task 3.1, 3.2, 3.3, 3.4 (pueden hacerse en paralelo)
  ↓
Task 3.5 (necesita 3.1-3.4)
  ↓
Task 4.1, 4.2 (independiente entre sí, necesitan 3.5)
  ↓
Task 5.1, 5.2, 5.3 (necesitan 4.1, 4.2)
  ↓
Task 6.1, 6.2, 6.3 (necesitan todo lo anterior)
```

# Design: Panel de Control de Usuarios para Manager

## Architecture Overview

El panel de control de usuarios es una página frontend en `/busy/` que consume APIs existentes. No requiere cambios de backend significativos ya que las APIs (`/api/admin/global/users`, `/api/admin/memberships/pending`, `/api/admin/memberships/[id]`) ya soportan el rol manager con filtrado por tenant.

## Component Tree

```
/busy/configuracion/usuarios/page.tsx
├── TenantUsersPage (page principal)
│   ├── Tabs ("Usuarios" | "Solicitudes")
│   │   ├── TenantUsersTab
│   │   │   ├── StatsCards (4 cards: total, activos, admins, pendientes)
│   │   │   ├── SearchBar
│   │   │   ├── TenantUsersTable
│   │   │   │   └── UserRow
│   │   │   └── Pagination
│   │   └── PendingMembershipsTab
│   │       ├── PendingMembershipsTable
│   │       │   └── MembershipActionDialog (aprobar/rechazar)
│   │       └── EmptyState
```

## File Structure

```
src/
├── app/
│   └── busy/
│       └── configuracion/
│           └── usuarios/
│               └── page.tsx              # Página principal del panel
├── components/
│   └── tenant-users/
│       ├── tenant-users-page.tsx         # Layout con tabs
│       ├── tenant-users-table.tsx        # Tabla de usuarios
│       ├── pending-memberships-table.tsx # Tabla de solicitudes
│       ├── membership-action-dialog.tsx  # Diálogo aprobar/rechazar
│       └── tenant-users-stats.tsx        # Tarjetas de estadísticas
├── lib/
│   └── redux/
│       └── services/
│           └── tenantUsersApi.ts         # RTK Query para las APIs
```

## Data Flow

### Listar Usuarios

```
TenantUsersPage
  → useGetTenantUsersQuery(tenantId)
    → GET /api/admin/global/users?tenantId=<id>
      → authenticateUser → resolveTenantContext
      → isTenantAdminRole check
      → prisma.tenantMembership.findMany({ where: { tenantId } })
      → return users scoped to tenant
```

### Aprobar Solicitud

```
PendingMembershipsTable
  → useApproveMembershipMutation()
    → PATCH /api/admin/memberships/<id>
      → { action: 'approve', tenantRole: 'dependiente' }
      → authenticateUser → resolveTenantContext
      → isTenantAdminRole check
      → verify membership.tenantId === user.tenantId
      → prisma.tenantMembership.update({ isActive: true, tenantRole })
      → prisma.user.update({ onboardingStatus: 'completed' })
      → invalidate cache
```

## State Management

Usamos **RTK Query** para data fetching y caching:

```typescript
// tenantUsersApi.ts
export const tenantUsersApi = createApi({
  reducerPath: 'tenantUsersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['TenantUsers', 'PendingMemberships'],
  endpoints: (builder) => ({
    getTenantUsers: builder.query({
      query: (tenantId) => `/admin/global/users?tenantId=${tenantId}`,
      providesTags: ['TenantUsers'],
    }),
    getPendingMemberships: builder.query({
      query: () => '/admin/memberships/pending',
      providesTags: ['PendingMemberships'],
    }),
    approveMembership: builder.mutation({
      query: ({ id, tenantRole }) => ({
        url: `/admin/memberships/${id}`,
        method: 'PATCH',
        body: { action: 'approve', tenantRole },
      }),
      invalidatesTags: ['TenantUsers', 'PendingMemberships'],
    }),
    rejectMembership: builder.mutation({
      query: (id) => ({
        url: `/admin/memberships/${id}`,
        method: 'PATCH',
        body: { action: 'reject' },
      }),
      invalidatesTags: ['TenantUsers', 'PendingMemberships'],
    }),
  }),
});
```

## Permission Changes

### TENANT_PERMISSIONS

Agregar rutas frontend de `/busy/configuracion/usuarios` al rol `manager` (si aplica para frontend routes).

Nota: Actualmente `manager` ya tiene `['*']` en `TENANT_PERMISSIONS`, así que tiene acceso a todo. Pero hay que asegurarse de que las rutas de API también estén cubiertas.

### ROLE_PERMISSIONS

Agregar `GET /api/admin/global/users` a `regularUser` si no está (ya debería estar por el wildcard).

## UI Design

### Página Principal

- **Header**: Título "Gestión de Usuarios" + badge con cantidad de solicitudes pendientes
- **Tabs**: 
  - "Usuarios Activos" (default)
  - "Solicitudes Pendientes" (con badge rojo si hay > 0)

### Tab Usuarios

- **Stats Cards** (grid 4 columnas):
  - Total de usuarios
  - Usuarios activos
  - Administradores
  - Solicitudes pendientes
- **Tabla** con columnas: Nombre, Email, Rol, Estado, Fecha de ingreso
- **Búsqueda** por nombre/email
- **Paginación**

### Tab Solicitudes

- **Tabla** con columnas: Nombre, Email, Tipo, Fecha, Acciones
- **Acciones**:
  - "Aprobar" → abre diálogo para seleccionar rol
  - "Rechazar" → confirmación directa

### Diálogo Aprobar

- Dropdown para seleccionar rol: `dependiente`, `economico`, `admin`
- Botón "Aprobar"

## Security Considerations

1. **Tenant Isolation**: Las APIs ya filtran por `tenantId` desde el token JWT
2. **Role Check**: `isTenantAdminRole` verifica que sea `manager` o `admin`
3. **Membership Ownership**: `PATCH` verifica que la membresía pertenezca al tenant del usuario
4. **No Exposure**: Un manager nunca ve usuarios de otros tenants

## Testing Strategy

### Unit Tests

- `tenant-users-table.test.tsx`: renderizado con datos, búsqueda, paginación
- `pending-memberships-table.test.tsx`: aprobar/rechazar acciones
- `membership-action-dialog.test.tsx`: selección de rol, confirmación

### Integration Tests

- `page.test.tsx`: flujo completo de tabs, carga de datos
- Verificar que dependiente no ve el link en sidebar

### API Tests

- Verificar 403 cuando un dependiente intenta acceder a `/api/admin/memberships/pending`
- Verificar que manager solo ve usuarios de su tenant

## Rollback Plan

Si algo sale mal:
1. Revertir cambios en `AppSidebar2` (remover link)
2. Revertir cambios en permisos
3. Eliminar página `/busy/configuracion/usuarios/page.tsx`
4. Los cambios en APIs existentes no se tocan (ya funcionaban antes)

## Performance

- Las queries a `tenantMembership` ya están filtradas por `tenantId` (índice existente)
- RTK Query cachea los resultados
- El badge de solicitudes pendientes se actualiza en cada navegación al panel

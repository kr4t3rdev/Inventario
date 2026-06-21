# Rol Económico — Documentación

## Descripción General

El rol **"económico"** es un nivel de acceso intermedio dentro del tenant (empresa) que permite a usuarios visualizar y operar módulos financieros, contables, de reportes, servicios y empleados — todo lo que genera o refleja movimiento económico — sin permisos de administración plena.

A diferencia del rol `manager` (acceso total) y del `dependiente` (solo operaciones diarias), el rol `economico` está diseñado para contadores, tesoreros, analistas financieros y personal que necesita datos económicos sin poder modificar configuraciones críticas del negocio.

## Tenant Roles — Mapa de Acceso

| Rol | Nivel | Acceso |
|---|---|---|
| `manager` | Full | Todo el tenant (CRUD completo) |
| `economico` | Financiero | Contabilidad, reportes, gastos, servicios, empleados (solo lectura operativa + escritura en Gastos DE) |
| `dependiente` | Operativo | Ventas, servicios, reportes diarios |

## Permisos del Rol Económico

### ✅ Acceso Permitido — Contabilidad

| Módulo | Acceso | Descripción |
|---|---|---|
| Dashboard Contable | Lectura | Resumen de indicadores financieros |
| Cuentas Bancarias | Lectura/Consulta | Visualización de cuentas y movimientos |
| Cuentas por Cobrar | Lectura/Consulta | Clientes con saldos pendientes |
| Cuentas por Pagar | Lectura/Consulta | Proveedores con saldos pendientes |
| Anticipos | Lectura/Consulta | Anticipos a proveedores |
| Préstamos en Efectivo | Lectura/Consulta | Préstamos otorgados |
| Deudas en Efectivo | Lectura/Consulta | Deudas registradas |
| Transferencias Bancarias | Lectura/Consulta | Transferencias entre cuentas |
| Ajustes Bancarios | Lectura/Consulta | Ajustes a cuentas bancarias |
| Reconciliación | Lectura/Consulta | Reconciliación de Ventas, Servicios y Gastos |
| Exchange | Lectura/Consulta | Conversión de monedas |
| Inyección Capital | Lectura/Consulta | Aportes de capital |
| Análisis Estado Cuenta | Lectura/Consulta | Análisis detallado de cuentas de clientes |
| Facturas Vencidas | Lectura/Consulta | Facturas con vencimiento |
| Balance y Resultados | Lectura/Consulta | Estados financieros |
| Reportes Contables | Lectura/Consulta | Reportes contables |
| Configuración Contable | Lectura/Consulta | Parámetros contables |

### ✅ Acceso Permitido — Reportes

| Módulo | Acceso | Descripción |
|---|---|---|
| Reportes | Lectura | Reportes generales del sistema |
| Venta Diaria | Lectura | Reporte de ventas del día |
| Cuadre Financiero | Lectura | Cuadre financiero general |

### ✅ Acceso Permitido — Gastos

| Módulo | Acceso | Descripción |
|---|---|---|
| Gastos DE (Lista) | Lectura/Consulta | Listado de gastos de explotación |
| Gastos DE (Conceptos) | Lectura/Consulta | Catálogo de conceptos de gastos |

### ✅ Acceso Permitido — Servicios

| Módulo | Acceso | Descripción |
|---|---|---|
| Servicios (Catálogo) | Lectura | Visualización del catálogo de servicios |
| Servicios (Ventas) | Lectura | Historial de ventas de servicios |
| Servicios (Recibidos) | Lectura | Compras/contrataciones de servicios |

Los servicios generan gastos operativos, por lo que el rol económico puede visualizarlos para su análisis financiero. Las operaciones de escritura (crear, editar, eliminar servicios) están restringidas a manager.

### ✅ Acceso Permitido — Empleados

| Módulo | Acceso | Descripción |
|---|---|---|
| Gestión de Empleados | Lectura | Listado y datos de empleados |
| Asistencia | Lectura | Registros de asistencia e historial |
| Vacaciones | Lectura | Solicitudes de vacaciones e historial |
| Nómina | Lectura | Pagos de salario e histórico de nómina |

Los empleados generan costos salariales (nómina, bonificaciones, horas extras), por lo que el rol económico puede visualizarlos para análisis de gastos de personal. Las operaciones de escritura (crear/editar empleados, registrar asistencia, crear solicitudes de vacaciones, procesar pagos de nómina) están restringidas a manager.

### ✅ Acceso Permitido — Configuración

| Módulo | Acceso | Descripción |
|---|---|---|
| Mi Empresa | Lectura | Datos de la empresa (solo consulta) |

### ❌ Acceso Restringido (Solo Manager)

#### Gestión de Productos e Inventario
- ✗ Productos — no puede crear, editar ni eliminar productos
- ✗ Categorías — no puede administrar catálogo de categorías
- ✗ Unidades — no puede gestionar unidades de medida
- ✗ Almacenes — no puede gestionar almacenes
- ✗ Puntos de Venta — no puede administrar puntos de venta
- ✗ Listas de Precios — no puede crear/modificar listas
- ✗ Proveedores — no puede gestionar proveedores

#### Acciones Operativas
- ✗ Ventas — no puede registrar transacciones de venta
- ✗ Compras de Productos — no puede registrar compras
- ✗ Gestión de Facturas — no puede administrar facturación
- ✗ Mermas — no puede registrar mermas
- ✗ Transferencias — no puede gestionar transferencias entre almacenes
- ✗ Clientes — no puede gestionar clientes
- ✗ Contratos — no puede administrar contratos
- ✗ Ofertas — no puede gestionar ofertas
- ✗ Producción — no puede gestionar órdenes de producción

#### Configuración del Sistema
- ✗ Usuarios — no puede crear/editar usuarios del tenant
- ✗ Contratos (Configuración) — no puede configurar tipos de contratos
- ✗ Períodos Contables — no puede abrir/cerrar períodos
- ✗ Logs Contables — no puede ver logs de auditoría contable

#### Licencias y Planes
- ✗ Licencias — solo admin global
- ✗ Planes — solo admin global

## Implementación Técnica

### 1. Definición del Rol

Archivo: `src/lib/auth/roles.ts`

```typescript
export const TENANT_ROLES = ["manager", "economico", "dependiente"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
```

Funciones auxiliares:

| Función | Propósito |
|---|---|
| `isTenantEconomicoRole(role)` | True si es `economico` o `manager` |
| `isTenantAdminRole(role)` | True solo si es `manager` |
| `getTenantRoleLabel(role)` | "Económico" para UI |
| `normalizeTenantRole(role)` | Normaliza roles legacy |

### 2. Sidebar (Filtro de UI)

Archivo: `src/components/app-sidebar2.tsx`

Los items del menú se filtran mediante `SIDEBAR_TENANT_PERMISSIONS`. Items no listados solo son visibles para `manager`.

```typescript
const SIDEBAR_TENANT_PERMISSIONS: Record<string, TenantRole[]> = {
  // Contabilidad
  Dashboard: ["economico", "manager"],
  "Cuentas Bancarias": ["economico", "manager"],
  "Cuentas por Cobrar": ["economico", "manager"],
  // ... (toda la sección contable)
  // Empleados (nuevo)
  Empleados: ["economico", "manager"],
  "Gestión de Empleados": ["economico", "manager"],
  Asistencia: ["economico", "manager"],
  Vacaciones: ["economico", "manager"],
  Nómina: ["economico", "manager"],
  // Servicios (nuevo)
  Servicios: ["dependiente", "economico", "manager"],
  // ...
};
```

### 3. Server Actions (Protección Backend)

Todas las Server Actions de escritura (create, update, delete) usan `requireManagerRole()` para garantizar que solo manager pueda mutar datos:

```typescript
import { requireTenant, requireManagerRole } from '@/lib/services/tenant-scope';

export const createEmpleadoAction = withAction(async (input, user) => {
  requireManagerRole(user, 'crear empleados');
  const tenantId = requireTenant(user);
  // ...
});
```

Las operaciones de lectura (get*) solo requieren `requireTenant(user)` — cualquier rol con membresía activa puede leer.

### 4. Protección en UI (Componentes Cliente)

Los componentes cliente usan `useAuth()` para condicionar la visibilidad de botones de escritura:

```typescript
const { user } = useAuth();
const puedeEditar = user?.tenantRole === 'manager' || user?.role === 'admin';

// En JSX:
{puedeEditar && <Button onClick={...}>Editar</Button>}
```

Componentes protegidos:

| Componente | Archivo | Botones ocultos para economico |
|---|---|---|
| EmpleadosNominaContent | `features/empleados/components/empleados-nomina-content.tsx` | Editar, Realizar Pago, Eliminar |
| EnhancedAsistenciaForm | `features/empleados/components/enhanced-asistencia-form.tsx` | Registrar Entrada/Salida, Editar manualmente |
| VacacionesForm | `features/empleados/components/vacaciones-form.tsx` | Nueva Solicitud, Crear primera solicitud |
| ServiciosContent | `features/servicios/components/servicios-content.tsx` | Editar, Eliminar (ya existente) |

### 5. Resolución del Tenant

El `tenantRole` se resuelve desde:
- JWT → Payload incluye `tenantRole` después del login
- `getCurrentUser()` → Server Actions y Server Components
- `useAuth()` → Client Components

La membresía se almacena en `TenantMembership` (Prisma) y se resuelve en `resolveTenantContext()`.

## Configuración y Uso

### Para Asignar Rol Económico a un Usuario

1. Acceder a Configuración > Usuarios como manager
2. Seleccionar usuario existente o crear nuevo
3. En "Rol de Empresa", seleccionar **Económico**
4. Guardar

### Para Verificar Permisos

Un usuario con rol económico verá en su menú:
- **Contabilidad**: Todos los módulos contables (excepto Períodos Contables y Logs)
- **Reportes**: Reportes, Venta Diaria, Cuadre Financiero
- **Acciones**: Gastos DE, Servicios (solo lectura)
- **Gestión**: Empleados (solo lectura)
- **Configuración**: Mi Empresa (solo lectura)

Los botones de crear, editar y eliminar no se renderizan en la UI.

## Arquitectura de Roles

```
Platform (global)
├── admin           → Acceso total al sistema, multi-tenant
└── regularUser     → Requiere membresía de tenant

Tenant (por empresa)
├── manager         → Full CRUD dentro del tenant
├── economico       → Lectura financiera + empleados + servicios
└── dependiente     → Operaciones diarias (ventas, servicios)
```

## Seguridad

- **Backend**: `requireManagerRole()` en todas las Server Actions de escritura
- **Frontend**: Sidebar filtra items por rol (primera barrera)
- **UI**: Botones de escritura ocultos según `puedeEditar` (segunda barrera)
- **API Legacy**: Middleware `checkTenantApiPermission()` con `hasTenantPermission()`
- **Auditoría**: `tenantRole` disponible en logs para trazabilidad

## Extensibilidad

Para agregar un nuevo módulo al rol económico:

1. Agregar el item al sidebar con entrada en `SIDEBAR_TENANT_PERMISSIONS`
2. Verificar que las Server Actions de lectura solo requieran `requireTenant`
3. Agregar `requireManagerRole` a las Server Actions de escritura
4. Si hay botones de escritura en componentes cliente, condicionarlos con `puedeEditar`
5. Agregar ruta a `TENANT_PERMISSIONS` en `src/lib/permissions.ts` si hay API legacy

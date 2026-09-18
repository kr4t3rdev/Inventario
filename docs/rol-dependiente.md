# Rol Dependiente - Documentación

## Descripción General

El rol "dependiente" es un nuevo nivel de acceso en el sistema de inventario que permite a los usuarios realizar operaciones específicas de ventas, servicios y reportes diarios, mientras restringe el acceso a funcionalidades administrativas y de gestión avanzada.

## Permisos del Rol Dependiente

### ✅ Acceso Permitido

#### API Endpoints
- `GET /api/ventas` - Consultar ventas existentes
- `POST /api/ventas` - Crear nuevas ventas
- `GET /api/venta-servicios` - Consultar ventas de servicios
- `POST /api/venta-servicios` - Crear nuevas ventas de servicios
- `GET /api/servicios` - Consultar servicios disponibles (solo lectura)
- `GET /api/ventas/stats` - Obtener estadísticas de ventas
- `GET /api/dashboard/stats` - Obtener estadísticas del dashboard
- `GET /api/reportes-financieros` - Obtener reportes financieros

#### Rutas del Frontend
- `/busy/ventas` - Página de ventas
- `/busy/servicios` - Página de servicios
- `/busy/reportes` - Página de reportes
- `/busy/reportes/venta-diaria` - Reporte de ventas diarias

### ❌ Acceso Restringido

#### Funcionalidades NO Permitidas
- **Gestión de Productos**: No pueden crear, editar o eliminar productos
- **Gestión de Categorías**: No pueden administrar categorías
- **Gestión de Inventario**: No pueden gestionar almacenes o transferencias
- **Gestión de Empleados**: No pueden acceder a asistencia, vacaciones o nómina
- **Administración de Usuarios**: No pueden crear o gestionar usuarios
- **Contabilidad Avanzada**: No pueden acceder a cuentas bancarias, reconciliaciones o exchange
- **Gastos DE**: No pueden gestionar gastos recurrentes
- **Clientes**: No pueden gestionar clientes

## Implementación Técnica

### 1. Sistema de Permisos (`src/lib/permissions.ts`)
- Define los permisos por rol mediante `ROLE_PERMISSIONS`
- Función `hasPermission()` para verificar acceso a rutas
- Filtrado de menús basado en roles

### 2. Middleware de Autenticación (`src/lib/auth-middleware.ts`)
- Wrapper `withAuthGet()` y `withAuthPost()` para rutas protegidas
- Verificación automática de permisos en cada petición API
- Respuestas de error específicas para usuarios sin permisos

### 3. Actualizaciones de Rutas API
- **Ventas** (`/api/ventas/route.ts`): Implementado con middleware de autenticación
- **Venta-Servicios** (`/api/venta-servicios/route.ts`): Implementado con middleware de autenticación
- **Servicios** (`/api/servicios/route.ts`): Implementado con restricciones específicas

### 4. Interfaz de Usuario
- **Sidebar** (`src/components/app-sidebar2.tsx`): Filtra menús según el rol del usuario
- **Administración de Usuarios**: Actualizada para incluir el rol "dependiente"
- **Creación de Usuarios**: Incluye opción para asignar rol "dependiente"

## Configuración y Uso

### Para Crear un Usuario Dependiente

1. Acceder al panel de administración como administrador
2. Ir a "Administración" > "Usuarios"
3. Hacer clic en "Crear Nuevo Usuario"
4. Completar los datos requeridos
5. En el campo "Rol", seleccionar "Dependiente"
6. Configurar fecha de expiración si es necesaria
7. Guardar el usuario

### Para Verificar Permisos

Los usuarios con rol "dependiente" solo verán en su menú:
- **Sección "Acciones"**: Solo "Ventas" y "Servicios"
- **Sección "Reportes"**: Todos los reportes disponibles

### Mensajes de Error

Cuando un dependiente intenta acceder a una ruta no autorizada, recibirá:
```json
{
  "error": "Acceso restringido para dependientes",
  "message": "Los dependientes solo pueden acceder a ventas, servicios y reportes diarios",
  "allowedRoutes": ["GET,POST /api/ventas", "GET,POST /api/venta-servicios", ...]
}
```

## Casos de Uso

### Escenario 1: Dependiente de Tienda
- Puede registrar ventas en el punto de venta
- Puede consultar inventario disponible
- Puede generar reportes de ventas diarias
- No puede modificar precios ni gestionar productos

### Escenario 2: Operador de Servicios
- Puede registrar servicios vendidos
- Puede consultar historial de servicios
- Puede acceder a reportes financieros básicos
- No puede modificar catálogos de servicios

### Escenario 3: Cajero
- Procesa transacciones de venta
- Consulta ventas del día
- Genera reportes de caja
- Acceso limitado a funcionalidades administrativas

## Beneficios del Rol Dependiente

1. **Seguridad**: Limita el acceso a funcionalidades críticas
2. **Simplicidad**: Interfaz simplificada para usuarios con tareas específicas
3. **Eficiencia**: Reduce el riesgo de errores por acceso accidental a funciones avanzadas
4. **Auditoría**: Mejor trazabilidad de acciones por tipo de usuario
5. **Flexibilidad**: Permite escalar el equipo sin dar acceso completo al sistema

## Consideraciones de Seguridad

- Todos los endpoints API verifican autenticación y autorización
- Las rutas frontend están protegidas por middleware de autenticación
- El filtrado de UI previene acceso accidental a funciones restringidas
- Los logs de auditoría pueden rastrear acciones por rol

## Extensibilidad Futura

El sistema está diseñado para ser extensible:
- Nuevos roles pueden añadirse fácilmente al sistema de permisos
- Permisos granulares pueden implementarse por ruta específica
- El middleware puede extenderse para validaciones más complejas
- La UI puede adaptarse para mostrar información contextual por rol
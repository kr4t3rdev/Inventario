# Mejoras de Control y Supervisión de Usuarios

## Resumen

Se implementaron mejoras prioritarias para el control, supervisión y seguridad de usuarios en el sistema de gestión de inventario, enfocadas en:

- Auditoría completa de cambios y acciones
- Gestión de sesiones activas con cierre remoto
- Seguridad de acceso con bloqueo por intentos fallidos
- Notificaciones automáticas a administradores cuando un usuario es bloqueado
- Notificaciones automáticas a administradores cuando un usuario tiene 3+ intentos fallidos (alerta temprana)
- Panel de monitoreo con pestañas:
  - Logs de actividad
  - Sesiones activas
  - Usuarios bloqueados (con desbloqueo manual)
  - Usuarios que expiran pronto (nuevo)
- Desbloqueo manual de usuarios desde el panel de monitoreo
- Bloqueo manual de usuarios por administradores
- Historial completo de intentos fallidos por usuario
- Alertas automáticas para administradores sobre usuarios que expiran pronto
- Exportación de datos para auditorías externas

---

## Resultado del Build

**Build Exitoso**
- 148 páginas generadas
- Sin errores
- Sin warnings
- Nuevo endpoint API: `/api/admin/users/unlock`

**Rutas API Actualizadas**:
- `POST /api/admin/users/unlock` - Desbloquear usuario
- `POST /api/admin/users/lock` - Bloqueo manual usuario
- `GET /api/admin/users/[userId]/login-history` - Historial de intentos
- `GET /api/admin/users/expiring-soon` - Usuarios que expiran pronto
- `POST /api/admin/users/expiring-soon` - Enviar alertas de expiración (NUEVO)
- `POST /api/auth/login` - Ahora notifica admins (3+ intentos) y registra cada intento fallido

**Componentes Actualizados**:
- `UserMonitoringPanel` - Pestañas: Logs, Sesiones, Bloqueados, Expiran Pronto (NUEVO)
- `LoginHistoryDialog` - Diálogo de historial completo con bloqueo/desbloqueo
- `admin-users-table` - Botón de exportación agregado
- `admin/usuarios/page` - Estadística de usuarios bloqueados agregada

## Cambios Realizados

### 1. Auditoría de Cambios

#### Modificaciones en Base de Datos

**Schema Prisma (`prisma/schema.prisma`)**
- Agregado campo `lastModifiedBy: String?` - ID del usuario que realizó el último cambio
- Agregado campo `loginAttempts: Int @default(0)` - Contador de intentos de login fallidos
- Agregado campo `lockedUntil: DateTime?` - Timestamp de bloqueo temporal
- Agregado campo `lastFailedLogin: DateTime?` - Último intento de login fallido

**Nuevo Modelo: UserActivityLog**
```prisma
model UserActivityLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [userId], onDelete: Cascade)
  action    String   // "login", "logout", "create_user", "update_user", "delete_user", "role_change", "password_change"
  details   String?  // Detalles JSON de la acción
  ipAddress String?
  userAgent String?
  performedBy String?  // ID del usuario que realizó la acción
  createdAt DateTime @default(now())
}
```

#### API Routes

**POST /api/admin/activity-logs**
- Registra acciones de usuarios
- Requiere autenticación de admin
- Registra IP, userAgent y autor de la acción

**GET /api/admin/activity-logs**
- Obtiene historial de actividad
- Filtros: `userId`, `limit` (default 50)
- Incluye información del usuario relacionado

#### Implementación en Componentes

- **Create User**: Registra acción `create_user` al crear usuario
- **Update User**: Registra acción `update_user` con campos modificados
- **Delete User**: Registra acción `delete_user` con datos completos del usuario eliminado

### 2. Gestión de Sesiones Activas

#### Modificaciones en Base de Datos

**Nuevo Modelo: UserSession**
```prisma
model UserSession {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [userId], onDelete: Cascade)
  token     String   @unique
  ipAddress String?
  userAgent String?
  isActive  Boolean  @default(true)
  expiresAt DateTime?
  createdAt DateTime @default(now())
  lastActive DateTime @default(now())
}
```

#### API Routes

**GET /api/admin/sessions**
- Lista todas las sesiones activas
- Filtro opcional por `userId`
- Incluye información del usuario

**DELETE /api/admin/sessions?sessionId={id}**
- Cierra una sesión específica
- Marca `isActive: false`
- Requiere autenticación de admin
- **IMPORTANTE**: El usuario será redirigido automáticamente al login

#### Implementación en Flujo de Autenticación

**POST /api/auth/login**
- Crea sesión automáticamente al login exitoso
- Registra IP y userAgent
- Expira en 7 días

**POST /api/auth/logout**
- Marca todas las sesiones del usuario como inactivas
- Limpia cookie de token

#### Verificación de Sesiones Activas

**Middleware de Autenticación (`src/lib/auth-utils.ts`)**
- Verifica si la sesión asociada al token está activa
- Si `isActive: false`: Retorna null (no autenticado)
- Actualiza `lastActive` en cada petición

**Middleware de API (`src/lib/auth-middleware.ts`)**
- Agrega verificación de sesión activa
- Mensajes específicos para sesiones cerradas remotamente:
  - `Sesión no válida`: Sesión cerrada por administrador
  - `Sesión expirada`: Token vencido
- Retorna 401 para forzar logout del cliente

#### Interceptor Global de Fetch (`src/lib/token.ts`)

**Funcionalidad**:
- Intercepta todas las peticiones fetch del cliente
- Detecta respuestas 401 con errores de sesión:
  - `Sesión no válida`
  - `Sesión expirada`
- **Acción automática**:
  - Limpia token de sessionStorage
  - Muestra toast: "Su sesión ha sido cerrada..."
  - Redirige a `/login`
- Detecta respuestas 403 para usuario inactivo:
  - Limpia token de sessionStorage
  - Muestra toast: "Su cuenta ha sido desactivada..."
  - Redirige a `/login`

#### Verificación Periódica de Sesión (`src/contexts/auth-context.tsx`)

**Polling cada 30 segundos**:
- Verifica validez de sesión en background
- Si la sesión fue cerrada remotamente:
  - Limpia token de sessionStorage
  - Muestra toast de error
  - Redirige a `/login`

**Verificación al cambiar de pestaña**:
- Usa `visibilitychange` event
- Verifica sesión cuando el usuario regresa a la aplicación
- Útil para detectar sesiones cerradas mientras estaba en otra pestaña

### 3. Seguridad: Intentos de Login Fallidos

#### Constantes de Configuración

```typescript
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME_MINUTES = 15
```

#### Lógica Implementada en `/api/auth/login`

1. **Verificación de Bloqueo**
   - Si `lockedUntil` > ahora: Retorna error con tiempo restante

2. **Conteo de Intentos Fallidos**
   - Incrementa `loginAttempts` en cada fallo
   - Si `loginAttempts >= MAX_LOGIN_ATTEMPTS`: Bloquea cuenta por 15 minutos
   - **NUEVO**: Crea notificación para todos los administradores cuando un usuario es bloqueado
   - Retorna advertencia con intentos restantes

3. **Reset al Login Exitoso**
   - Resetea `loginAttempts` a 0
   - Limpia `lockedUntil` y `lastFailedLogin`

4. **Mensajes de Error**
   - `Credenciales inválidas. X intentos restantes.`
   - `Cuenta bloqueada por 15 minutos debido a múltiples intentos fallidos.`
   - `Cuenta bloqueada. Intente nuevamente en X minutos.`

#### Notificación a Administradores

Cuando un usuario alcanza el máximo de intentos fallidos:
- Se crea una notificación para cada administrador activo
- Título: "Usuario bloqueado por intentos fallidos"
- Mensaje: "El usuario X (email) ha sido bloqueado tras 5 intentos fallidos de inicio de sesión."
- Tipo: `error`, Prioridad: `alta`
- Visible en el panel de notificaciones de todos los administradores

### 4. Exportación de Datos

#### API Route

**GET /api/admin/users/export?format=csv**
- Requiere autenticación de admin
- Exporta todos los campos de usuarios
- Campos exportados:
  - User ID, Nombre, Email, Rol, Activo
  - Fecha Activación, Fecha Expiración, Fecha Creación
  - Última Modificación, Intentos Login
  - Bloqueado Hasta, Último Fallido

#### UI Implementation

**Botón de Exportación**
- Ubicación: `admin-users-table.tsx`
- Icono: `Download` de lucide-react
- Funcionalidad:
  - Descarga archivo CSV
  - Nombre: `usuarios_YYYY-MM-DD.csv`
  - Notificación de éxito/error

### 5. Panel de Monitoreo de Usuarios

#### Nuevo Componente: UserMonitoringPanel

**Ubicación**: `src/components/admin/user-monitoring-panel.tsx`

**Características**:
- Pestañas para alternar entre Logs y Sesiones
- **Logs Tab**:
  - Lista de actividades recientes
  - Badges coloridos por tipo de acción
  - Filtro de cantidad (10, 50, 100 registros)
  - Columnas: Acción, Usuario, Realizado por, IP, Fecha
- **Sessions Tab**:
  - Lista de sesiones activas
  - Estado (Activa/Inactiva)
  - IP, Fecha creación, Última actividad, Expiración
  - Botón para cerrar sesión individual

**Badges de Acción**:
- 🟢 Login (Verde)
- ⚪ Logout (Gris)
- 🔵 Crear Usuario (Azul)
- 🟠 Actualizar (Naranja)
- 🔴 Eliminar (Rojo)
- 🟣 Cambio Rol (Púrpura)
- 🔴 Contraseña (Rojo)

### 6. Desbloqueo de Usuarios

#### API Route: `/api/admin/users/unlock`

**POST /api/admin/users/unlock**
- Desbloquea un usuario que fue bloqueado por intentos fallidos
- Requiere autenticación de admin
- Acciones:
  - Resetea `loginAttempts` a 0
  - Limpia `lockedUntil`
  - Limpia `lastFailedLogin`
  - Crea log de actividad `unlock_user`
- Retorna: usuario desbloqueado con mensaje de éxito

#### Redux API

**`useUnlockUserMutation`**
```typescript
const [unlockUser] = useUnlockUserMutation()

const handleUnlock = async (userId: string) => {
  await unlockUser({ userId }).unwrap()
}
```

### 7. Panel de Monitoreo Mejorado

#### Nueva Pestaña: "Bloqueados"

**Características**:
- Muestra todos los usuarios actualmente bloqueados
- Columnas:
  - **Usuario**: Nombre y email
  - **Intentos**: Badge mostrando X/5 intentos
  - **Último fallo**: Fecha y hora del último intento fallido
  - **Bloqueado hasta**: Fecha y hora de fin del bloqueo
  - **Tiempo restante**: Badge mostrando minutos restantes (en tiempo real)
  - **Acciones**: Botón "Desbloquear" con icono de candado abierto
- Badge de conteo en el botón de la pestaña (ej: "Bloqueados (2)")
- Mensaje "No hay usuarios bloqueados" cuando no hay usuarios bloqueados

**Funcionalidades**:
- Cálculo en tiempo real del tiempo restante de bloqueo
- Desbloqueo inmediato con un clic
- Toast de confirmación al desbloquear
- Refresco automático de la lista tras desbloquear

### 8. Dashboard Mejorado

#### Modificaciones en `/busy/admin/usuarios/page.tsx`

**Nueva Estadística**:
- **Usuarios Bloqueados**: Muestra cuentas bloqueadas por intentos fallidos

**Grid Expandido**:
- De 4 columnas a 5 columnas
- Nuevas métricas visuales con iconos

**Cards de Estadísticas**:
1. Usuarios Activos (Verde)
2. Usuarios Inactivos (Rojo)
3. Administradores (Azul)
4. **Bloqueados** (Púrpura) - NUEVO
5. Expiran Pronto (Naranja)

### 7. Actualización de Tipos TypeScript

**Modelos agregados en `src/app/models/model.ts`**:
```typescript
export interface UserActivityLog {
  id: string
  userId: string
  action: string
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  performedBy: string | null
  createdAt: string
}

export interface UserSession {
  id: string
  userId: string
  token: string
  ipAddress: string | null
  userAgent: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  lastActive: string
}
```

**Interface Usuario actualizada**:
```typescript
export interface Usuario {
  // ... campos existentes
  lastModifiedBy: string | null
  loginAttempts: number
  lockedUntil: string | null
  lastFailedLogin: string | null
}
```

### 8. Redux API Actualizado

**`src/lib/redux/services/adminApi.tsx`**:
- `useGetActivityLogsQuery({ userId?, limit? })`
- `useGetSessionsQuery({ userId? })`
- `useDeleteSessionMutation(sessionId)`

**`src/lib/redux/services/apiSlice.tsx`**:
- Tags agregados: `'ActivityLogs'`, `'Sessions'`

## Archivos Modificados/Creados

### Archivos Modificados

1. `prisma/schema.prisma` - Nuevos modelos y campos
2. `src/app/models/model.ts` - Tipos TypeScript actualizados
3. `src/lib/redux/services/apiSlice.tsx` - Tags agregados
4. `src/lib/redux/services/adminApi.tsx` - Endpoints nuevos
5. `src/app/api/admin/users/route.ts` - Auditoría en create
6. `src/app/api/admin/users/[id]/route.ts` - Auditoría en update/delete
7. `src/app/api/auth/login/route.ts` - Sesiones + bloqueo + notificaciones admin
8. `src/app/api/auth/logout/route.ts` - Cierre de sesiones
9. `src/lib/auth-utils.ts` - Verificación de sesión activa
10. `src/lib/auth-middleware.ts` - Verificación de sesión en middleware
11. `src/lib/token.ts` - Interceptor global de fetch
12. `src/contexts/auth-context.tsx` - Polling de sesión + visibility change
13. `src/components/admin/create-user-dialog.tsx` - Formulario actualizado
14. `src/components/admin/admin-users-table.tsx` - Botón exportar
15. `src/components/admin/user-monitoring-panel.tsx` - Nueva pestaña bloqueados
16. `src/app/busy/admin/usuarios/page.tsx` - Panel monitoreo + estadísticas

### Archivos Creados

1. `src/app/api/admin/activity-logs/route.ts` - API de logs
2. `src/app/api/admin/sessions/route.ts` - API de sesiones
3. `src/app/api/admin/users/unlock/route.ts` - API para desbloquear usuarios
4. `src/app/api/admin/users/export/route.ts` - Exportación CSV
5. `src/components/admin/user-monitoring-panel.tsx` - Panel UI con pestaña bloqueados

## Comandos Ejecutados

```bash
# Aplicar cambios de esquema a la BD
npx prisma db push

# Build de producción
pnpm run build
```

## Resultado del Build

```
✓ Compiled successfully in 65s
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (147/147)
```

**Sin errores.** 147 páginas generadas exitosamente.

## Beneficios Obtenidos

### Seguridad
- ✅ Trazabilidad completa de cambios
- ✅ Bloqueo automático por fuerza bruta
- ✅ Control de sesiones concurrentes
- ✅ Auditoría de acciones críticas

### Supervisión
- ✅ Panel de monitoreo en tiempo real
- ✅ Historial de actividad detallado
- ✅ Visibilidad de sesiones activas
- ✅ Estadísticas de usuarios bloqueados

### Operatividad
- ✅ Exportación de datos para auditoría externa
- ✅ Cierre remoto de sesiones
- ✅ Identificación de patrones sospechosos
- ✅ Análisis de comportamiento de usuarios

### Cumplimiento
- ✅ Registro de quién modifica qué y cuándo
- ✅ Tracking de IPs y dispositivos
- ✅ Conservación de historial de cambios
- ✅ Facilidad para auditorías de seguridad

## Configuración

Parámetros configurables en `/src/app/api/auth/login/route.ts`:

```typescript
const MAX_LOGIN_ATTEMPTS = 5        // Intentos permitidos antes del bloqueo
const LOCK_TIME_MINUTES = 15        // Duración del bloqueo en minutos
const TOKEN_EXPIRATION_DAYS = 7      // Expiración del token JWT en días
```

Parámetros configurables en `/src/contexts/auth-context.tsx`:

```typescript
const SESSION_CHECK_INTERVAL = 30000  // Intervalo de verificación de sesión (30 segundos)
```

## Flujo Completo: Manejo de Usuarios Bloqueados

### 1. Usuario intenta loguearse incorrectamente

1. **Intentos 1-4**:
   - Usuario ingresa credenciales incorrectas
   - Sistema incrementa contador de intentos
   - Mensaje: "Credenciales inválidas. X intentos restantes."
   - NO se notifica a administradores

2. **Intento 5** (Bloqueo):
   - Usuario intenta loguearse por 5ta vez con credenciales incorrectas
   - Sistema bloquea cuenta por 15 minutos
   - Se crea notificación para TODOS los administradores activos
   - Mensaje al usuario: "Cuenta bloqueada por 15 minutos debido a múltiples intentos fallidos."

### 2. Administrador recibe notificación

1. **Notificación aparece en panel**:
   - Título: "Usuario bloqueado por intentos fallidos"
   - Contenido: "El usuario X (email) ha sido bloqueado tras 5 intentos fallidos de inicio de sesión."
   - Tipo: `error`, Prioridad: `alta`

2. **Acciones disponibles para el admin**:
   - Ir al panel de monitoreo de usuarios
   - Revisar la pestaña "Bloqueados"
   - Contactar al usuario para verificar
   - Desbloquear manualmente si es legítimo

### 3. Administrador revisa usuarios bloqueados

1. **Navega a la pestaña "Bloqueados"**:
   - Ve lista de usuarios bloqueados
   - Para cada usuario ve:
     - Nombre y email
     - Intentos fallidos (X/5)
     - Fecha del último fallo
     - Hasta cuándo está bloqueado
     - Tiempo restante en minutos

2. **Decide acción**:
   - **Opción A**: Esperar a que expire el bloqueo (automático)
   - **Opción B**: Desbloquear manualmente (inmediato)

### 4. Administrador desbloquea usuario manualmente

1. **Hace clic en "Desbloquear"**
2. **Sistema**:
   - Resetea `loginAttempts` a 0
   - Limpia `lockedUntil`
   - Limpia `lastFailedLogin`
   - Registra acción en logs (`unlock_user`)
3. **Confirmación**:
   - Toast: "Usuario desbloqueado correctamente"
   - Lista se actualiza automáticamente
   - Usuario puede intentar loguearse nuevamente

### 5. Usuario intenta loguearse nuevamente

1. **Después de desbloqueo**:
   - Usuario ingresa credenciales correctas
   - Sistema verifica que no está bloqueado
   - Usuario accede normalmente

2. **Después de expiración del bloqueo**:
   - Usuario espera los 15 minutos
   - Bloqueo expira automáticamente
   - Intenta loguearse nuevamente
   - Primer intento correcto: acceso exitoso
   - Primer intento incorrecto: contador vuelve a 1

## Recomendaciones de Uso

1. **Revisar regularmente** el panel de monitoreo para identificar actividad sospechosa
2. **Exportar datos** periódicamente para auditorías externas
3. **Cerrar sesiones** de usuarios que ya no necesitan acceso
4. **Monitorear usuarios bloqueados**:
   - Revisar la pestaña "Bloqueados" para ver usuarios con intentos fallidos
   - Desbloquear manualmente si es necesario antes del tiempo de bloqueo
   - Contactar a usuarios bloqueados para verificar si fueron ellos
5. **Analizar logs** tras incidentes de seguridad
6. **Verificar notificaciones**:
   - Los administradores recibirán notificaciones cuando un usuario sea bloqueado
   - Revisar el panel de notificaciones regularmente
   - Tomar acción inmediata ante múltiples bloqueos
7. **Cierre de sesión remoto**: Al cerrar una sesión desde el panel de monitoreo:
   - El usuario será redirigido al login automáticamente:
     - En su próxima petición (clic en cualquier acción)
     - O al cambiar de pestaña y volver
     - O máximo en 30 segundos (polling)
   - Verá un toast: "Su sesión ha sido cerrada. Por favor inicie sesión nuevamente."
   - No podrá continuar usando la aplicación sin volver a loguearse
8. **Desbloqueo de usuarios**:
   - Use el botón "Desbloquear" en la pestaña "Bloqueados"
   - El usuario podrá intentar loguearse inmediatamente
   - Se registra la acción en el log de auditoría

## Próximas Mejoras Sugeridas

1. ~~Notificaciones automáticas para usuarios que expiran pronto~~ ✅ Completado
2. Batch operations (selección múltiple para activar/desactivar usuarios)
3. Configuración de alertas tempranas (días customizable)
4. Reportes de actividad por periodo (semanal/mensual/anual)
5. Gráficos de actividad en dashboard
6. Dashboard temporal con métricas mensuales
7. Confirmación doble para desactivación de usuarios
- ~~Historial de intentos fallidos por usuario~~ ✅ Completado
- ~~Alertas cuando un usuario tiene múltiples intentos fallidos pero aún no está bloqueado~~ ✅ Completado
- ~~Opción para bloquear/desbloquear usuarios manualmente (independiente de intentos)~~ ✅ Completado

---

## Actualización de la Implementación - Tercera Fase

### Novedades Implementadas

#### Notificaciones Automáticas para Usuarios que Expiran Pronto

**Nuevo Endpoint**: `POST /api/admin/users/expiring-soon`

**Funcionalidad**:
- Envia notificaciones a todos los administradores sobre usuarios que expiran pronto
- Filtro configurable por días (default: 7 días)
- Evita duplicados: no crea notificaciones repetidas en 24 horas

**Parámetros**:
- `days`: Número de días de anticipación (3, 7, 14, 30)

**Proceso**:
1. Busca usuarios activos con fecha de expiración definida
2. Filtra aquellos que expiran en los próximos X días
3. Para cada usuario, verifica si ya existe notificación reciente (últimas 24h)
4. Crea notificación para cada administrador:
   - Título: "Usuario expirará pronto"
   - Mensaje: "El usuario X (email) expirará en Y días (fecha)."
   - Tipo: `warning`
   - Prioridad: `media`

**Endpoint de Consulta**: `GET /api/admin/users/expiring-soon?days=7`

**Response**:
```json
{
  "users": [
    {
      "userId": "user-123",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "expiresAt": "2026-01-21T00:00:00.000Z",
      "role": "regularUser",
      "daysUntilExpiry": 5,
      "createdAt": "2026-01-14T00:00:00.000Z"
    }
  ],
  "total": 3
}
```

**Nueva Pestaña en Panel de Monitoreo**: "Expiran Pronto"

**Características**:
- Selector de días: 3, 7, 14, 30 días
- Tabla con información de usuarios que expiran:
  - Nombre y email
  - Rol (con badge de color)
  - Fecha de expiración
  - Días restantes (con badge de color según urgencia)
    - **Rojo**: 1-3 días
    - **Naranja**: 4-7 días
    - **Amarillo**: 8-30 días
- Botón "Enviar Alertas":
  - Crea notificaciones para todos los administradores
  - Muestra toast con cantidad de notificaciones creadas
  - Deshabilitado si no hay usuarios que expiran
- Botón "Historial" para ver detalles del usuario

**UI Indicadores**:
- Badge con conteo de usuarios que expiran
- Colores según urgencia de expiración
- Vista en tiempo real con cálculo de días restantes

**Flujo de Trabajo**:

1. **Ver usuarios que expiran**:
   - Admin navega a pestaña "Expiran Pronto"
   - Selecciona rango de días (7, 14, 30)
   - Lista de usuarios con días restantes

2. **Decidir acción**:
   - **Opción A**: Enviar alertas automáticas a todos los administradores
   - **Opción B**: Contactar a usuarios individualmente
   - **Opción C**: Extender fecha de expiración

3. **Enviar alertas**:
   - Hacer clic en botón "Enviar Alertas"
   - Sistema crea notificaciones para todos los admins
   - Toast: "Notificaciones enviadas: X administradores notificados"

4. **Monitoreo continuo**:
   - Ver pestaña regularmente
   - Cambiar rango de días según necesidad
   - Enviar alertas periódicamente

**Reglas de Negocio**:
- Solo usuarios activos con fecha de expiración definida
- Máximo una notificación por usuario cada 24 horas
- Solo administradores reciben notificaciones
- Prioridad `media` (no `alta` como bloqueos)

**Configuración Actual**:
```typescript
// Rangos disponibles en UI
const EXPIRY_DAYS = [3, 7, 14, 30]

// Colores de urgencia
const URGENCY_COLORS = {
  critical: "border-red-500 text-red-600",   // 1-3 días
  high: "border-orange-500 text-orange-600", // 4-7 días
  medium: "border-yellow-500 text-yellow-600"  // 8-30 días
}
```

---

## Actualización de la Implementación - Segunda Fase

### Novedades Implementadas

#### 8. Historial de Intentos Fallidos por Usuario

**Nuevo Componente**: `LoginHistoryDialog`

**Características**:
- Muestra el historial completo de intentos fallidos de un usuario
- Información mostrada:
  - **Estado actual**: Bloqueado/Activo con badge
  - **Intentos fallidos**: Contador X/5
  - **Último fallo**: Fecha y hora
- Tabla de últimos 20 intentos fallidos:
  - Fecha y hora exacta
  - IP address del intento
  - User agent (navegador/dispositivo)
  - Número de intento (X/5)
- Tabla de actividad relacionada (bloqueos/desbloqueos):
  - Acción realizada (Bloqueado/Desbloqueado)
  - Fecha y hora
  - Quién realizó la acción
  - Razón del bloqueo

**API Endpoint**: `GET /api/admin/users/[userId]/login-history`

**Response**:
```json
{
  "user": {
    "userId": "user-123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "loginAttempts": 3,
    "lockedUntil": "2026-01-14T18:00:00.000Z",
    "lastFailedLogin": "2026-01-14T17:30:00.000Z"
  },
  "logs": [...],
  "failedAttempts": [...],
  "totalFailedAttempts": 5
}
```

**Uso**:
- Botón de historial en la tabla de usuarios bloqueados
- También disponible desde el diálogo de historial con botón de bloqueo/desbloqueo

#### 9. Alertas de Múltiples Intentos Fallidos (Aún No Bloqueado)

**Implementación en `/api/auth/login`**:

**Lógica**:
- Cuando un usuario acumula **3 o más intentos fallidos** pero aún no está bloqueado
- Se crea una notificación de **alerta** para todos los administradores
- **Antes** del bloqueo automático (en el 5to intento)

**Notificación**:
- Título: "Alerta: Múltiples intentos fallidos"
- Mensaje: "El usuario X (email) ha realizado Y intentos fallidos de inicio de sesión. Posible ataque de fuerza bruta."
- Tipo: `warning` (no `error`)
- Prioridad: `alta`

**Beneficios**:
- **Alerta temprana**: Detecta posibles ataques antes del bloqueo
- **Acción preventiva**: Permite a los administradores investigar antes del bloqueo
- **Monitoreo proactivo**: No hay que esperar al bloqueo para actuar

**Comparativa de alertas**:
| Situación | Tipo | Mensaje |
|-----------|------|---------|
| 3+ intentos fallidos | `warning` | Alerta de posible ataque |
| 5 intentos (bloqueo) | `error` | Usuario bloqueado |

#### 10. Bloqueo/Desbloqueo Manual de Usuarios

**Nuevo Endpoint**: `POST /api/admin/users/lock`

**Request Body**:
```json
{
  "userId": "user-123",
  "reason": "Comportamiento sospechoso detectado"
}
```

**Response**:
```json
{
  "user": {
    "userId": "user-123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "role": "regularUser",
    "isActive": false,
    "lockedUntil": "2026-01-14T18:00:00.000Z"
  },
  "message": "Usuario bloqueado correctamente"
}
```

**Funcionalidades**:
- Bloqueo manual por 15 minutos (independiente de intentos)
- Opcional: Razón del bloqueo (registrada en logs)
- Desactiva usuario (`isActive: false`)
- Cierra todas las sesiones activas del usuario
- Registra acción en logs (`manual_lock`)

**Componente UI**:
- Botón "Bloquear" disponible para usuarios NO bloqueados
- Botón "Desbloquear" disponible para usuarios bloqueados
- Diálogo de confirmación para bloqueo con campo de razón opcional
- Toast de confirmación tras acción

**Reglas de negocio**:
- Cualquier usuario puede ser bloqueado manualmente, incluso administradores
- Solo administradores pueden bloquear usuarios
- Desbloqueo manual es inmediato (sin esperar al tiempo de expiración)
- Bloqueo manual se registra con IP y userAgent del admin

### Integración en Panel de Monitoreo

**Mejoras en `UserMonitoringPanel`**:

1. **Nueva pestaña "Bloqueados" mejorada**:
   - Tabla con historial de cada usuario bloqueado
   - Botón "Historial" (icono de reloj) para ver detalles completos
   - Botón "Desbloquear" para liberar usuario
   - Visualización en tiempo real del tiempo restante

2. **Diálogos modales**:
   - `LoginHistoryDialog`: Muestra historial completo del usuario
   - `AlertDialog` de bloqueo: Confirmación con razón opcional

3. **Flujo de usuario mejorado**:
   - Admin ve usuario en pestaña "Bloqueados"
   - Hace clic en "Historial" → Ve todos los intentos fallidos
   - Desde el diálogo puede desbloquear o bloquear manualmente
   - Todo queda registrado en el log de auditoría

---

## Archivos Nuevos/Modificados en Segunda Fase

### Archivos Nuevos

1. `src/app/api/admin/users/[userId]/login-history/route.ts` - Historial de intentos
2. `src/app/api/admin/users/lock/route.ts` - Bloqueo manual
3. `src/components/admin/login-history-dialog.tsx` - Diálogo de historial

### Archivos Modificados

1. `src/app/api/auth/login/route.ts` - Alertas tempranas + registro de intentos
2. `src/lib/redux/services/adminApi.tsx` - Hooks nuevos (`useGetUserLoginHistoryQuery`, `useLockUserMutation`)
3. `src/lib/redux/services/apiSlice.tsx` - Tag `'LoginHistory'` agregado
4. `src/components/admin/user-monitoring-panel.tsx` - Integración de nuevas funcionalidades

---

## Novedades Implementadas (Posterior a la Versión Inicial)

#### Notificaciones Automáticas de Bloqueo

**Funcionalidad**:
- Cuando un usuario alcanza 5 intentos fallidos, todos los administradores reciben una notificación
- La notificación incluye:
  - Nombre y email del usuario bloqueado
  - Razón del bloqueo
  - Prioridad alta
- Visible en el panel de notificaciones de cada administrador

**Beneficios**:
- Alerta inmediata de posibles ataques de fuerza bruta
- Permite a los administradores tomar acción preventiva
- Facilita el seguimiento de incidentes de seguridad

#### Pestaña de Usuarios Bloqueados

**Nueva pestaña en UserMonitoringPanel**:
- Muestra todos los usuarios actualmente bloqueados
- Información detallada:
  - Nombre y email del usuario
  - Número de intentos fallidos (X/5)
  - Fecha del último fallo
  - Hasta cuándo está bloqueado
  - Tiempo restante en minutos (actualizado en tiempo real)

**Acciones disponibles**:
- Botón "Desbloquear" para liberar al usuario manualmente
- Desbloqueo inmediato con un clic
- Confirmación mediante toast notification

**Flujo de desbloqueo**:
1. Admin hace clic en "Desbloquear"
2. Se llama a `/api/admin/users/unlock`
3. Se resetean: `loginAttempts`, `lockedUntil`, `lastFailedLogin`
4. Se registra acción en logs (`unlock_user`)
5. Toast: "Usuario desbloqueado correctamente"
6. La lista se actualiza automáticamente

#### API de Desbloqueo

**Endpoint**: `POST /api/admin/users/unlock`

**Request Body**:
```json
{
  "userId": "user-123"
}
```

**Response**:
```json
{
  "user": {
    "userId": "user-123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "loginAttempts": 0,
    "lockedUntil": null
  },
  "message": "Usuario desbloqueado correctamente"
}
```

**Permisos**:
- Requiere autenticación
- Solo administradores pueden desbloquear usuarios

#### Redux API Actualizado

**Nuevo Hook**: `useUnlockUserMutation`

```typescript
const [unlockUser] = useUnlockUserMutation()

const handleUnlock = async (userId: string) => {
  const result = await unlockUser({ userId }).unwrap()
  // result.user - usuario desbloqueado
  // result.message - mensaje de confirmación
}
```

**Invalidates Tags**:
- `'Admin'` - Refresca lista de usuarios
- `'ActivityLogs'` - Refresca logs de actividad


## Resultado del Build - Tercera Fase

**Build Exitoso**
- 150 páginas generadas
- Sin errores
- Sin warnings

**Rutas API Nuevas**
- `GET /api/admin/users/expiring-soon` - Consultar usuarios que expiran pronto
- `POST /api/admin/users/expiring-soon` - Enviar alertas de expiración

**Funcionalidades Implementadas**
1. ✅ Auditoría de cambios completa
2. ✅ Gestión de sesiones activas
3. ✅ Bloqueo automático por intentos fallidos
4. ✅ Alertas tempranas (3+ intentos)
5. ✅ Notificaciones de usuarios bloqueados
6. ✅ Historial de intentos fallidos
7. ✅ Bloqueo/desbloqueo manual
8. ✅ Notificaciones automáticas de usuarios que expiran pronto

**Panel de Monitoreo Completo con 4 pestañas**:
1. Logs - Historial de actividad
2. Sesiones - Gestión de sesiones activas
3. Bloqueados - Usuarios bloqueados con desbloqueo manual
4. Expiran Pronto - Usuarios que expiran pronto + alertas automáticas

---

## Resumen Final de Implementaciones

Sistema de control y supervisión de usuarios completo con:

### Seguridad
- ✅ Bloqueo automático tras 5 intentos fallidos
- ✅ Alertas tempranas al tercer intento fallido
- ✅ Verificación de sesiones activas en cada petición
- ✅ Cierre remoto de sesiones por administrador
- ✅ Interceptor de errores 401/403 con logout automático
- ✅ Polling de sesión cada 30 segundos
- ✅ Verificación al cambiar de pestaña del navegador

### Auditoría
- ✅ Registro de todas las acciones de usuarios
- ✅ Tracking de IP y userAgent en cada acción
- ✅ Historial de intentos fallidos por usuario
- ✅ Registro de quién realizó cada cambio
- ✅ Logs de bloqueo/desbloqueo manual

### Monitoreo
- ✅ Panel con 4 pestañas (Logs, Sesiones, Bloqueados, Expiran Pronto)
- ✅ Notificaciones automáticas a administradores:
  - Cuando un usuario es bloqueado
  - Cuando un usuario tiene 3+ intentos fallidos (alerta temprana)
  - Cuando un usuario expirará pronto
- ✅ Estadísticas de usuarios bloqueados y que expiran pronto
- ✅ Vista en tiempo real de tiempo restante de bloqueo

### Gestión
- ✅ Bloqueo manual de usuarios
- ✅ Desbloqueo manual de usuarios
- ✅ Cierre remoto de sesiones individuales
- ✅ Envío manual de alertas de expiración
- ✅ Filtros por días (3, 7, 14, 30)
- ✅ Historial detallado de cada usuario

**Total de mejoras implementadas: 10 funcionalidades completas**


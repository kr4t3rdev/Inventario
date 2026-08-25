import { normalizeUserRole, isTenantAdminRole, type AppUserRole, type TenantRole } from '@/lib/auth/roles';
export type { TenantRole };

/**
 * Sistema de permisos basado en roles para el sistema de inventario
 * Define qué rutas y funcionalidades puede acceder cada rol
 */

// Tipos de roles disponibles
export type UserRole = AppUserRole;

/**
 * Definición de permisos por rol de tenant.
 * manager: todo dentro del tenant (usuarios, plan, licencias, config)
 * economico: finanzas, reportes, licencias operativas
 * dependiente: operaciones diarias
 */
export const TENANT_PERMISSIONS: Record<TenantRole, string[]> = {
  manager: ['*'],
  economico: [
    '/api/reportes-financieros',
    '/api/ventas/stats',
    '/api/dashboard/stats',
    '/api/contabilidad/*',
    '/api/gastos-de-explotacion/*',
    '/busy/reportes/*',
  ],
  dependiente: [
    'GET /api/ventas',
    'POST /api/ventas',
    'GET /api/productos',
    'GET /api/facturas/*',
    '/api/restaurante/*',
    '/busy/sales',
    '/busy/servicios',
    '/busy/reportes',
    '/busy/reportes/venta-diaria',
    '/busy/restaurante/*',
  ],
};

// Definición de permisos por rol de plataforma
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    '/api/*',
    '/busy/*',
  ],
  regularUser: [],
  salesAgent: [],

}

/**
 * Verifica si un usuario con el rol especificado tiene acceso a una ruta
 * @param userRole - Rol del usuario
 * @param path - Ruta a verificar
 * @param method - Método HTTP (GET, POST, PUT, DELETE)
 * @returns true si tiene acceso, false en caso contrario
 */
export function hasPermission(userRole: UserRole | string, path: string, method?: string): boolean {
  const normalizedRole = normalizeUserRole(userRole);
  if (!normalizedRole) {
    return false;
  }

  const permissions = ROLE_PERMISSIONS[normalizedRole]
  if (!permissions) return false

  // Admin tiene acceso a todo
  if (normalizedRole === 'admin') return true

  // Verificar permisos específicos
  for (const permission of permissions) {
    // Manejar wildcards
    if (permission.includes('/*')) {
      const basePath = permission.replace('/*', '')
      if (path.startsWith(basePath)) {
        return true
      }
    }
    
    // Manejar rutas específicas con método
    if (method && permission.includes(' ')) {
      const [permMethod, permPath] = permission.split(' ')
      if (permMethod === method && path === permPath) {
        return true
      }
    }
    
    // Manejar rutas sin método específico
    if (path === permission || path.startsWith(permission + '/')) {
      return true
    }
  }

  return false
}

/**
 * Middleware para verificar permisos en rutas de API
 * @param userRole - Rol del usuario autenticado
 * @param requestPath - Ruta de la petición
 * @param requestMethod - Método HTTP de la petición
 * @returns Response de error si no tiene permisos, null si está autorizado
 */
export function checkApiPermission(
  userRole: UserRole | string, 
  requestPath: string, 
  requestMethod: string
): Response | null {
  if (!hasPermission(userRole, requestPath, requestMethod)) {
    return new Response(
      JSON.stringify({ 
        error: 'No tienes permisos para acceder a esta ruta',
        requiredRole: 'admin',
        message: 'Solo el administrador global puede acceder a esta ruta'
      }), 
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  return null
}

/**
 * Filtra elementos del menú basados en el rol del usuario
 * @param menuItems - Items del menú a filtrar
 * @param userRole - Rol del usuario
 * @returns Items del menú filtrados
 */
export function filterMenuItems(menuItems: any[], userRole: UserRole): any[] {
  if (userRole === 'admin') return menuItems

  // regularUser no tiene acceso a nada
  return []
}

/**
 * Verifica si una ruta del frontend es accesible para el rol
 * @param userRole - Rol del usuario
 * @param frontendPath - Ruta del frontend (ej: '/busy/ventas')
 * @returns true si es accesible
 */
export function isFrontendRouteAccessible(userRole: UserRole, frontendPath: string): boolean {
  return hasPermission(userRole, frontendPath)
}

/**
 * Verifica si un rol de tenant tiene permiso para una operación específica.
 * manager y admin tienen acceso total (*).
 * Los demás roles tienen acceso limitado según TENANT_PERMISSIONS.
 *
 * @param {TenantRole} tenantRole - Rol del usuario dentro del tenant.
 * @param {string} path - Ruta o recurso a verificar.
 * @param {string} [method] - Método HTTP (opcional).
 * @returns {boolean} true si tiene permiso.
 */
export function hasTenantPermission(
  tenantRole: TenantRole,
  path: string,
  method?: string,
): boolean {
  const permissions = TENANT_PERMISSIONS[tenantRole];
  if (!permissions) return false;

  // manager tiene acceso total
  if (tenantRole === 'manager') return true;

  for (const permission of permissions) {
    if (permission === '*') return true;

    if (permission.includes('/*')) {
      const basePath = permission.replace('/*', '');
      if (path.startsWith(basePath)) return true;
    }

    if (method && permission.includes(' ')) {
      const [permMethod, permPath] = permission.split(' ');
      if (permMethod === method && path === permPath) return true;
    }

    if (path === permission || path.startsWith(permission + '/')) return true;
  }

  return false;
}

/**
 * Middleware de verificación de permisos de tenant.
 * Devuelve un Response 403 si no tiene permiso, null si está autorizado.
 *
 * @param {TenantRole | undefined} tenantRole - Rol del usuario en el tenant.
 * @param {string} path - Ruta de la petición.
 * @param {string} method - Método HTTP.
 * @returns {Response | null} 403 si no autorizado, null si OK.
 */
export function checkTenantApiPermission(
  tenantRole: TenantRole | undefined,
  path: string,
  method: string,
): Response | null {
  if (!tenantRole) {
    return new Response(
      JSON.stringify({
        error: 'Contexto de tenant no disponible',
        message: 'Se requiere una membresía de tenant activa para acceder a este recurso',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (!hasTenantPermission(tenantRole, path, method)) {
    return new Response(
      JSON.stringify({
        error: 'Permiso denegado',
        message: `Tu rol (${tenantRole}) no tiene acceso a este recurso`,
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return null;
}

/**
 * Mensajes de error personalizados por rol
 * @param userRole - Rol del usuario
 * @returns Mensaje de error apropiado
 */
export function getRoleErrorMessage(userRole: UserRole): string {
  switch (userRole) {
    case 'regularUser':
      return 'No tienes permisos de administrador'
    default:
      return 'Acceso denegado'
  }
}

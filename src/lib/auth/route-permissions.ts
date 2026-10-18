/**
 * @description Mapa de rutas REST (con `withAuth`) → clave del permission-registry.
 * Fuente única de verdad para la autorización de transporte web.
 *
 * Reglas:
 * - Una ruta sensible mapeada → se evalúa su clave contra el registry.
 * - Ruta NO mapeada → comportamiento legacy (allowlist) + log `UNMAPPED_ROUTE`
 *   (visible, nunca silencioso). Se retira cuando el listado llegue a cero.
 *   Mobile (src/app/api/mobile/**) se incorpora por decisión en una fase posterior.
 */

interface RoutePermission {
  /** Prefijo de path que identifica el grupo de rutas (p.ej. "/api/facturas/"). */
  prefix: string;
  /** Métodos HTTP a los que aplica (undefined = todos). */
  method?: string;
  /** Clave del permission-registry. */
  key: string;
  /** Nota operativa para auditoría del mapa. */
  label?: string;
}

const ROUTE_PERMISSION_MAP_INTERNAL: RoutePermission[] = [
  // ── Ventas / facturas (GET listado/PDF/Excel) ──
  { prefix: '/api/facturas/', method: 'GET', key: 'ventas.facturas.consultar' },
  { prefix: '/api/facturas/[id]', method: 'GET', key: 'ventas.facturas.consultar' },
  // ── RRHH (lecturas del módulo; claves de operación como proxy manager-only) ──
  { prefix: '/api/empleados/asistencia/', method: 'GET', key: 'rrhh.asistencia.registrar' },
  { prefix: '/api/empleados/asistencia/', method: 'PUT', key: 'rrhh.asistencia.editar' },
  { prefix: '/api/empleados/asistencia/', method: 'DELETE', key: 'rrhh.asistencia.eliminar' },
  { prefix: '/api/empleados/nomina/', method: 'GET', key: 'rrhh.nomina.calcular' },
  { prefix: '/api/empleados/nomina/', method: 'PUT', key: 'rrhh.nomina.editar' },
  { prefix: '/api/empleados/nomina/', method: 'DELETE', key: 'rrhh.nomina.eliminar' },
  { prefix: '/api/empleados/vacaciones/', method: 'GET', key: 'rrhh.vacaciones.solicitar' },
  { prefix: '/api/empleados/vacaciones/', method: 'PUT', key: 'rrhh.vacaciones.aprobar' },
  { prefix: '/api/empleados/vacaciones/', method: 'DELETE', key: 'rrhh.vacaciones.eliminar' },
  { prefix: '/api/empleados/work-schedules', method: 'GET', key: 'rrhh.horarios.gestionar' },
  { prefix: '/api/empleados/work-schedules', method: 'DELETE', key: 'rrhh.horarios.eliminar' },
  // ── Producción / operaciones (gestión manager-only) ──
  { prefix: '/api/ofertas/', key: 'ventas.ofertas.gestionar' },
  { prefix: '/api/produccion/recetas/', key: 'produccion.recetas.gestionar' },
  { prefix: '/api/produccion/vales/', key: 'produccion.vales.gestionar' },
  { prefix: '/api/reparaciones/', key: 'produccion.reparaciones.gestionar' },
];

/**
 * Mapa exportado para el gate de drift (src/lib/__tests__/permission-drift.test.ts).
 * Se garantiza que cada clave aquí referenciada existe en el permission-registry.
 */
export const ROUTE_PERMISSION_MAP: readonly RoutePermission[] = ROUTE_PERMISSION_MAP_INTERNAL;

/**
 * @description Devuelve la clave de permiso mapeada para una ruta/método REST.
 * @param {string} path - Path de la petición (p.ej. "/api/facturas/abc123").
 * @param {string} method - Método HTTP (GET/POST/...).
 * @returns {string | undefined} Clave del registry, o undefined si es ruta no mapeada.
 */
export function getRoutePermissionKey(path: string, method: string): string | undefined {
  // Normalizar: conWithAuth pasa el pathname real (incluye ids). Match por prefijo.
  const entry = ROUTE_PERMISSION_MAP.find(
    (r) => path.startsWith(r.prefix) && (!r.method || r.method === method),
  );
  return entry?.key;
}

/**
 * @description Indica si una ruta está cubierta por el mapa de permisos.
 * @param {string} path - Path de la petición.
 * @param {string} method - Método HTTP.
 * @returns {boolean} true si hay clave mapeada para esa ruta.
 */
export function isRouteMapped(path: string, method: string): boolean {
  return getRoutePermissionKey(path, method) !== undefined;
}

/**
 * Mapa de grupos del API mobile (primer segmento tras `/api/mobile/v1/` o
 * `/api/mobile/`) → clave del registry. `null` = exenta de control de rol
 * (público o de plataforma). defaultRoles por claves: paridad (mobile no tenía
 * control de rol, así que las claves nuevas parten abiertas a los 3 roles).
 */
const MOBILE_GROUP_KEYS_MAP: Record<string, string | null> = {
  accounting: 'financiero.contabilidad.acceder',
  dashboard: 'financiero.stats.ver',
  products: 'inventario.productos.consultar',
  categories: 'inventario.categorias.gestionar',
  units: 'inventario.unidades.gestionar',
  warehouses: 'inventario.almacenes.gestionar',
  transfers: 'inventario.transferencias.gestionar',
  mermas: 'inventario.mermas.registrar',
  sales: 'ventas.venta.registrar',
  invoicing: 'ventas.facturas.consultar',
  offers: 'ventas.ofertas.gestionar',
  contracts: 'ventas.contratos.gestionar',
  purchases: 'compras.compras.gestionar',
  providers: 'compras.proveedores.gestionar',
  services: 'operaciones.servicios.acceder',
  clients: 'operaciones.clientes.gestionar',
  referrals: 'operaciones.referidos.gestionar',
  pos: 'operaciones.pos.gestionar',
  expenses: 'financiero.gastos.acceder',
  'expense-concepts': 'financiero.gastos.acceder',
  // ── Duplicados en español de los módulos v1 (merge de los 12 módulos,
  //    PG-07): misma política que sus contrapartes ya mapeadas ──
  compras: 'compras.compras.gestionar',
  contratos: 'ventas.contratos.gestionar',
  empleados: 'rrhh.empleados.consultar',
  facturas: 'ventas.facturas.consultar',
  gastos: 'financiero.gastos.acceder',
  ofertas: 'ventas.ofertas.gestionar',
  produccion: 'produccion.vales.gestionar',
  reparaciones: 'produccion.reparaciones.gestionar',
  servicios: 'operaciones.servicios.acceder',
  transferencias: 'inventario.transferencias.gestionar',
  // Exentas:
  auth: null, // login/register/refresh/me/tenants — público o autenticado genérico
  plans: null, // catálogo público de planes
  admin: null, // salud y administración de plataforma (role admin) — ver memberships abajo
  'admin/memberships': 'config.usuarios.gestionar', // aprobar/rechazar membresías (manager)
};

const MOBILE_LEGACY_GET_KEYS: Readonly<Record<string, string>> = {
  compras: 'compras.compras.gestionar',
  contratos: 'ventas.contratos.gestionar',
  empleados: 'rrhh.empleados.consultar',
  facturas: 'ventas.facturas.consultar',
  gastos: 'financiero.gastos.acceder',
  ofertas: 'ventas.ofertas.gestionar',
  produccion: 'produccion.ordenes.consultar',
  reparaciones: 'produccion.reparaciones.gestionar',
  servicios: 'operaciones.servicios.acceder',
  transferencias: 'inventario.transferencias.gestionar',
};

const MOBILE_METHOD_DENIED = '__mobile_method_not_allowed__';
const MOBILE_EXEMPT_ROUTE_RULES: readonly { method: string; path: RegExp }[] = [
  { method: 'POST', path: /^\/api\/mobile\/v1\/auth\/(?:login|logout|refresh|register)$/ },
  { method: 'GET', path: /^\/api\/mobile\/v1\/auth\/(?:me|tenants)$/ },
  { method: 'POST', path: /^\/api\/mobile\/v1\/auth\/tenants$/ },
  { method: 'GET', path: /^\/api\/mobile\/plans$/ },
  { method: 'GET', path: /^\/api\/mobile\/plans\/[^/]+$/ },
  { method: 'POST', path: /^\/api\/mobile\/plans$/ },
  { method: 'PUT', path: /^\/api\/mobile\/plans\/[^/]+$/ },
  { method: 'DELETE', path: /^\/api\/mobile\/plans\/[^/]+$/ },
  { method: 'GET', path: /^\/api\/mobile\/v1\/admin\/(?:activity-logs|health|licenses|licenses\/stats|sessions|tenants|tenants\/detail|tenants\/license|tenants\/users|users|users\/detail|users\/login-history)$/ },
  { method: 'POST', path: /^\/api\/mobile\/v1\/admin\/(?:licenses\/(?:activate|deactivate|delete|renew)|sessions\/revoke|tenants\/(?:activate|deactivate|delete|remove-user)|tenants\/license\/(?:assign|deactivate)|users\/(?:activate|assign-tenant|deactivate|delete|lock|resend-verification|reset-password|revoke-sessions|unlock|verify-email))$/ },
  { method: 'PATCH', path: /^\/api\/mobile\/v1\/admin\/(?:tenants\/(?:license\/update|update)|users\/(?:change-tenant-role|update))$/ },
];

/** @description Indica si método y ruta están explícitamente exentos del gate mobile. */
export function isMobileRouteExempt(path: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();
  return MOBILE_EXEMPT_ROUTE_RULES.some(
    (rule) => rule.method === normalizedMethod && rule.path.test(path),
  );
}
const MOBILE_ACCOUNTING_GET_PATHS = [
  '/api/mobile/v1/accounting/accounts-payable',
  '/api/mobile/v1/accounting/accounts-receivable',
  '/api/mobile/v1/accounting/accounts-receivable/metrics',
  '/api/mobile/v1/accounting/advances',
  '/api/mobile/v1/accounting/advances/available',
  '/api/mobile/v1/accounting/advances/reports/customers',
  '/api/mobile/v1/accounting/advances/reports/providers',
  '/api/mobile/v1/accounting/advances/reports/summary',
  '/api/mobile/v1/accounting/advances/[id]',
  '/api/mobile/v1/accounting/bank-accounts',
  '/api/mobile/v1/accounting/bank-accounts/[id]',
  '/api/mobile/v1/accounting/bank-accounts/[id]/history',
  '/api/mobile/v1/accounting/bank-adjustments',
  '/api/mobile/v1/accounting/bank-transfers',
  '/api/mobile/v1/accounting/bank-transfers/[id]',
  '/api/mobile/v1/accounting/bank-transfers/[id]/comprobante',
  '/api/mobile/v1/accounting/capital-injections',
  '/api/mobile/v1/accounting/cash-debts',
  '/api/mobile/v1/accounting/cash-debts/stats',
  '/api/mobile/v1/accounting/cash-debts/[id]',
  '/api/mobile/v1/accounting/cash-loans',
  '/api/mobile/v1/accounting/cash-loans/stats',
  '/api/mobile/v1/accounting/cash-loans/[id]',
  '/api/mobile/v1/accounting/cash-loans/[id]/comprobante',
  '/api/mobile/v1/accounting/cash-loans/[id]/history',
  '/api/mobile/v1/accounting/exchange/monedas',
  '/api/mobile/v1/accounting/exchange/tasas',
  '/api/mobile/v1/accounting/logs',
  '/api/mobile/v1/accounting/payment-types',
  '/api/mobile/v1/accounting/payment-types/available-accounts',
  '/api/mobile/v1/accounting/payment-types/[id]',
  '/api/mobile/v1/accounting/reconciliation/expenses',
  '/api/mobile/v1/accounting/reconciliation/expenses/history',
  '/api/mobile/v1/accounting/reconciliation/expenses-history',
  '/api/mobile/v1/accounting/reconciliation/sales',
  '/api/mobile/v1/accounting/reconciliation/sales/history',
  '/api/mobile/v1/accounting/reconciliation/sales-history',
  '/api/mobile/v1/accounting/reconciliation/services',
  '/api/mobile/v1/accounting/reconciliation/services/history',
  '/api/mobile/v1/accounting/reconciliation/services-history',
  '/api/mobile/v1/accounting/reconciliation/stats',
  '/api/mobile/v1/accounting/reports/client-account-analysis',
  '/api/mobile/v1/accounting/reports/exchange',
  '/api/mobile/v1/accounting/reports/exchange-impact',
  '/api/mobile/v1/accounting/reports/movements',
  '/api/mobile/v1/accounting/reports/overdue-invoices',
  '/api/mobile/v1/accounting/reports/summary',
  '/api/mobile/v1/accounting/reports/transfers',
] as const;

interface MobileRouteRule {
  method: string;
  path: RegExp;
  key: string;
}

const MOBILE_WRITE_ROUTE_RULES: readonly MobileRouteRule[] = [
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/payment-types$/, key: 'financiero.tipos-pago.crear' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/accounting\/payment-types\/[^/]+$/, key: 'financiero.tipos-pago.editar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/accounting\/payment-types\/[^/]+$/, key: 'financiero.tipos-pago.eliminar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/advances$/, key: 'financiero.avances.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/accounting\/advances\/[^/]+$/, key: 'financiero.avances.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/accounting\/advances\/[^/]+$/, key: 'financiero.avances.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/advances\/[^/]+\/(?:ejecutar|revertir)$/, key: 'financiero.avances.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/capital-injections$/, key: 'financiero.capital-inyecciones.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/capital-injections\/[^/]+\/payments$/, key: 'financiero.capital-inyecciones.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/cash-debts$/, key: 'financiero.deudas-efectivo.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/accounting\/cash-debts\/[^/]+$/, key: 'financiero.deudas-efectivo.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/cash-debts\/[^/]+\/payments$/, key: 'financiero.deudas-efectivo.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/cash-loans$/, key: 'financiero.prestamos-efectivo.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/accounting\/cash-loans\/[^/]+$/, key: 'financiero.prestamos-efectivo.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/cash-loans\/[^/]+\/payments$/, key: 'financiero.prestamos-efectivo.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/bank-adjustments$/, key: 'financiero.bancos.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/bank-transfers(?:\/validate)?$/, key: 'financiero.bancos.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/accounting\/reconciliation\/(?:expenses|sales|services)$/, key: 'financiero.conciliaciones.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?categories$/, key: 'inventario.categorias.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/(?:v1\/)?categories\/[^/]+$/, key: 'inventario.categorias.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?categories\/[^/]+$/, key: 'inventario.categorias.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?units(?:\/create)?$/, key: 'inventario.unidades.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/(?:v1\/)?units\/[^/]+$/, key: 'inventario.unidades.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?units\/[^/]+$/, key: 'inventario.unidades.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/warehouses(?:\/create)?$/, key: 'inventario.almacenes.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/warehouses\/[^/]+$/, key: 'inventario.almacenes.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/warehouses\/[^/]+$/, key: 'inventario.almacenes.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/clients(?:\/create)?$/, key: 'operaciones.clientes.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/clients\/[^/]+$/, key: 'operaciones.clientes.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/clients\/[^/]+$/, key: 'operaciones.clientes.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/providers(?:\/create)?$/, key: 'compras.proveedores.gestionar' },
  { method: 'PUT', path: /^\/api\/mobile\/v1\/providers\/[^/]+$/, key: 'compras.proveedores.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/providers\/[^/]+$/, key: 'compras.proveedores.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?expense-concepts$/, key: 'financiero.gastos.acceder' },
  { method: 'PUT', path: /^\/api\/mobile\/(?:v1\/)?expense-concepts\/[^/]+$/, key: 'financiero.gastos.acceder' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?expense-concepts\/[^/]+$/, key: 'financiero.gastos.acceder' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?expenses$/, key: 'financiero.gastos.acceder' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?expenses\/[^/]+$/, key: 'financiero.gastos.aprobar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?mermas$/, key: 'inventario.mermas.registrar' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?mermas\/[^/]+$/, key: 'inventario.mermas.eliminar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?purchases$/, key: 'compras.compras.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?services$/, key: 'operaciones.servicios.crear' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?services\/[^/]+$/, key: 'operaciones.servicios.eliminar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?transfers$/, key: 'inventario.transferencias.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?transfers\/[^/]+$/, key: 'inventario.transferencias.aprobar' },
  { method: 'DELETE', path: /^\/api\/mobile\/v1\/contratos\/[^/]+$/, key: 'ventas.contratos.gestionar' },
  { method: 'DELETE', path: /^\/api\/mobile\/contracts\/[^/]+$/, key: 'ventas.contratos.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?referrals$/, key: 'operaciones.referidos.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/(?:v1\/)?pos\/turnos(?:\/arqueo|\/cerrar)?$/, key: 'operaciones.pos.gestionar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/sales\/create$/, key: 'ventas.venta.registrar' },
  { method: 'PATCH', path: /^\/api\/mobile\/v1\/sales\/[^/]+\/update$/, key: 'ventas.venta.editar' },
  { method: 'POST', path: /^\/api\/mobile\/v1\/sales\/[^/]+\/cancel$/, key: 'ventas.venta.anular' },
  { method: 'DELETE', path: /^\/api\/mobile\/(?:v1\/)?purchases\/[^/]+$/, key: 'compras.compras.gestionar' },
];

/** Mapa exportado para el gate de drift anti-regresión (PG-07). */
export const MOBILE_GROUP_KEYS: Readonly<Record<string, string | null>> = MOBILE_GROUP_KEYS_MAP;

/**
 * Acciones finas dentro de grupos mobile (PG-05): segmento de acción → clave.
 * Evita que mutaciones de un mismo recurso compartan la clave del grupo
 * (hallazgo #2: create/update/cancel de ventas con clave única).
 */
const MOBILE_ACTION_KEYS_MAP: Record<string, Record<string, string>> = {
  sales: {
    create: 'ventas.venta.registrar',
    update: 'ventas.venta.editar',
    cancel: 'ventas.venta.anular',
  },
};

/** Mapa de acciones finales por grupo, exportado para el gate de drift (PG-07). */
export const MOBILE_ACTION_KEYS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  MOBILE_ACTION_KEYS_MAP;

/**
 * @description Resuelve la clave de permiso para una ruta mobile (o null si exenta).
 * Normaliza el prefijo `/api/mobile/v1/` y `/api/mobile/` y usa el primer segmento;
 * privilegia el match `admin/memberships` antes que `admin`. Si el grupo tiene
 * acciones finas definidas, devuelve la clave de la acción (create/update/cancel).
 * @param {string} path - Pathname de la petición.
 * @returns {string | null} Clave del registry, o null si la ruta está exenta.
 */
export function getMobilePermissionKey(path: string, method?: string): string | null {
  let rest = path;
  if (path.startsWith('/api/mobile/v1/')) rest = path.slice('/api/mobile/v1/'.length);
  else if (path.startsWith('/api/mobile/')) rest = path.slice('/api/mobile/'.length);
  else return null; // no es ruta mobile

  const segments = rest.split('/');
  const group = segments[0];
  const httpMethod = method?.toUpperCase();
  if (isMobileRouteExempt(path, httpMethod ?? '')) return null;
  if (group === 'admin' && segments[1] === 'memberships') {
    const methodPathPairs = [
      ['GET', /^\/api\/mobile\/v1\/admin\/memberships\/pending$/],
      ['POST', /^\/api\/mobile\/v1\/admin\/memberships\/(?:approve|reject)$/],
    ] as const;
    return methodPathPairs.some(([allowedMethod, route]) =>
      httpMethod === allowedMethod && route.test(path),
    )
      ? MOBILE_GROUP_KEYS['admin/memberships']
      : MOBILE_METHOD_DENIED;
  }

  if (!httpMethod) return MOBILE_METHOD_DENIED;

  const writeRule = MOBILE_WRITE_ROUTE_RULES.find(
    (rule) => rule.method === httpMethod && rule.path.test(path),
  );
  if (writeRule) return writeRule.key;

  if (group === 'accounting') {
    const knownReadRoute = MOBILE_ACCOUNTING_GET_PATHS.some((template) => {
      const pattern = new RegExp(`^${template.replace('[id]', '[^/]+')}$`);
      return pattern.test(path);
    });
    return httpMethod === 'GET' && knownReadRoute
      ? MOBILE_GROUP_KEYS.accounting
      : MOBILE_METHOD_DENIED;
  }

  const actionMap = MOBILE_ACTION_KEYS[group];
  if (actionMap) {
    if (httpMethod === 'GET' && /^\/api\/mobile\/v1\/sales(?:\/[^/]+)?$/.test(path)) {
      return MOBILE_GROUP_KEYS.sales;
    }
    return MOBILE_METHOD_DENIED;
  }

  const legacyGetKey = MOBILE_LEGACY_GET_KEYS[group];
  if (legacyGetKey) {
    // Match only collection and one-segment detail endpoints that were
    // verified to export GET. Deeper paths and every other verb fail closed.
    const exactReadRoute = new RegExp(`^/api/mobile/(?:v1/)?${group}(?:/[^/]+)?$`);
    return httpMethod === 'GET' && exactReadRoute.test(path) ? legacyGetKey : MOBILE_METHOD_DENIED;
  }

  const groupKey = MOBILE_GROUP_KEYS[group];
  if (!groupKey) return MOBILE_METHOD_DENIED;
  if (
    group === 'pos' &&
    httpMethod === 'GET' &&
    /^\/api\/mobile\/pos\/(?:puntos-venta|turnos\/(?:activo|cuadre|esperados))$/.test(path)
  ) {
    return groupKey;
  }
  const exactCollectionOrDetail = new RegExp(`^/api/mobile/(?:v1/)?${group}(?:/[^/]+)?$`);
  return httpMethod === 'GET' && exactCollectionOrDetail.test(path)
    ? groupKey
    : MOBILE_METHOD_DENIED;
}

/**
 * @description Mapa de rutas REST (con `withAuth`) → clave del permission-registry.
 * Fuente única de verdad para la autorización de transporte web.
 *
 * Reglas:
 * - Una ruta sensible mapeada → se evalúa con `hasPermission(user, key)`.
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

const ROUTE_PERMISSION_MAP: RoutePermission[] = [
  // ── Ventas / facturas (GET listado/PDF/Excel) ──
  { prefix: '/api/facturas/', method: 'GET', key: 'ventas.facturas.consultar' },
  { prefix: '/api/facturas/[id]', method: 'GET', key: 'ventas.facturas.consultar' },
  // ── RRHH (lecturas del módulo; claves de operación como proxy manager-only) ──
  { prefix: '/api/empleados/asistencia/', method: 'GET', key: 'rrhh.asistencia.registrar' },
  { prefix: '/api/empleados/nomina/', method: 'GET', key: 'rrhh.nomina.calcular' },
  { prefix: '/api/empleados/vacaciones/', method: 'GET', key: 'rrhh.vacaciones.solicitar' },
  { prefix: '/api/empleados/work-schedules', method: 'GET', key: 'rrhh.horarios.gestionar' },
  // ── Producción / operaciones (gestión manager-only) ──
  { prefix: '/api/ofertas/', key: 'ventas.ofertas.gestionar' },
  { prefix: '/api/produccion/recetas/', key: 'produccion.recetas.gestionar' },
  { prefix: '/api/produccion/vales/', key: 'produccion.vales.gestionar' },
  { prefix: '/api/reparaciones/', key: 'produccion.reparaciones.gestionar' },
];

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
const MOBILE_GROUP_KEYS: Record<string, string | null> = {
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
  // Exentas:
  auth: null, // login/register/refresh/me/tenants — público o autenticado genérico
  admin: null, // salud y administración de plataforma (role admin) — ver memberships abajo
  'admin/memberships': 'config.usuarios.gestionar', // aprobar/rechazar membresías (manager)
};

/**
 * @description Resuelve la clave de permiso para una ruta mobile (o null si exenta).
 * Normaliza el prefijo `/api/mobile/v1/` y `/api/mobile/` y usa el primer segmento;
 * privilegia el match `admin/memberships` antes que `admin`.
 * @param {string} path - Pathname de la petición.
 * @returns {string | null} Clave del registry, o null si la ruta está exenta.
 */
export function getMobilePermissionKey(path: string): string | null {
  let rest = path;
  if (path.startsWith('/api/mobile/v1/')) rest = path.slice('/api/mobile/v1/'.length);
  else if (path.startsWith('/api/mobile/')) rest = path.slice('/api/mobile/'.length);
  else return null; // no es ruta mobile

  const group = rest.split('/')[0];
  if (group === 'admin' && rest.split('/')[1] === 'memberships') {
    return MOBILE_GROUP_KEYS['admin/memberships'];
  }
  // admin/* (health, licenses, tenants, users) → exenta (plataforma)
  if (group === 'admin') return null;

  return MOBILE_GROUP_KEYS[group] ?? null;
}
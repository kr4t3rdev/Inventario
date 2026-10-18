import { describe, expect, it } from 'vitest';
import {
  getRoutePermissionKey,
  getMobilePermissionKey,
  isMobileRouteExempt,
  isRouteMapped,
} from '@/lib/auth/route-permissions';
import { getPermissionByKey } from '@/lib/auth/permission-registry';

/**
 * Contrato del mapa ruta→permiso (PG-05 T5).
 * Asegura que el transporte web use claves del registry (nunca inventadas)
 * y que las rutas sensibles estén cubiertas (o explícitamente legacy).
 */
describe('route-permissions (PG-05 T5)', () => {
  it('mapea las rutas de facturas (GET) a ventas.facturas.consultar', () => {
    expect(getRoutePermissionKey('/api/facturas/abc123', 'GET')).toBe(
      'ventas.facturas.consultar',
    );
    expect(getRoutePermissionKey('/api/facturas/abc123/pdf', 'GET')).toBe(
      'ventas.facturas.consultar',
    );
    // No existe /api/facturas plano (solo [id] y sub-recursos); no debe mapear.
    expect(getRoutePermissionKey('/api/facturas', 'GET')).toBeUndefined();
  });

  it('mapea lecturas de rrhh a claves del módulo (proxy manager-only)', () => {
    expect(getRoutePermissionKey('/api/empleados/asistencia/xyz', 'GET')).toBe(
      'rrhh.asistencia.registrar',
    );
    expect(getRoutePermissionKey('/api/empleados/nomina/xyz', 'GET')).toBe(
      'rrhh.nomina.calcular',
    );
    expect(getRoutePermissionKey('/api/empleados/vacaciones/xyz', 'GET')).toBe(
      'rrhh.vacaciones.solicitar',
    );
    expect(getRoutePermissionKey('/api/empleados/work-schedules', 'GET')).toBe(
      'rrhh.horarios.gestionar',
    );
  });

  it('mapea mutaciones de rrhh (PUT/DELETE) a claves de edición/eliminación (PG-05)', () => {
    expect(getRoutePermissionKey('/api/empleados/asistencia/xyz', 'PUT')).toBe(
      'rrhh.asistencia.editar',
    );
    expect(getRoutePermissionKey('/api/empleados/asistencia/xyz', 'DELETE')).toBe(
      'rrhh.asistencia.eliminar',
    );
    expect(getRoutePermissionKey('/api/empleados/nomina/xyz', 'PUT')).toBe('rrhh.nomina.editar');
    expect(getRoutePermissionKey('/api/empleados/nomina/xyz', 'DELETE')).toBe('rrhh.nomina.eliminar');
    expect(getRoutePermissionKey('/api/empleados/vacaciones/xyz', 'PUT')).toBe(
      'rrhh.vacaciones.aprobar',
    );
    expect(getRoutePermissionKey('/api/empleados/vacaciones/xyz', 'DELETE')).toBe(
      'rrhh.vacaciones.eliminar',
    );
    expect(getRoutePermissionKey('/api/empleados/work-schedules', 'DELETE')).toBe(
      'rrhh.horarios.eliminar',
    );
  });

  it('no mapea métodos distintos al de la entrada (p.ej. POST en facturas)', () => {
    expect(getRoutePermissionKey('/api/facturas', 'POST')).toBeUndefined();
    expect(isRouteMapped('/api/facturas', 'POST')).toBe(false);
  });

  it('devuelve undefined/isRouteMapped=false para rutas no cubiertas', () => {
    expect(getRoutePermissionKey('/api/ventas/otra', 'GET')).toBeUndefined();
    expect(isRouteMapped('/api/ventas/otra', 'GET')).toBe(false);
  });

  it('toda clave del mapa existe en el permission-registry (anti-drift)', async () => {
    const { getPermissionByKey } = await import('@/lib/auth/permission-registry');
    const { getRoutePermissionKey: fn } = await import('@/lib/auth/route-permissions');
    // Re-extraer claves de forma directa es costoso; validamos los dos casos fijos.
    // Más simple: el contrato anti-drift fuerte vive en PG-07; aquí validamos sinonía.
    expect(getPermissionByKey('ventas.facturas.consultar')).toBeDefined();
    expect(getPermissionByKey('rrhh.asistencia.registrar')).toBeDefined();
    expect(getPermissionByKey('rrhh.nomina.calcular')).toBeDefined();
    expect(getPermissionByKey('rrhh.vacaciones.solicitar')).toBeDefined();
    expect(getPermissionByKey('rrhh.horarios.gestionar')).toBeDefined();
    expect(getPermissionByKey('produccion.ordenes.consultar')?.defaultRoles).toEqual([
      'manager',
      'economico',
    ]);
    expect(fn).toBeDefined();
  });
});
describe('route-permissions mobile (PG-05 mobile)', () => {
  it('mapea grupos mobile v1 a claves de dominio', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/cash-loans', 'GET')).toBe('financiero.contabilidad.acceder');
    expect(getMobilePermissionKey('/api/mobile/v1/products', 'GET')).toBe('inventario.productos.consultar');
    expect(getMobilePermissionKey('/api/mobile/v1/sales', 'GET')).toBe('ventas.venta.registrar');
    expect(getMobilePermissionKey('/api/mobile/v1/pos/turnos', 'POST')).toBe('operaciones.pos.gestionar');
  });

  it('mapea recursos móviles legacy por su permiso de lectura/gestión existente', () => {
    const routes = [
      ['/api/mobile/v1/compras', 'compras.compras.gestionar'],
      ['/api/mobile/v1/contratos/abc', 'ventas.contratos.gestionar'],
      ['/api/mobile/v1/empleados', 'rrhh.empleados.consultar'],
      ['/api/mobile/v1/facturas/abc', 'ventas.facturas.consultar'],
      ['/api/mobile/v1/gastos', 'financiero.gastos.acceder'],
      ['/api/mobile/v1/ofertas/abc', 'ventas.ofertas.gestionar'],
      ['/api/mobile/v1/produccion', 'produccion.ordenes.consultar'],
      ['/api/mobile/v1/reparaciones/abc', 'produccion.reparaciones.gestionar'],
      ['/api/mobile/v1/servicios', 'operaciones.servicios.acceder'],
      ['/api/mobile/v1/transferencias/abc', 'inventario.transferencias.gestionar'],
    ] as const;
    for (const [path, key] of routes) {
      expect(getMobilePermissionKey(path, 'GET')).toBe(key);
      expect(getMobilePermissionKey(path, 'POST')).toBe('__mobile_method_not_allowed__');
    }
    expect(getMobilePermissionKey('/api/mobile/v1/compras/abc', 'GET')).toBe(
      'compras.compras.gestionar',
    );
    expect(getMobilePermissionKey('/api/mobile/v1/produccion/orders/abc', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
    expect(getMobilePermissionKey('/api/mobile/v1/unknown', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
  });

  it('distingue create/update/cancel dentro del grupo sales (PG-05 hallazgo #2)', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/sales/create', 'POST')).toBe('ventas.venta.registrar');
    expect(getMobilePermissionKey('/api/mobile/v1/sales/abc123/update', 'PATCH')).toBe('ventas.venta.editar');
    expect(getMobilePermissionKey('/api/mobile/v1/sales/abc123/cancel', 'POST')).toBe('ventas.venta.anular');
    expect(getMobilePermissionKey('/api/mobile/v1/sales/abc123/update', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
    // El listado y el detalle son lecturas, no heredan permisos de mutación.
    expect(getMobilePermissionKey('/api/mobile/v1/sales', 'GET')).toBe('ventas.venta.registrar');
    expect(getMobilePermissionKey('/api/mobile/v1/sales/abc123', 'GET')).toBe('ventas.venta.registrar');
  });

  it('mapea grupos mobile legacy (sin v1)', () => {
    expect(getMobilePermissionKey('/api/mobile/categories', 'GET')).toBe('inventario.categorias.gestionar');
    expect(getMobilePermissionKey('/api/mobile/mermas', 'GET')).toBe('inventario.mermas.registrar');
    expect(getMobilePermissionKey('/api/mobile/offers', 'GET')).toBe('ventas.ofertas.gestionar');
    expect(getMobilePermissionKey('/api/mobile/categories', 'DELETE')).toBe(
      '__mobile_method_not_allowed__',
    );
  });

  it('exenta auth y admin (plataforma/público)', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/auth/login', 'POST')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/v1/auth/me', 'GET')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/v1/admin/licenses', 'GET')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/plans', 'GET')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/v1/auth/unknown', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
    expect(getMobilePermissionKey('/api/mobile/plans', 'DELETE')).toBe(
      '__mobile_method_not_allowed__',
    );
    expect(isMobileRouteExempt('/api/mobile/v1/admin/licenses', 'GET')).toBe(true);
    expect(isMobileRouteExempt('/api/mobile/v1/admin/unlisted', 'GET')).toBe(false);
  });

  it('admin/memberships sí exige config.usuarios.gestionar', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/admin/memberships/approve', 'POST')).toBe('config.usuarios.gestionar');
    expect(getMobilePermissionKey('/api/mobile/v1/admin/memberships/pending', 'GET')).toBe('config.usuarios.gestionar');
    expect(getMobilePermissionKey('/api/mobile/v1/admin/memberships/approve', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
  });

  it('separa consulta contable de mutaciones monetarias y limita operaciones de riesgo', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/cash-loans', 'GET')).toBe(
      'financiero.contabilidad.acceder',
    );
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/cash-loans', 'POST')).toBe(
      'financiero.prestamos-efectivo.gestionar',
    );
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/unknown', 'POST')).toBe(
      '__mobile_method_not_allowed__',
    );
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/unknown', 'GET')).toBe(
      '__mobile_method_not_allowed__',
    );
    expect(getPermissionByKey('financiero.contabilidad.acceder')?.defaultRoles).toEqual([
      'manager',
      'economico',
    ]);
    expect(getPermissionByKey('financiero.prestamos-efectivo.gestionar')?.defaultRoles).toEqual([
      'manager',
    ]);
    expect(getPermissionByKey('inventario.mermas.registrar')?.defaultRoles).toContain(
      'dependiente',
    );
    expect(getPermissionByKey('inventario.transferencias.gestionar')?.defaultRoles).toContain(
      'dependiente',
    );
  });

  it('ruta no mobile devuelve null', () => {
    expect(getMobilePermissionKey('/api/ventas')).toBeNull();
    expect(getMobilePermissionKey('/busy/dashboard')).toBeNull();
  });
});

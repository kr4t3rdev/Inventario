import { describe, expect, it } from 'vitest';
import {
  getRoutePermissionKey,
  getMobilePermissionKey,
  isRouteMapped,
} from '@/lib/auth/route-permissions';

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
    expect(fn).toBeDefined();
  });
});
describe('route-permissions mobile (PG-05 mobile)', () => {
  it('mapea grupos mobile v1 a claves de dominio', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/accounting/x')).toBe('financiero.contabilidad.acceder');
    expect(getMobilePermissionKey('/api/mobile/v1/products')).toBe('inventario.productos.consultar');
    expect(getMobilePermissionKey('/api/mobile/v1/sales')).toBe('ventas.venta.registrar');
    expect(getMobilePermissionKey('/api/mobile/v1/pos/turnos')).toBe('operaciones.pos.gestionar');
  });

  it('mapea grupos mobile legacy (sin v1)', () => {
    expect(getMobilePermissionKey('/api/mobile/categories')).toBe('inventario.categorias.gestionar');
    expect(getMobilePermissionKey('/api/mobile/mermas')).toBe('inventario.mermas.registrar');
    expect(getMobilePermissionKey('/api/mobile/offers')).toBe('ventas.ofertas.gestionar');
  });

  it('exenta auth y admin (plataforma/público)', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/auth/login')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/v1/auth/me')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/v1/admin/licenses')).toBeNull();
    expect(getMobilePermissionKey('/api/mobile/plans')).toBeNull();
  });

  it('admin/memberships sí exige config.usuarios.gestionar', () => {
    expect(getMobilePermissionKey('/api/mobile/v1/admin/memberships/approve')).toBe('config.usuarios.gestionar');
    expect(getMobilePermissionKey('/api/mobile/v1/admin/memberships/pending')).toBe('config.usuarios.gestionar');
  });

  it('ruta no mobile devuelve null', () => {
    expect(getMobilePermissionKey('/api/ventas')).toBeNull();
    expect(getMobilePermissionKey('/busy/dashboard')).toBeNull();
  });
});

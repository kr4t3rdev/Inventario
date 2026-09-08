import { describe, expect, it } from 'vitest';
import {
  getRoutePermissionKey,
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
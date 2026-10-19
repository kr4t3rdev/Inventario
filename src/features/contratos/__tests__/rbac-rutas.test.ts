/**
 * @description Tests del mapa de permisos por ruta del módulo de contratos
 *              (CTF-4): resoluciones de `getRoutePermissionKey`, no-colisión de
 *              prefijos y existencia de las claves en el permission-registry.
 */
import { describe, it, expect } from 'vitest';
import { getRoutePermissionKey } from '@/lib/auth/route-permissions';
import { getPermissionByKey } from '@/lib/auth/permission-registry';

describe('CTF-4 mapa de permisos de contratos', () => {
  it.each([
    ['/api/contratos', 'GET'],
    ['/api/contratos', 'POST'],
    ['/api/contratos/ct-1', 'GET'],
    ['/api/contratos/ct-1', 'PUT'],
    ['/api/contratos/ct-1', 'DELETE'],
    ['/api/contratos/ct-1/firmas', 'POST'],
    ['/api/contratos/ct-1/aprobaciones', 'POST'],
    ['/api/contratos/ct-1/alertas', 'GET'],
    ['/api/contratos/ct-1/archivos', 'POST'],
    ['/api/contratos/ct-1/versiones', 'POST'],
    ['/api/contratos/ct-1/versiones/check-diff', 'POST'],
    ['/api/contratos/bulk/update-status', 'POST'],
    ['/api/contratos/bulk/delete', 'POST'],
  ])('resuelve %s %s a ventas.contratos.gestionar', (path, method) => {
    expect(getRoutePermissionKey(path, method)).toBe('ventas.contratos.gestionar');
  });

  it('GET de tipos de contrato es consulta (ventas.contratos.gestionar)', () => {
    expect(getRoutePermissionKey('/api/tipos-contratos', 'GET')).toBe('ventas.contratos.gestionar');
    expect(getRoutePermissionKey('/api/tipos-contratos/ct-1', 'GET')).toBe('ventas.contratos.gestionar');
  });

  it.each([
    ['POST'],
    ['PUT'],
  ])('escritura de tipos de contrato (%s) requiere config.tipos-contrato.crear', (method) => {
    expect(getRoutePermissionKey('/api/tipos-contratos', method)).toBe('config.tipos-contrato.crear');
    expect(getRoutePermissionKey('/api/tipos-contratos/ct-1', method)).toBe('config.tipos-contrato.crear');
  });

  it('DELETE de tipos de contrato requiere config.tipos-contrato.eliminar', () => {
    expect(getRoutePermissionKey('/api/tipos-contratos', 'DELETE')).toBe('config.tipos-contrato.eliminar');
    expect(getRoutePermissionKey('/api/tipos-contratos/ct-1', 'DELETE')).toBe('config.tipos-contrato.eliminar');
  });

  it('GET de la configuración de contratos es consulta (ventas.contratos.gestionar)', () => {
    expect(getRoutePermissionKey('/api/configuracion/sistema/contratos', 'GET')).toBe('ventas.contratos.gestionar');
  });

  it('PUT de la configuración de contratos requiere config.contratos.configurar', () => {
    expect(getRoutePermissionKey('/api/configuracion/sistema/contratos', 'PUT')).toBe('config.contratos.configurar');
  });

  it('no hay colisión: /api/contratos no captura tipos-contratos ni configuración', () => {
    // Si el prefijo genérico capturara las otras rutas, un PUT de tipos de
    // contrato resolvería a gestionar en lugar de crear.
    expect(getRoutePermissionKey('/api/tipos-contratos', 'POST')).not.toBe('ventas.contratos.gestionar');
    expect(getRoutePermissionKey('/api/configuracion/sistema/contratos', 'PUT')).not.toBe('ventas.contratos.gestionar');
  });

  it('todas las claves del mapa de contratos existen en el registry con defaultRoles', () => {
    for (const key of [
      'ventas.contratos.gestionar',
      'config.tipos-contrato.crear',
      'config.tipos-contrato.eliminar',
      'config.contratos.configurar',
    ]) {
      const permission = getPermissionByKey(key);
      expect(permission, `clave ${key} debe existir en el registry`).toBeTruthy();
      expect(permission?.defaultRoles.length).toBeGreaterThan(0);
    }
  });
});

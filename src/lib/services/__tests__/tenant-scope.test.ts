import { describe, expect, it } from 'vitest';
import { scopedWhere, assertTenantAccess, requireTenant, requireFeature } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

describe('scopedWhere', () => {
  it('agrega tenantId al where vacío', () => {
    const result = scopedWhere('tenant-1')
    expect(result).toEqual({ tenantId: 'tenant-1' })
  })

  it('agrega tenantId al where existente', () => {
    const result = scopedWhere('tenant-1', { categoriaId: 'cat-1' })
    expect(result).toEqual({ tenantId: 'tenant-1', categoriaId: 'cat-1' })
  })

  it('no muta el objeto original', () => {
    const original = { categoriaId: 'cat-1' }
    const result = scopedWhere('tenant-1', original)
    expect(original).toEqual({ categoriaId: 'cat-1' })
    expect(result).not.toBe(original)
  })

  it('combina múltiples filtros con tenantId', () => {
    const result = scopedWhere('t-1', { isActive: true, nombre: { contains: 'test' } })
    expect(result).toEqual({
      tenantId: 't-1',
      isActive: true,
      nombre: { contains: 'test' },
    })
  })
})

describe('assertTenantAccess', () => {
  it('no lanza cuando los tenants coinciden', () => {
    expect(() => assertTenantAccess('tenant-1', 'tenant-1', 'Producto')).not.toThrow()
  })

  it('lanza error cuando los tenants no coinciden', () => {
    expect(() => assertTenantAccess('tenant-1', 'tenant-2', 'Producto'))
      .toThrow('Acceso denegado: Producto no pertenece al tenant actual')
  })

  it('lanza error cuando el recurso no tiene tenant', () => {
    expect(() => assertTenantAccess(null, 'tenant-1', 'Producto'))
      .toThrow('Producto no tiene tenant asignado')
  })

  it('lanza error cuando el actor no tiene tenant', () => {
    expect(() => assertTenantAccess('tenant-1', undefined, 'Producto'))
      .toThrow('Contexto de tenant no disponible')
  })

  it('lanza error con undefined en resource', () => {
    expect(() => assertTenantAccess(undefined, 'tenant-1', 'Venta'))
      .toThrow('Venta no tiene tenant asignado')
  })
})

describe('requireTenant', () => {
  it('devuelve tenantId cuando el usuario tiene tenant', () => {
    const user = { userId: 'u-1', tenantId: 'tenant-1' } as AuthenticatedUser
    expect(requireTenant(user)).toBe('tenant-1')
  })

  it('lanza error cuando el usuario no tiene tenantId', () => {
    const user = { userId: 'u-1' } as AuthenticatedUser
    expect(() => requireTenant(user))
      .toThrow('Se requiere una membresía de empresa activa para acceder a este recurso')
  })
})

describe('requireFeature', () => {
  const userWithFeature = { userId: 'u-1', tenantId: 't-1', role: 'user', planFeatures: { clientes: true } } as AuthenticatedUser;
  const userWithoutFeature = { userId: 'u-2', tenantId: 't-1', role: 'user', planFeatures: { clientes: false } } as AuthenticatedUser;
  const userNoPlanFeatures = { userId: 'u-3', tenantId: 't-1', role: 'user' } as AuthenticatedUser;
  const adminUser = { userId: 'u-4', role: 'admin' } as AuthenticatedUser;
  const userNoTenant = { userId: 'u-5', role: 'user', planFeatures: { clientes: true } } as AuthenticatedUser;

  it('permite acceso cuando planFeatures[key] es true', () => {
    expect(() => requireFeature(userWithFeature, 'clientes')).not.toThrow();
  });

  it('lanza FEATURE_NOT_AVAILABLE cuando planFeatures[key] es false', () => {
    expect(() => requireFeature(userWithoutFeature, 'clientes', 'gestión de clientes'))
      .toThrowError(/Tu plan actual no incluye la funcionalidad de gestión de clientes/);
  });

  it('lanza FEATURE_NOT_AVAILABLE cuando planFeatures es undefined (usuario tenant sin plan)', () => {
    expect(() => requireFeature(userNoPlanFeatures, 'clientes'))
      .toThrowError(/Tu plan actual no incluye la funcionalidad/);
  });

  it('permite acceso a admin global sin planFeatures', () => {
    expect(() => requireFeature(adminUser, 'clientes')).not.toThrow();
  });

  it('lanza error de tenant cuando el usuario no tiene tenantId (y no es admin)', () => {
    expect(() => requireFeature(userNoTenant, 'clientes'))
      .toThrow('Se requiere una membresía de empresa activa para acceder a este recurso');
  });
})

import { describe, expect, it } from 'vitest';
import {
  scopedWhere,
  assertTenantAccess,
  requireTenant,
  requireFeature,
  requireManagerRole,
  requireEconomicoRole,
  requireDependienteRole,
  requirePermission,
  hasPermission,
} from '@/lib/services/tenant-scope'
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

  describe('features del plan Profesional', () => {
    const basicoUser = { userId: 'u-basico', tenantId: 't-1', role: 'user', planFeatures: {} } as AuthenticatedUser;
    const profesionalUser = { userId: 'u-pro', tenantId: 't-1', role: 'user', planFeatures: {
      'transferencias-bancarias': true,
      'ajustes-bancarios': true,
      'ventas-factura': true,
      'multi-moneda': true,
      'facturacion': true,
    } } as AuthenticatedUser;

    const PROFESIONAL_FEATURES: Array<{ key: string; label: string }> = [
      { key: 'transferencias-bancarias', label: 'transferencias bancarias' },
      { key: 'ajustes-bancarios', label: 'ajustes bancarios' },
      { key: 'ventas-factura', label: 'generar factura desde ventas' },
      { key: 'multi-moneda', label: 'operaciones multi-moneda' },
      { key: 'facturacion', label: 'facturación' },
    ];

    PROFESIONAL_FEATURES.forEach(({ key, label }) => {
      it(`bloquea '${key}' para usuario sin el feature (plan Básico)`, () => {
        expect(() => requireFeature(basicoUser, key, label))
          .toThrowError(`Tu plan actual no incluye la funcionalidad de ${label}`);
      });

      it(`permite '${key}' para usuario con el feature (plan Profesional)`, () => {
        expect(() => requireFeature(profesionalUser, key, label)).not.toThrow();
      });
    });
  });

  describe('features de inventario por plan (paridad Odoo)', () => {
    const basicoUser = { userId: 'u-bas', tenantId: 't-1', role: 'user', planFeatures: {
      kardex: true, 'ajustes-inventario': true, 'conteo-fisico': true,
    } } as AuthenticatedUser;
    const profesionalUser = { userId: 'u-pro', tenantId: 't-1', role: 'user', planFeatures: {
      kardex: true, 'ajustes-inventario': true, 'conteo-fisico': true,
      'ordenes-compra': true, recepciones: true, reabastecimiento: true,
      'unidades-conversion': true, 'lotes-series': true, variantes: true,
      'ubicaciones-avanzadas': true,
    } } as AuthenticatedUser;
    const empresarialUser = { userId: 'u-emp', tenantId: 't-1', role: 'user', planFeatures: {
      'mrp-avanzado': true,
    } } as AuthenticatedUser;

    it('permite el núcleo auditable en plan Básico', () => {
      for (const key of ['kardex', 'ajustes-inventario', 'conteo-fisico']) {
        expect(() => requireFeature(basicoUser, key, key)).not.toThrow();
      }
    });

    it('bloquea P1 en plan Básico con FEATURE_NOT_AVAILABLE', () => {
      for (const key of ['ordenes-compra', 'lotes-series', 'variantes']) {
        expect(() => requireFeature(basicoUser, key, key))
          .toThrowError(/Tu plan actual no incluye la funcionalidad/);
      }
    });

    it('permite P1 en Profesional y reserva MRP a Empresarial', () => {
      expect(() => requireFeature(profesionalUser, 'ordenes-compra', 'x')).not.toThrow();
      expect(() => requireFeature(profesionalUser, 'mrp-avanzado', 'x'))
        .toThrowError(/Tu plan actual no incluye la funcionalidad/);
      expect(() => requireFeature(empresarialUser, 'mrp-avanzado', 'x')).not.toThrow();
    });
  });
})

describe('role gates', () => {
  const dependienteUser = {
    userId: 'u-dep',
    tenantId: 't-1',
    tenantRole: 'dependiente',
  } as AuthenticatedUser;
  const economicoUser = {
    userId: 'u-eco',
    tenantId: 't-1',
    tenantRole: 'economico',
  } as AuthenticatedUser;
  const managerUser = {
    userId: 'u-man',
    tenantId: 't-1',
    tenantRole: 'manager',
  } as AuthenticatedUser;
  const invalidRoleUser = {
    userId: 'u-invalid',
    tenantId: 't-1',
    tenantRole: 'cajero',
  } as AuthenticatedUser;

  it('requireManagerRole permite manager y rechaza economico', () => {
    expect(() => requireManagerRole(managerUser, 'administrar productos')).not.toThrow();
    expect(() => requireManagerRole(economicoUser, 'administrar productos'))
      .toThrow(/Solo el administrador de la empresa/);
  });

  it('requireEconomicoRole permite economico y manager', () => {
    expect(() => requireEconomicoRole(economicoUser, 'ver reportes')).not.toThrow();
    expect(() => requireEconomicoRole(managerUser, 'ver reportes')).not.toThrow();
  });

  it('requireEconomicoRole rechaza dependiente', () => {
    expect(() => requireEconomicoRole(dependienteUser, 'ver reportes'))
      .toThrow(/Solo los roles económico o manager/);
  });

  it('requireDependienteRole permite cualquier rol operativo válido', () => {
    expect(() => requireDependienteRole(dependienteUser, 'registrar ventas')).not.toThrow();
    expect(() => requireDependienteRole(economicoUser, 'registrar ventas')).not.toThrow();
    expect(() => requireDependienteRole(managerUser, 'registrar ventas')).not.toThrow();
  });

  it('requireDependienteRole rechaza rol de tenant inválido', () => {
    expect(() => requireDependienteRole(invalidRoleUser, 'registrar ventas'))
      .toThrow(/rol operativo válido/);
  });
});

describe('requirePermission / hasPermission (PG-03)', () => {
  const KEY = 'ventas.servicios.eliminar';
  const userWith = {
    userId: 'u-1',
    role: 'regularUser',
    tenantId: 't-1',
    tenantRole: 'dependiente',
    permissions: new Set([KEY]),
  } as unknown as AuthenticatedUser;
  const userWithout = {
    userId: 'u-2',
    role: 'regularUser',
    tenantId: 't-1',
    tenantRole: 'dependiente',
    permissions: new Set<string>(),
  } as unknown as AuthenticatedUser;
  const adminUser = {
    userId: 'u-admin',
    role: 'admin',
    isActive: true,
  } as unknown as AuthenticatedUser;

  it('lanza FORBIDDEN con mensaje neutro si falta el permiso', () => {
    try {
      requirePermission(userWithout, KEY, 'eliminar ventas de servicios');
      expect.unreachable('debía lanzar');
    } catch (error) {
      const err = error as { message: string; code?: string };
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toContain('No tienes permisos para eliminar ventas de servicios.');
    }
  });

  it('mensaje genérico cuando no se pasa acción', () => {
    expect(() => requirePermission(userWithout, KEY)).toThrow(
      /No tienes permisos para realizar esta acción\./,
    );
  });

  it('pasa cuando el usuario tiene el permiso', () => {
    expect(() => requirePermission(userWith, KEY, 'eliminar ventas de servicios')).not.toThrow();
  });

  it('lanza error de contexto si el usuario no tiene tenant (aunque tenga el permiso)', () => {
    const noTenant = { ...userWith, tenantId: undefined } as AuthenticatedUser;
    expect(() => requirePermission(noTenant, KEY, 'hacer algo')).toThrow(/membresía de empresa/);
  });

  it('admin global pasa siempre, incluso sin tenant ni permisos resueltos', () => {
    expect(() => requirePermission(adminUser, KEY)).not.toThrow();
  });

  it('usuario sin permissions resueltos (legacy) cae en FORBIDDEN, no en crash', () => {
    const legacyUser = {
      userId: 'u-3',
      role: 'regularUser',
      tenantId: 't-1',
      tenantRole: 'manager',
    } as unknown as AuthenticatedUser;
    expect(() => requirePermission(legacyUser, KEY)).toThrow(/No tienes permisos/);
  });

  it('hasPermission refleja el set de permisos y el bypass admin', () => {
    expect(hasPermission(userWith, KEY)).toBe(true);
    expect(hasPermission(userWithout, KEY)).toBe(false);
    expect(hasPermission(adminUser, KEY)).toBe(true);
    expect(hasPermission({ ...userWith, permissions: undefined } as AuthenticatedUser, KEY)).toBe(false);
  });

  it('orden con requireFeature: FEATURE_NOT_AVAILABLE precede a FORBIDDEN', () => {
    const offPlanNoPerm = {
      ...userWithout,
      planFeatures: { servicios: false },
    } as AuthenticatedUser;
    const onPlanNoPerm = {
      ...userWithout,
      planFeatures: { servicios: true },
    } as AuthenticatedUser;

    // Orden documentado: primero feature (eje comercial), después permiso.
    const compose = (user: AuthenticatedUser) => {
      requireFeature(user, 'servicios', 'ventas de servicios');
      requirePermission(user, KEY, 'eliminar ventas de servicios');
    };
    const userWithBoth = { ...userWith, planFeatures: { servicios: true } } as AuthenticatedUser;

    expect(() => compose(offPlanNoPerm)).toThrow(/Tu plan actual no incluye/);
    expect(() => compose(onPlanNoPerm)).toThrow(/No tienes permisos para eliminar ventas de servicios/);
    expect(() => compose(userWithBoth)).not.toThrow();
  });
});

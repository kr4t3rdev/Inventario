import { describe, expect, it } from 'vitest';
import {
  assertInitializationAccess,
  assertInitializationPlanFeatures,
  getInitializationPlanFeatureUsage,
} from './initialization-idempotency';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'u1', name: 'QA', email: 'qa@example.test', role: 'user', isActive: true,
    tenantId: 'tenant-a', tenantRole: 'manager',
    permissions: new Set(['financiero.apertura.aprobar']),
    planFeatures: { contabilidad: true },
    ...overrides,
  } as AuthenticatedUser;
}

describe('acceso a la inicialización contable', () => {
  it('permite al admin global sin comprobar permiso ni feature', () => {
    expect(() => assertInitializationAccess(user({ role: 'admin', permissions: new Set(), planFeatures: {} }))).not.toThrow();
  });

  it('permite al manager con permiso de apertura y feature de contabilidad', () => {
    expect(() => assertInitializationAccess(user())).not.toThrow();
  });

  it('rechaza sin permiso de aprobación de aperturas', () => {
    expect(() => assertInitializationAccess(user({ permissions: new Set() })))
      .toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('rechaza sin feature de contabilidad en el plan', () => {
    expect(() => assertInitializationAccess(user({ planFeatures: {} })))
      .toThrowError(expect.objectContaining({ code: 'FEATURE_NOT_AVAILABLE' }));
  });

  it('rechaza sin membresía de empresa activa', () => {
    expect(() => assertInitializationAccess(user({ tenantId: undefined }))).toThrow();
  });

  it('limita cada sección opcional según las features del plan', () => {
    const plan = user({ planFeatures: { contabilidad: true, productos: true } });
    expect(() => assertInitializationPlanFeatures(plan, { inventario: true })).not.toThrow();
    expect(() => assertInitializationPlanFeatures(plan, { cuentasPorCobrar: true }))
      .toThrowError(expect.objectContaining({ code: 'FEATURE_NOT_AVAILABLE' }));
  });

  it('permite la carga completa cuando el plan habilita todos sus módulos', () => {
    const fullPlan = user({ planFeatures: {
      contabilidad: true,
      productos: true,
      'cuentas-cobrar': true,
      clientes: true,
      'cuentas-pagar': true,
      anticipos: true,
      'inyeccion-capital': true,
      'deudas-cash': true,
      'prestamos-cash': true,
      'multi-moneda': true,
    } });
    expect(() => assertInitializationPlanFeatures(fullPlan, {
      inventario: true,
      cuentasPorCobrar: true,
      clientes: true,
      cuentasPorPagar: true,
      anticipo: true,
      inyeccionCapital: true,
      deudaCash: true,
      prestamoCash: true,
      multiMoneda: true,
    })).not.toThrow();
  });

  it('detecta módulos y monedas desde las secciones reales de la carga', () => {
    expect(getInitializationPlanFeatureUsage({
      monedaFuncional: 'CUP',
      cuentas: [{ moneda: 'USD', origen: { tipo: 'PRESTAMO', proveedorId: 'p1' } }],
      inventario: [{ moneda: 'CUP' }],
      cuentasPorCobrar: [{ moneda: 'USD', tasaInteres: '0', tasaInteresMoratorio: '0' }],
      cuentasPorPagar: [{ moneda: 'CUP' }],
    })).toEqual({
      inventario: true,
      cuentasPorCobrar: true,
      clientes: true,
      cuentasPorPagar: true,
      anticipo: false,
      inyeccionCapital: true,
      deudaCash: true,
      prestamoCash: true,
      multiMoneda: true,
    });
  });

  it.each([
    [{ cuentasPorCobrar: true }, 'cuentas-cobrar'],
    [{ clientes: true }, 'clientes'],
    [{ cuentasPorPagar: true }, 'cuentas-pagar'],
    [{ anticipo: true }, 'anticipos'],
    [{ inyeccionCapital: true }, 'inyeccion-capital'],
    [{ deudaCash: true }, 'deudas-cash'],
    [{ prestamoCash: true }, 'prestamos-cash'],
    [{ multiMoneda: true }, 'multi-moneda'],
  ] as const)('requiere la feature %s', (section) => {
    expect(() => assertInitializationPlanFeatures(user(), section))
      .toThrowError(expect.objectContaining({ code: 'FEATURE_NOT_AVAILABLE' }));
  });
});

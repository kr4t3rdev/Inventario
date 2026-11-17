import { describe, expect, it } from 'vitest';
import { assertInitializationAccess } from './initialization-idempotency';
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
});

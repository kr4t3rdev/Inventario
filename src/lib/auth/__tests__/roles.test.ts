import { describe, expect, it } from 'vitest';

import {
  isAdminRole,
  normalizeUserRole,
  platformRoleToTenantRole,
  isTenantAdminRole,
  isTenantEconomicoRole,
} from '@/lib/auth/roles';

describe('roles - plataforma', () => {
  it('normaliza roles legados correctamente', () => {
    expect(normalizeUserRole('ADMIN')).toBe('admin');
    expect(normalizeUserRole('SUPERADMIN')).toBe('admin');
    expect(normalizeUserRole('user')).toBe('regularUser');
  });

  it('reconoce roles válidos y rechaza inválidos', () => {
    // dependiente se mapea a regularUser (legado)
    expect(normalizeUserRole('dependiente')).toBe('regularUser');
    expect(normalizeUserRole('regularUser')).toBe('regularUser');
    expect(normalizeUserRole('guest')).toBeNull();
  });

  it('identifica admin usando normalización central', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('regularUser')).toBe(false);
  });
});

describe('roles - tenant', () => {
  describe('platformRoleToTenantRole', () => {
    it('mapea admin → manager', () => {
      expect(platformRoleToTenantRole('admin')).toBe('manager');
    });

    it('mapea rol regular de plataforma → dependiente', () => {
      expect(platformRoleToTenantRole('regularUser')).toBe('dependiente');
    });
  });

  describe('isTenantAdminRole', () => {
    it('reconoce manager como admin tenant', () => {
      expect(isTenantAdminRole('manager')).toBe(true);
    });

    it('mapea admin legacy a manager', () => {
      expect(isTenantAdminRole('admin')).toBe(true);
    });

    it('rechaza dependiente como admin tenant', () => {
      expect(isTenantAdminRole('dependiente')).toBe(false);
    });

    it('rechaza economico como admin tenant', () => {
      expect(isTenantAdminRole('economico')).toBe(false);
    });

    it('rechaza null/undefined', () => {
      expect(isTenantAdminRole(null)).toBe(false);
      expect(isTenantAdminRole(undefined)).toBe(false);
    });
  });

  describe('isTenantEconomicoRole', () => {
    it('reconoce economico', () => {
      expect(isTenantEconomicoRole('economico')).toBe(true);
    });

    it('reconoce manager como rol con acceso económico', () => {
      expect(isTenantEconomicoRole('manager')).toBe(true);
    });

    it('mapea admin legacy a manager', () => {
      expect(isTenantEconomicoRole('admin')).toBe(true);
    });

    it('rechaza dependiente', () => {
      expect(isTenantEconomicoRole('dependiente')).toBe(false);
    });
  });
});

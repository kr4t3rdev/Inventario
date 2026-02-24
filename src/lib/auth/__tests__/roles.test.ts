import { describe, expect, it } from 'vitest';

import { isAdminRole, normalizeUserRole } from '@/lib/auth/roles';

describe('roles', () => {
  it('normaliza roles legados correctamente', () => {
    expect(normalizeUserRole('ADMIN')).toBe('admin');
    expect(normalizeUserRole('SUPERADMIN')).toBe('admin');
    expect(normalizeUserRole('user')).toBe('regularUser');
  });

  it('reconoce roles válidos y rechaza inválidos', () => {
    expect(normalizeUserRole('dependiente')).toBe('dependiente');
    expect(normalizeUserRole('regularUser')).toBe('regularUser');
    expect(normalizeUserRole('guest')).toBeNull();
  });

  it('identifica admin usando normalización central', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('regularUser')).toBe(false);
  });
});

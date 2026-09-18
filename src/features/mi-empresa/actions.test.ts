import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/features/mi-empresa/services/mi-empresa-service', () => ({
  getMiEmpresaByTenant: vi.fn(),
  upsertMiEmpresa: vi.fn(),
}));

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import {
  getMiEmpresaByTenant,
  upsertMiEmpresa,
} from '@/features/mi-empresa/services/mi-empresa-service';
import {
  getMiEmpresaAction,
  updateMiEmpresaAction,
} from '@/features/mi-empresa/actions';

const featureBlockedUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Blocked',
  email: 'blocked@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { 'mi-empresa': false },
};

describe('mi-empresa actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloquea lectura cuando el plan no incluye mi empresa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(featureBlockedUser);

    const result = await getMiEmpresaAction();

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(vi.mocked(getMiEmpresaByTenant)).not.toHaveBeenCalled();
  });

  it('bloquea update cuando el plan no incluye mi empresa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(featureBlockedUser);

    const result = await updateMiEmpresaAction({ nombre: 'Mi Empresa' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(vi.mocked(upsertMiEmpresa)).not.toHaveBeenCalled();
  });
});

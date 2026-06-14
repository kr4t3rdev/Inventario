import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/bank-account-read-service', () => ({
  BankAccountReadService: {
    getById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { BankAccountReadService } from '@/features/contabilidad/services/bank-account-read-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile accounting bank account detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a tenant bank account by id', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(BankAccountReadService.getById).mockResolvedValue({
      cuentaId: 'cb-1',
      nombreBanco: 'Banco 1',
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts/cb-1', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'cb-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cuentaId).toBe('cb-1');
    expect(BankAccountReadService.getById).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      cuentaId: 'cb-1',
    });
  });

  it('maps missing bank account to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(BankAccountReadService.getById).mockRejectedValue(
      new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-accounts/missing', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Cuenta bancaria no encontrada');
  });
});

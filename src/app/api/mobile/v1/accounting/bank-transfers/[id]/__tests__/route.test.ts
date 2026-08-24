import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/contabilidad/services/accounting-operations-read-service', () => ({
  AccountingOperationsReadService: {
    getBankTransferById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { AccountingOperationsReadService } from '@/features/contabilidad/services/accounting-operations-read-service';
import { GET } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
};

describe('mobile accounting bank transfer detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a bank transfer by id', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getBankTransferById).mockResolvedValue({
      transferenciaId: 'tb-1',
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-transfers/tb-1', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'tb-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transferenciaId).toBe('tb-1');
    expect(AccountingOperationsReadService.getBankTransferById).toHaveBeenCalledWith(
      'tb-1',
      'tenant-1',
    );
  });

  it('maps missing transfer to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(AccountingOperationsReadService.getBankTransferById).mockRejectedValue(
      new ActionError('Transferencia no encontrada', 'NOT_FOUND'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/accounting/bank-transfers/missing', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Transferencia no encontrada');
  });
});

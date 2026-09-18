import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/ventas/services/venta-read-service', () => ({
  VentaReadService: {
    getById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { VentaReadService } from '@/features/ventas/services/venta-read-service';
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

describe('mobile sale detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a tenant sale by id', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaReadService.getById).mockResolvedValue({ ventaId: 'v-1', total: 100 } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/v-1', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'v-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ventaId).toBe('v-1');
    expect(VentaReadService.getById).toHaveBeenCalledWith({ tenantId: 'tenant-1', ventaId: 'v-1' });
  });

  it('maps missing sale to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaReadService.getById).mockRejectedValue(
      new ActionError('Venta no encontrada', 'NOT_FOUND'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/missing', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Venta no encontrada');
  });
});

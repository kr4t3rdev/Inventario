import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/ventas/services/venta-mutation-service', () => ({
  VentaMutationService: {
    update: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { PATCH } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile sales update route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a sale for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.update).mockResolvedValue({ ventaId: 'v-1', observaciones: 'updated' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/v-1/update', {
      method: 'PATCH',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'updated' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'v-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ventaId).toBe('v-1');
    expect(VentaMutationService.update).toHaveBeenCalledWith({
      input: { ventaId: 'v-1', observaciones: 'updated' },
      user: mockUser,
    });
  });

  it('maps missing sale to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.update).mockRejectedValue(
      new ActionError('Venta no encontrada', 'NOT_FOUND'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/missing/update', {
      method: 'PATCH',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ observaciones: 'updated' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    expect(response.status).toBe(404);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/ventas/services/venta-mutation-service', () => ({
  VentaMutationService: {
    cancel: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { POST } from '../route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile sales cancel route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels a sale for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.cancel).mockResolvedValue({ ventaId: 'v-1', anulada: true } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/v-1/cancel', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'duplicada' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'v-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.anulada).toBe(true);
    expect(VentaMutationService.cancel).toHaveBeenCalledWith({
      input: { ventaId: 'v-1', motivo: 'duplicada' },
      user: mockUser,
    });
  });

  it('maps validation errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.cancel).mockRejectedValue(
      new ActionError('La venta ya está anulada', 'VALIDATION_ERROR'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/v-1/cancel', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ motivo: 'duplicada' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'v-1' }) } as never);
    expect(response.status).toBe(400);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/ventas/services/venta-mutation-service', () => ({
  VentaMutationService: {
    create: vi.fn(),
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
  planFeatures: { facturacion: true },
};

describe('mobile sales create route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/create', { method: 'POST' });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('creates a sale for the authenticated tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.create).mockResolvedValue({ ventaId: 'v-1', total: 1000 } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/create', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({
        puntoDeVentaId: 'pv-1',
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ventaId).toBe('v-1');
    expect(VentaMutationService.create).toHaveBeenCalledWith({
      input: {
        puntoDeVentaId: 'pv-1',
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 500 }],
      },
      user: mockUser,
    });
  });

  it('maps stock errors to 400', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaMutationService.create).mockRejectedValue(
      new ActionError('Stock insuficiente', 'STOCK_INSUFICIENTE'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales/create', {
      method: 'POST',
      headers: { authorization: 'Bearer mobile-access', 'content-type': 'application/json' },
      body: JSON.stringify({ puntoDeVentaId: 'pv-1', items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 10 }] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock insuficiente');
  });
});

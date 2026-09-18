import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: vi.fn((handler) => (request: NextRequest, context: unknown) =>
    handler(request, context, {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      planFeatures: { facturacion: true, 'ventas-pos': true },
    }),
  ),
}));

vi.mock('@/features/ventas/services/venta-mutation-service', () => ({
  VentaMutationService: {
    create: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { ActionError } from '@/lib/server-actions';
import { VentaMutationService } from '@/features/ventas/services/venta-mutation-service';
import { POST } from './route';

describe('/api/ventas/punto-venta/ventas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a sale through a stable POST route for browser POS flows', async () => {
    vi.mocked(VentaMutationService.create).mockResolvedValue({ ventaId: 'v-1', total: 1000 } as never);

    const request = new NextRequest('http://localhost/api/ventas/punto-venta/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      user: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/busy/sales');
  });

  it('maps stock errors to 400 for recoverable POS failures', async () => {
    vi.mocked(VentaMutationService.create).mockRejectedValue(
      new ActionError('Stock insuficiente', 'STOCK_INSUFICIENTE'),
    );

    const request = new NextRequest('http://localhost/api/ventas/punto-venta/ventas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        puntoDeVentaId: 'pv-1',
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 500 }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({ error: 'Stock insuficiente', code: 'STOCK_INSUFICIENTE' });
  });
});

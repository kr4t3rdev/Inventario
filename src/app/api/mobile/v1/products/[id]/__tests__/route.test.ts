import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/productos/services/producto-service', () => ({
  ProductoService: {
    getById: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { ProductoService } from '@/features/productos/services/producto-service';
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

describe('mobile product detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the tenant product detail', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.getById).mockResolvedValue({ id: 'prod-1', nombre: 'Harina' } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/products/prod-1', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'prod-1' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('prod-1');
    expect(ProductoService.getById).toHaveBeenCalledWith({ tenantId: 'tenant-1', productId: 'prod-1' });
  });

  it('maps product not found to 404', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.getById).mockRejectedValue(
      new ActionError('Producto no encontrado', 'NOT_FOUND'),
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/products/missing', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) } as never);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Producto no encontrado');
  });
});

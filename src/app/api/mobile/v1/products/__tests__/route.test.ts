import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/productos/services/producto-service', () => ({
  ProductoService: {
    list: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
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

describe('mobile products route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/products');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns the authenticated tenant products', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.list).mockResolvedValue([
      { id: 'prod-1', nombre: 'Harina' },
      { id: 'prod-2', nombre: 'Azúcar' },
    ] as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/products', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(ProductoService.list).toHaveBeenCalledWith('tenant-1');
  });

  it('ignores mobile convenience filters and keeps the legacy list behavior', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.list).mockResolvedValue([
      { id: 'prod-1', nombre: 'Harina Integral' },
    ] as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/products?ubicacionId=alm-1&tipoUbicacion=almacen&includeZero=false&search=integral&categoryId=cat-1&subcategoryId=sub-1',
      {
        headers: { authorization: 'Bearer mobile-access' },
      },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(ProductoService.list).toHaveBeenCalledWith('tenant-1');
  });
});

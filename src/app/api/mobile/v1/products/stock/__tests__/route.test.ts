import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/productos/services/producto-service', () => ({
  ProductoService: {
    listByLocation: vi.fn(),
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

describe('mobile products stock route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/products/stock');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('requires ubicacionId and tipoUbicacion to mirror the legacy stock action', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/products/stock', {
      headers: { authorization: 'Bearer mobile-access' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('forwards only the legacy stock-by-location params', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.listByLocation).mockResolvedValue([
      { id: 'prod-1', nombre: 'Harina Integral', stockUbicacion: 8 },
    ] as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/products/stock?ubicacionId=alm-1&tipoUbicacion=almacen&includeZero=false&search=integral&categoryId=cat-1',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(ProductoService.listByLocation).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
      includeZero: false,
    });
  });
});

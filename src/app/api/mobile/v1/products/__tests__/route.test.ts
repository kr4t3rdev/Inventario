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

  it('caracteriza vacío, tenant ausente, error interno y JSON de fechas/precios', async () => {
    const date = new Date('2025-01-01T00:00:00.000Z');
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(ProductoService.list).mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      { id: 'a', stock: 0, stockTotal: 0, precioCosto: 1250, createdAt: date },
    ] as never).mockRejectedValueOnce(new Error('private database details'));
    const request = new NextRequest('http://localhost/api/mobile/v1/products', {
      headers: { 'x-tenant-id': 'B' },
    });
    const empty = await GET(request);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ items: [] });
    const filled = await GET(request);
    expect(await filled.json()).toEqual({ items: [{
       id: 'a', stock: 0, stockTotal: 0, precioCosto: 1250, createdAt: date.toISOString(),
    }] });
    expect(ProductoService.list).toHaveBeenCalledWith('tenant-1');
    const error = await GET(request);
    expect(error.status).toBe(500);
    expect(await error.json()).toEqual({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...mockUser, tenantId: null } } as never);
    const noTenant = await GET(request);
    expect(noTenant.status).toBe(403);
    expect(await noTenant.json()).toEqual({ error: 'Tenant no identificado', code: 'TENANT_REQUIRED' });
    expect(ProductoService.list).toHaveBeenCalledTimes(3);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/ventas/services/venta-read-service', () => ({
  VentaReadService: {
    list: vi.fn(),
  },
}));

import { authenticateUser } from '@/lib/auth-middleware';
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

describe('mobile sales route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/sales');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns tenant sales with forwarded filters', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(VentaReadService.list).mockResolvedValue([{ ventaId: 'v-1', total: 100 }] as never);

    const request = new NextRequest(
      'http://localhost/api/mobile/v1/sales?search=maria&puntoDeVentaId=pv-1&clienteId=cliente-1&dateFrom=2026-01-01&dateTo=2026-01-31',
      { headers: { authorization: 'Bearer mobile-access' } },
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(VentaReadService.list).toHaveBeenCalledWith('tenant-1', {
      search: 'maria',
      puntoDeVentaId: 'pv-1',
      clienteId: 'cliente-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
  });
});

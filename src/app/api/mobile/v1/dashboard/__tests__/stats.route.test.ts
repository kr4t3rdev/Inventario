import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}));

vi.mock('@/features/dashboard/services/dashboard-stats-service', () => ({
  getDashboardStatsData: vi.fn(),
}));

import { authenticateUser } from '@/lib/auth-middleware';
import { getDashboardStatsData } from '@/features/dashboard/services/dashboard-stats-service';
import { GET } from '../stats/route';

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

describe('mobile dashboard stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when bearer auth is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );

    const request = new NextRequest('http://localhost/api/mobile/v1/dashboard/stats', {
      method: 'GET',
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns dashboard stats for authenticated mobile clients', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
    vi.mocked(getDashboardStatsData).mockResolvedValue({
      totalProductos: 10,
      totalAlmacenes: 2,
      totalPuntosVenta: 1,
      ventasDiarias: { ventasHoy: 3, ingresosHoy: 1200 },
      productosMasVendidos: [],
      productosStockBajo: [],
      datosPorMes: [],
      datosPorSemana: [],
      distribucionStock: [],
      transferenciasStats: { almacenAAlmacen: 0, almacenAPuntoVenta: 0, puntoVentaAAlmacen: 0, puntoVentaAPuntoVenta: 0 },
      totalVentas: 0,
      totalMermas: 0,
      totalTransferencias: 0,
      totalIngresos: 0,
      totalGastosMermas: 0,
      totalBeneficio: 0,
      valorTotalInventario: 0,
    } as never);

    const request = new NextRequest('http://localhost/api/mobile/v1/dashboard/stats?ubicacionId=alm-1&tipoUbicacion=almacen', {
      method: 'GET',
      headers: { authorization: 'Bearer mobile-access' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalProductos).toBe(10);
    expect(vi.mocked(getDashboardStatsData)).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      ubicacionId: 'alm-1',
      tipoUbicacion: 'almacen',
    });
  });
});

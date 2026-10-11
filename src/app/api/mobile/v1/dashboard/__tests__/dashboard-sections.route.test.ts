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
import { GET as getIncomeExpenses } from '../income-expenses/route';
import { GET as getTopProducts } from '../top-products/route';
import { GET as getStockDistribution } from '../stock-distribution/route';
import { GET as getTransfers } from '../transfers/route';
import { GET as getLowStock } from '../low-stock/route';
import { GET as getTodaySales } from '../today-sales/route';
import { GET as getDailyAverage } from '../daily-average/route';
import { GET as getInventoryValue } from '../inventory-value/route';

const statsFixture = {
  totalProductos: 10,
  totalAlmacenes: 2,
  totalPuntosVenta: 1,
  totalVentas: 5,
  totalMermas: 1,
  totalTransferencias: 3,
  totalIngresos: 1500,
  totalGastosMermas: 50,
  totalGastos: 200,
  totalBeneficio: 1250,
  valorTotalInventario: 5000,
  datosPorMes: [
    {
      mes: 'Sep', ingresosVentas: 1000, ingresosServicios: 200,
      gastosMermas: 10, gastosDeExplotacion: 50, gastosDeExplotacionCantidad: 2,
      gastosCompras: 100, gastosComprasCantidad: 1, gastosSalarios: 80,
      gastosSalariosCantidad: 1, ventasCantidad: 3, ventasServiciosCantidad: 1,
      mermasCantidad: 1,
    },
  ],
  datosPorSemana: [],
  ventasDiarias: {
    ventasHoy: 2, ingresosHoy: 300, ventasAyer: 1, ingresosAyer: 100,
    promedioVentasDiarias: 1.5, promedioIngresosDiarios: 200,
    diasConVentas: 4, totalDias: 5, totalIngresosPeriodo: 800,
    totalCantidadPeriodo: 6,
  },
  productosMasVendidos: [
    { id: 'p-1', nombre: 'Café', categoria: 'Básicos', ventas: 10, ingresos: 500, stock: 20 },
  ],
  productosStockBajo: [
    {
      id: 'p-2', nombre: 'Azúcar', stock: 2, stockMinimo: 5,
      precioCosto: 1, precioVenta: 2, almacenId: 'a-1', puntoDeVentaId: null,
      categoria: { nombre: 'Básicos' }, unidad: { simbolo: 'kg' },
      stockTotal: 2, stockMinimo: 5, diferencia: 3, umbralUsado: 5,
    },
  ],
  distribucionStock: [
    { categoria: 'Básicos', productos: 5, stockTotal: 100, valorTotal: 1000 },
  ],
  transferenciasStats: {
    almacenAAlmacen: 1, almacenAPuntoVenta: 2,
    puntoVentaAAlmacen: 0, puntoVentaAPuntoVenta: 0,
  },
};

const mockUser = {
  userId: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
};

function authed() {
  vi.mocked(authenticateUser).mockResolvedValue({ user: mockUser } as never);
  vi.mocked(getDashboardStatsData).mockResolvedValue(statsFixture as never);
}

function req(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'GET',
    headers: { authorization: 'Bearer <redacted>' },
  });
}

describe('mobile dashboard section routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /dashboard/income-expenses returns totals and monthly serie', async () => {
    authed();
    const response = await getIncomeExpenses(req('/api/mobile/v1/dashboard/income-expenses'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.ingresos).toBe(1500);
    expect(data.gastos).toBe(200);
    expect(data.serie).toHaveLength(1);
    expect(data.serie[0]).toEqual({ label: 'Sep', ingresos: 1200, gastos: 240 });
  });

  it('GET /dashboard/top-products maps ventas/ingresos', async () => {
    authed();
    const response = await getTopProducts(req('/api/mobile/v1/dashboard/top-products'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toEqual([
      { id: 'p-1', nombre: 'Café', cantidad: 10, total: 500 },
    ]);
  });

  it('GET /dashboard/stock-distribution maps categoria/cantidad', async () => {
    authed();
    const response = await getStockDistribution(req('/api/mobile/v1/dashboard/stock-distribution'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toEqual([{ categoria: 'Básicos', cantidad: 100 }]);
  });

  it('GET /dashboard/transfers returns the four transfer types', async () => {
    authed();
    const response = await getTransfers(req('/api/mobile/v1/dashboard/transfers'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(4);
    expect(data.items[0]).toEqual({
      id: 'almacen-almacen', descripcion: 'Almacén → Almacén',
      monto: 1, estado: 'Completada',
    });
    expect(data.items[1].monto).toBe(2);
  });

  it('GET /dashboard/low-stock maps stock/minimo', async () => {
    authed();
    const response = await getLowStock(req('/api/mobile/v1/dashboard/low-stock'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toEqual([
      { id: 'p-2', nombre: 'Azúcar', stock: 2, minimo: 5 },
    ]);
  });

  it('GET /dashboard/today-sales returns ingresosHoy', async () => {
    authed();
    const response = await getTodaySales(req('/api/mobile/v1/dashboard/today-sales'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ value: 300 });
  });

  it('GET /dashboard/daily-average returns promedioIngresosDiarios', async () => {
    authed();
    const response = await getDailyAverage(req('/api/mobile/v1/dashboard/daily-average'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ value: 200 });
  });

  it('GET /dashboard/inventory-value returns valorTotalInventario', async () => {
    authed();
    const response = await getInventoryValue(req('/api/mobile/v1/dashboard/inventory-value'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual({ value: 5000 });
  });

  it('returns 401 when Bearer <redacted> is missing', async () => {
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 }) as never,
    );
    const response = await getTodaySales(req('/api/mobile/v1/dashboard/today-sales'));
    expect(response.status).toBe(401);
  });

  it('returns 403 when the user has no tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ user: { ...mockUser, tenantId: null } } as never);
    const response = await getTodaySales(req('/api/mobile/v1/dashboard/today-sales'));
    expect(response.status).toBe(403);
  });
});

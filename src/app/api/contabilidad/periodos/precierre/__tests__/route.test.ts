import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticateUserMock, findFirstPeriodoMock, prismaMock } = vi.hoisted(() => ({
  authenticateUserMock: vi.fn(),
  findFirstPeriodoMock: vi.fn(),
  prismaMock: {
    periodoContable: { findFirst: vi.fn() },
    venta: { aggregate: vi.fn().mockResolvedValue({ _sum: { total: 1000 }, _count: { ventaId: 2 } }) },
    ventaServicios: { aggregate: vi.fn().mockResolvedValue({ _sum: { total: 500 }, _count: { ventaServicioId: 1 } }) },
    gastosDE: { aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 300 }, _count: { gastosDEId: 1 } }) },
    gastoCompra: { aggregate: vi.fn().mockResolvedValue({ _sum: { total: 100 }, _count: { gastoCompraId: 1 } }) },
    pagosalario: { aggregate: vi.fn().mockResolvedValue({ _sum: { salario: 200, bonificaciones: 50, deducciones: 30 }, _count: { pgId: 1 } }) },
    reconciliacionVenta: { aggregate: vi.fn().mockResolvedValue({ _sum: { montoConvertido: 800 } }) },
    reconciliacionServicio: { aggregate: vi.fn().mockResolvedValue({ _sum: { montoConvertido: 200 } }) },
    reconciliacionGasto: { aggregate: vi.fn().mockResolvedValue({ _sum: { montoConvertido: 400 } }) },
    cuentaBancaria: { findMany: vi.fn().mockResolvedValue([{ saldo: 5000, tipoCuenta: 'caja' }, { saldo: 10000, tipoCuenta: 'banco' }]) },
    cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([{ montoDeuda: 1000, montoPagado: 500 }]) },
    cuentaPorPagar: { findMany: vi.fn().mockResolvedValue([{ saldoPendiente: 200 }]) },
    producto: { findMany: vi.fn().mockResolvedValue([{ stock: 10, precioCosto: 100 }]) },
    inyeccionCapital: { findMany: vi.fn().mockResolvedValue([{ montoRecibido: 50000 }]) },
  },
}));

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: authenticateUserMock }));
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

describe('API /contabilidad/periodos/precierre GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateUserMock.mockResolvedValue({ user: { userId: 'user-1' } });
    prismaMock.periodoContable.findFirst.mockResolvedValue({ periodoId: 'p-1', codigo: 'D-2026-04-23', tipo: 'DIARIO', estado: 'ABIERTO' });
  });

  it('calcula precierre y devuelve resumen con 200', async () => {
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/periodos/precierre?fecha=2026-04-23');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalVentas).toBe(1000);
    expect(data.totalIngresos).toBe(1500);
    expect(data.totalGastos).toBe(620);
    expect(data.diferencia).toBe(880);
    expect(data.saldoCajaFinal).toBe(5000);
    expect(data.saldoBancoFinal).toBe(10000);
    expect(data.puedeCerrar).toBe(true);
  });

  it('devuelve 400 si fecha inválida', async () => {
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/periodos/precierre?fecha=invalid');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('usa fecha actual si no se provee parámetro', async () => {
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/api/contabilidad/periodos/precierre');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('devuelve 503 si modelo no disponible', async () => {
    const { GET } = await import('../route');
    const orig = prismaMock.periodoContable;
    (prismaMock as unknown as Record<string, unknown>).periodoContable = undefined;

    const request = new NextRequest('http://localhost/api/contabilidad/periodos/precierre');
    const response = await GET(request);
    expect(response.status).toBe(503);

    prismaMock.periodoContable = orig;
  });
});
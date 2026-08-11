import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findMany: vi.fn() },
    venta: { findMany: vi.fn() },
    ventaServicios: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn(), count: vi.fn() },
    reconciliacionServicio: { count: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getResumenFinancieroAction } from '@/features/contabilidad/actions';
import { endOfDay } from '@/lib/date-range';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const tenantId = 'tenant-a';
const foreignTenantId = 'tenant-b';

const user: AuthenticatedUser = {
  userId: 'user-a',
  name: 'Tenant A',
  email: 'tenant-a@example.com',
  role: 'user',
  isActive: true,
  tenantId,
  tenantRole: 'manager',
  planFeatures: {
    contabilidad: true,
    'prestamos-cash': true,
    'deudas-cash': true,
  },
};

function scopedOrForeign<T>(tenantValue: T, foreignValue: T) {
  return vi.fn(({ where }: { where: Record<string, any> }) =>
    where.tenantId === tenantId || where.cuentaBancaria?.tenantId === tenantId
      ? [tenantValue]
      : [foreignValue],
  );
}

describe('getResumenFinancieroAction - aislamiento por tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    vi.mocked(prisma.cuentaBancaria.findMany).mockImplementation(
      scopedOrForeign(
        { cuentaId: 'account-a', moneda: 'CUP', saldo: 100 },
        { cuentaId: 'account-b', moneda: 'CUP', saldo: 9000 },
      ),
    );
    vi.mocked(prisma.venta.findMany).mockImplementation(
      scopedOrForeign({ total: 10 }, { total: 9000 }),
    );
    vi.mocked(prisma.ventaServicios.findMany).mockImplementation(
      scopedOrForeign({ total: 20 }, { total: 8000 }),
    );
    vi.mocked(prisma.reconciliacionGasto.findMany).mockImplementation(
      scopedOrForeign(
        { monto: 1, moneda: 'CUP', tipoGasto: 'gasto' },
        { monto: 7000, moneda: 'CUP', tipoGasto: 'gasto' },
      ),
    );
    vi.mocked(prisma.transferenciaBancaria.findMany).mockImplementation(
      scopedOrForeign(
        { montoOrigen: 2, monedaOrigen: 'CUP', montoDestino: 2, monedaDestino: 'CUP' },
        { montoOrigen: 6000, monedaOrigen: 'CUP', montoDestino: 6000, monedaDestino: 'CUP' },
      ),
    );
    vi.mocked(prisma.ajusteBancario.findMany).mockImplementation(
      scopedOrForeign(
        { tipo: 'egreso', monto: 3, moneda: 'CUP' },
        { tipo: 'egreso', monto: 5000, moneda: 'CUP' },
      ),
    );
    vi.mocked(prisma.inyeccionCapital.findMany).mockImplementation(
      scopedOrForeign(
        { montoRecibido: 4, moneda: 'CUP' },
        { montoRecibido: 4000, moneda: 'CUP' },
      ),
    );
    vi.mocked(prisma.pagoDeuda.findMany).mockImplementation(
      scopedOrForeign(
        { montoPagado: 5, cuentaBancaria: { moneda: 'CUP' } },
        { montoPagado: 3000, cuentaBancaria: { moneda: 'CUP' } },
      ),
    );
    vi.mocked(prisma.reconciliacionVenta.findMany).mockImplementation(
      scopedOrForeign(
        { monto: 6, moneda: 'CUP', cuentaBancaria: { moneda: 'CUP' } },
        { monto: 2000, moneda: 'CUP', cuentaBancaria: { moneda: 'CUP' } },
      ),
    );
    vi.mocked(prisma.reconciliacionVenta.count).mockImplementation(
      ({ where }: { where: Record<string, any> }) =>
        Promise.resolve(where.tenantId === tenantId ? 0 : 1),
    );
    vi.mocked(prisma.reconciliacionServicio.count).mockImplementation(
      ({ where }: { where: Record<string, any> }) =>
        Promise.resolve(where.tenantId === tenantId ? 0 : 1),
    );
  });

  it('no consulta ni agrega filas del tenant B para el tenant A', async () => {
    const result = await getResumenFinancieroAction({});

    expect(result.success).toBe(true);
    expect(result.data?.cuentasBancarias).toEqual([
      expect.objectContaining({ cuentaId: 'account-a' }),
    ]);
    expect(result.data?.cuentasBancarias).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cuentaId: 'account-b' })]),
    );
    expect(result.data?.resumenPorMoneda[0].saldoActual).toBe(100);
    expect(result.data?.resumenPorMoneda[0].totalIngresos).toBeLessThan(100);
    expect(result.data?.resumenPorMoneda[0].totalEgresos).toBeLessThan(100);
  });

  it('incluye tenantId del usuario en todas las queries y scopea relaciones sin tenantId directo', async () => {
    await getResumenFinancieroAction({});

    const directQueries = [
      prisma.cuentaBancaria.findMany,
      prisma.venta.findMany,
      prisma.ventaServicios.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.transferenciaBancaria.findMany,
      prisma.ajusteBancario.findMany,
      prisma.reconciliacionVenta.findMany,
      prisma.reconciliacionVenta.count,
      prisma.reconciliacionServicio.count,
    ];

    for (const query of directQueries) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({ tenantId }));
      }
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cuentaBancaria: { tenantId } }),
        }),
      );
    }
  });

  it('no permite que cuentaId consulte una cuenta de otro tenant', async () => {
    const cuentaId = 'account-b';

    await getResumenFinancieroAction({ cuentaId });

    for (const query of [
      prisma.cuentaBancaria.findMany,
      prisma.reconciliacionGasto.findMany,
      prisma.ajusteBancario.findMany,
      prisma.reconciliacionVenta.findMany,
    ]) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(expect.objectContaining({ tenantId }));
      }
    }

    for (const query of [prisma.inyeccionCapital.findMany, prisma.pagoDeuda.findMany]) {
      for (const [args] of query.mock.calls) {
        expect(args.where).toEqual(
          expect.objectContaining({ cuentaBancaria: { tenantId } }),
        );
      }
    }

    expect(prisma.transferenciaBancaria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }],
        }),
      }),
    );
  });

  it('includes the full end date in the financial summary queries', async () => {
    await getResumenFinancieroAction({
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
    });

    expect(prisma.venta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-01-01'), lte: endOfDay('2026-01-31') },
        }),
      }),
    );
  });
});

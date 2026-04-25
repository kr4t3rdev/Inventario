import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  venta: { aggregate: vi.fn() },
  ventaServicios: { aggregate: vi.fn() },
  gastosDE: { aggregate: vi.fn() },
  gastoCompra: { aggregate: vi.fn() },
  pagosalario: { aggregate: vi.fn() },
  reconciliacionVenta: { aggregate: vi.fn() },
  reconciliacionServicio: { aggregate: vi.fn() },
  reconciliacionGasto: { aggregate: vi.fn() },
  cuentaBancaria: { findMany: vi.fn() },
  cuentaPorCobrar: { findMany: vi.fn() },
  cuentaPorPagar: { findMany: vi.fn() },
  producto: { findMany: vi.fn() },
  inyeccionCapital: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

import {
  CierreDiarioPersistenceUnavailableError,
  DailyPeriodNotFoundError,
  isCierreDiarioPersistenceUnavailableError,
  isDailyPeriodNotFoundError,
  persistDailyClose,
} from '@/lib/services/cierre-diario-persistence-service';

function mockDailyAggregates() {
  prismaMock.venta.aggregate.mockResolvedValue({
    _sum: { total: 1000 },
    _count: { ventaId: 2 },
  });
  prismaMock.ventaServicios.aggregate.mockResolvedValue({
    _sum: { total: 200 },
    _count: { ventaServicioId: 1 },
  });
  prismaMock.gastosDE.aggregate.mockResolvedValue({
    _sum: { monto: 150 },
    _count: { gastosDEId: 1 },
  });
  prismaMock.gastoCompra.aggregate.mockResolvedValue({
    _sum: { total: 100 },
    _count: { gastoCompraId: 1 },
  });
  prismaMock.pagosalario.aggregate.mockResolvedValue({
    _sum: { salario: 300, bonificaciones: 50, deducciones: 20 },
    _count: { pgId: 1 },
  });
  prismaMock.reconciliacionVenta.aggregate.mockResolvedValue({
    _sum: { montoConvertido: 700 },
  });
  prismaMock.reconciliacionServicio.aggregate.mockResolvedValue({
    _sum: { montoConvertido: 100 },
  });
  prismaMock.reconciliacionGasto.aggregate.mockResolvedValue({
    _sum: { montoConvertido: 250 },
  });
  prismaMock.cuentaBancaria.findMany.mockResolvedValue([
    { saldo: 80, tipoCuenta: 'caja_principal' },
    { saldo: 420, tipoCuenta: 'banco_operativo' },
  ]);
  prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
    { montoDeuda: 200, montoPagado: 25 },
  ]);
  prismaMock.cuentaPorPagar.findMany.mockResolvedValue([
    { saldoPendiente: 70 },
  ]);
  prismaMock.producto.findMany.mockResolvedValue([
    { stock: 5, precioCosto: 30 },
  ]);
  prismaMock.inyeccionCapital.findMany.mockResolvedValue([
    { montoRecibido: 1000 },
  ]);
}

describe('cierre-diario-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDailyAggregates();
  });

  it('persiste snapshot diario y cierra el período', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue({
          periodoId: 'periodo-1',
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          fechaInicio: new Date(),
          fechaFin: new Date(),
          estado: 'ABIERTO',
        }),
        update: vi.fn().mockResolvedValue({
          periodoId: 'periodo-1',
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          fechaInicio: new Date(),
          fechaFin: new Date(),
          estado: 'CERRADO',
        }),
      },
      snapshotPeriodo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          snapshotId: 'snapshot-1',
          periodoId: 'periodo-1',
          version: 1,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistDailyClose({
      fecha: new Date('2026-04-23T10:00:00.000Z'),
      usuarioId: 'user-1',
    });

    expect(result.wasCreated).toBe(true);
    expect(result.resumen.totalIngresos).toBe(1200);
    expect(result.resumen.totalGastos).toBe(580);
    expect(result.resumen.diferencia).toBe(620);
    expect(tx.snapshotPeriodo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodoId: 'periodo-1',
          version: 1,
        }),
      })
    );
    expect(tx.periodoContable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodoId: 'periodo-1' },
        data: expect.objectContaining({
          estado: 'CERRADO',
          cerradoPorId: 'user-1',
        }),
      })
    );
  });

  it('es idempotente si ya existe snapshot para el período', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue({
          periodoId: 'periodo-1',
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          fechaInicio: new Date(),
          fechaFin: new Date(),
          estado: 'CERRADO',
        }),
        update: vi.fn(),
      },
      snapshotPeriodo: {
        findFirst: vi.fn().mockResolvedValue({
          snapshotId: 'snapshot-existing',
          periodoId: 'periodo-1',
          version: 1,
        }),
        create: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistDailyClose({
      fecha: new Date('2026-04-23T10:00:00.000Z'),
      usuarioId: 'user-1',
    });

    expect(result.wasCreated).toBe(false);
    expect(tx.snapshotPeriodo.create).not.toHaveBeenCalled();
    expect(tx.periodoContable.update).not.toHaveBeenCalled();
  });

  it('falla si no existe un período diario para la fecha', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      snapshotPeriodo: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    await expect(
      persistDailyClose({
        fecha: new Date('2026-04-23T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(DailyPeriodNotFoundError);
  });

  it('falla con error tipado si el runtime no expone modelos nuevos', async () => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({})
    );

    await expect(
      persistDailyClose({
        fecha: new Date('2026-04-23T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(CierreDiarioPersistenceUnavailableError);
  });

  it('expone helpers de type guard para errores tipados', () => {
    expect(
      isCierreDiarioPersistenceUnavailableError(
        new CierreDiarioPersistenceUnavailableError()
      )
    ).toBe(true);
    expect(isDailyPeriodNotFoundError(new DailyPeriodNotFoundError('D-2026-04-23'))).toBe(
      true
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

import {
  CierreMensualPersistenceUnavailableError,
  isCierreMensualPersistenceUnavailableError,
  isMonthlyPeriodDependencyError,
  isMonthlyPeriodNotFoundError,
  MonthlyPeriodDependencyError,
  MonthlyPeriodNotFoundError,
  persistMonthlyClose,
} from '@/lib/services/cierre-mensual-persistence-service';

describe('cierre-mensual-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consolida diarios cerrados y persiste snapshot mensual', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            periodoId: 'mes-1',
            codigo: 'M-2026-04',
            tipo: 'MENSUAL',
            fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
            fechaFin: new Date('2026-04-30T23:59:59.999Z'),
            estado: 'ABIERTO',
          }),
        findMany: vi.fn().mockResolvedValue([
          {
            periodoId: 'dia-1',
            codigo: 'D-2026-04-01',
            tipo: 'DIARIO',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            estado: 'CERRADO',
            snapshots: [
              {
                snapshotId: 'snap-dia-1',
                periodoId: 'dia-1',
                version: 1,
                resumenJson: {
                  fecha: '2026-04-01',
                  totalVentas: 100,
                  totalServicios: 20,
                  totalIngresos: 120,
                  totalGastosDE: 10,
                  totalGastosCompra: 5,
                  totalGastosSalarios: 15,
                  totalGastos: 30,
                  diferencia: 90,
                  ingresosCaja: 80,
                  egresosCaja: 20,
                  saldoCajaFinal: 50,
                  saldoBancoFinal: 200,
                  saldoCuentasCobrarFinal: 30,
                  saldoCuentasPagarFinal: 10,
                  saldoInventarioFinal: 500,
                  saldoCapitalFinal: 1000,
                  saldoResultadoAcumFinal: 90,
                },
              },
            ],
          },
          {
            periodoId: 'dia-2',
            codigo: 'D-2026-04-02',
            tipo: 'DIARIO',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            estado: 'APROBADO',
            snapshots: [
              {
                snapshotId: 'snap-dia-2',
                periodoId: 'dia-2',
                version: 1,
                resumenJson: {
                  fecha: '2026-04-02',
                  totalVentas: 200,
                  totalServicios: 40,
                  totalIngresos: 240,
                  totalGastosDE: 20,
                  totalGastosCompra: 10,
                  totalGastosSalarios: 30,
                  totalGastos: 60,
                  diferencia: 180,
                  ingresosCaja: 150,
                  egresosCaja: 30,
                  saldoCajaFinal: 70,
                  saldoBancoFinal: 250,
                  saldoCuentasCobrarFinal: 40,
                  saldoCuentasPagarFinal: 15,
                  saldoInventarioFinal: 450,
                  saldoCapitalFinal: 1000,
                  saldoResultadoAcumFinal: 180,
                },
              },
            ],
          },
        ]),
        update: vi.fn().mockResolvedValue({
          periodoId: 'mes-1',
          codigo: 'M-2026-04',
          tipo: 'MENSUAL',
          fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
          fechaFin: new Date('2026-04-30T23:59:59.999Z'),
          estado: 'CERRADO',
        }),
      },
      snapshotPeriodo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          snapshotId: 'snap-mes-1',
          periodoId: 'mes-1',
          version: 1,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistMonthlyClose({
      fecha: new Date('2026-04-10T10:00:00.000Z'),
      usuarioId: 'user-1',
    });

    expect(result.wasCreated).toBe(true);
    expect(result.resumen.diariosConsolidados).toBe(2);
    expect(result.resumen.totalIngresos).toBe(360);
    expect(result.resumen.totalGastos).toBe(90);
    expect(result.resumen.diferencia).toBe(270);
    expect(tx.snapshotPeriodo.create).toHaveBeenCalled();
    expect(tx.periodoContable.update).toHaveBeenCalled();
  });

  it('bloquea el cierre mensual si hay diarios abiertos o sin snapshot', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue({
          periodoId: 'mes-1',
          codigo: 'M-2026-04',
          tipo: 'MENSUAL',
          fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
          fechaFin: new Date('2026-04-30T23:59:59.999Z'),
          estado: 'ABIERTO',
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            periodoId: 'dia-1',
            codigo: 'D-2026-04-01',
            tipo: 'DIARIO',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            estado: 'ABIERTO',
            snapshots: [],
          },
        ]),
        update: vi.fn(),
      },
      snapshotPeriodo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    await expect(
      persistMonthlyClose({
        fecha: new Date('2026-04-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(MonthlyPeriodDependencyError);
  });

  it('falla si no existe período mensual para la fecha', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
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
      persistMonthlyClose({
        fecha: new Date('2026-04-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(MonthlyPeriodNotFoundError);
  });

  it('falla con error tipado si el runtime no expone modelos nuevos', async () => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({})
    );

    await expect(
      persistMonthlyClose({
        fecha: new Date('2026-04-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(CierreMensualPersistenceUnavailableError);
  });

  it('expone helpers de type guard para errores tipados', () => {
    expect(
      isCierreMensualPersistenceUnavailableError(
        new CierreMensualPersistenceUnavailableError()
      )
    ).toBe(true);
    expect(isMonthlyPeriodNotFoundError(new MonthlyPeriodNotFoundError('M-2026-04'))).toBe(
      true
    );
    expect(
      isMonthlyPeriodDependencyError(new MonthlyPeriodDependencyError(['D-2026-04-01']))
    ).toBe(true);
  });
});

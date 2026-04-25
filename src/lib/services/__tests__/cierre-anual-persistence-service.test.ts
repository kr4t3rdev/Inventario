import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

import {
  AnnualPeriodDependencyError,
  AnnualPeriodNotFoundError,
  CierreAnualPersistenceUnavailableError,
  isAnnualPeriodDependencyError,
  isAnnualPeriodNotFoundError,
  isCierreAnualPersistenceUnavailableError,
  persistAnnualClose,
} from '@/lib/services/cierre-anual-persistence-service';

describe('cierre-anual-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consolida meses cerrados y persiste snapshot anual', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            periodoId: 'anio-1',
            codigo: 'A-2026',
            tipo: 'ANUAL',
            fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
            fechaFin: new Date('2026-12-31T23:59:59.999Z'),
            estado: 'ABIERTO',
          }),
        findMany: vi.fn().mockResolvedValue([
          {
            periodoId: 'mes-1',
            codigo: 'M-2026-01',
            tipo: 'MENSUAL',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            estado: 'CERRADO',
            snapshots: [
              {
                snapshotId: 'snap-mes-1',
                periodoId: 'mes-1',
                version: 1,
                resumenJson: {
                  periodo: 'M-2026-01',
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
            periodoId: 'mes-2',
            codigo: 'M-2026-02',
            tipo: 'MENSUAL',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            estado: 'APROBADO',
            snapshots: [
              {
                snapshotId: 'snap-mes-2',
                periodoId: 'mes-2',
                version: 1,
                resumenJson: {
                  periodo: 'M-2026-02',
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
          periodoId: 'anio-1',
          codigo: 'A-2026',
          tipo: 'ANUAL',
          fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-31T23:59:59.999Z'),
          estado: 'CERRADO',
        }),
      },
      snapshotPeriodo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          snapshotId: 'snap-anio-1',
          periodoId: 'anio-1',
          version: 1,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistAnnualClose({
      fecha: new Date('2026-06-10T10:00:00.000Z'),
      usuarioId: 'user-1',
    });

    expect(result.wasCreated).toBe(true);
    expect(result.resumen.mesesConsolidados).toBe(2);
    expect(result.resumen.totalIngresos).toBe(360);
    expect(result.resumen.totalGastos).toBe(90);
    expect(result.resumen.diferencia).toBe(270);
    expect(tx.snapshotPeriodo.create).toHaveBeenCalled();
    expect(tx.periodoContable.update).toHaveBeenCalled();
  });

  it('bloquea el cierre anual si hay meses abiertos o sin snapshot', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue({
          periodoId: 'anio-1',
          codigo: 'A-2026',
          tipo: 'ANUAL',
          fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-31T23:59:59.999Z'),
          estado: 'ABIERTO',
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            periodoId: 'mes-1',
            codigo: 'M-2026-01',
            tipo: 'MENSUAL',
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
      persistAnnualClose({
        fecha: new Date('2026-06-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(AnnualPeriodDependencyError);
  });

  it('falla si no existe período anual para la fecha', async () => {
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
      persistAnnualClose({
        fecha: new Date('2026-06-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(AnnualPeriodNotFoundError);
  });

  it('falla con error tipado si el runtime no expone modelos nuevos', async () => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({})
    );

    await expect(
      persistAnnualClose({
        fecha: new Date('2026-06-10T10:00:00.000Z'),
        usuarioId: 'user-1',
      })
    ).rejects.toThrow(CierreAnualPersistenceUnavailableError);
  });

  it('expone helpers de type guard para errores tipados', () => {
    expect(
      isCierreAnualPersistenceUnavailableError(
        new CierreAnualPersistenceUnavailableError()
      )
    ).toBe(true);
    expect(isAnnualPeriodNotFoundError(new AnnualPeriodNotFoundError('A-2026'))).toBe(
      true
    );
    expect(
      isAnnualPeriodDependencyError(new AnnualPeriodDependencyError(['M-2026-01']))
    ).toBe(true);
  });
});

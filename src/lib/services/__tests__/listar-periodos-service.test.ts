import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  periodoContable: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

import {
  ListadoPeriodosPersistenceUnavailableError,
  isListadoPeriodosPersistenceUnavailableError,
  listPeriodos,
} from '@/lib/services/listar-periodos-service';

describe('listar-periodos-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista períodos con filtros y resume relaciones', async () => {
    prismaMock.periodoContable.findMany.mockResolvedValue([
      {
        periodoId: 'mes-1',
        codigo: 'M-2026-04',
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
        fechaFin: new Date('2026-04-30T23:59:59.999Z'),
        periodoPadreId: 'anio-1',
        fechaApertura: new Date('2026-04-01T00:00:00.000Z'),
        fechaCierre: null,
        fechaAprobacion: null,
        fechaReapertura: null,
        apertura: {
          aperturaId: 'ap-1',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
        snapshots: [],
        subperiodos: [
          { periodoId: 'dia-1', codigo: 'D-2026-04-01', estado: 'CERRADO' },
          { periodoId: 'dia-2', codigo: 'D-2026-04-02', estado: 'ABIERTO' },
        ],
      },
    ]);

    const result = await listPeriodos({
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaDesde: new Date('2026-04-01T00:00:00.000Z'),
      fechaHasta: new Date('2026-04-30T23:59:59.999Z'),
    });

    expect(prismaMock.periodoContable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          fechaInicio: { gte: new Date('2026-04-01T00:00:00.000Z') },
          fechaFin: { lte: new Date('2026-04-30T23:59:59.999Z') },
        }),
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      codigo: 'M-2026-04',
      tieneApertura: true,
      tieneSnapshot: false,
      totalSubperiodos: 2,
      subperiodosCerrados: 1,
    });
    expect(result.items[0].blockers).toContain('Subperíodos abiertos: D-2026-04-02');
  });

  it('reporta snapshot disponible y sin blockers cuando el período está completo', async () => {
    prismaMock.periodoContable.findMany.mockResolvedValue([
      {
        periodoId: 'dia-1',
        codigo: 'D-2026-04-23',
        tipo: 'DIARIO',
        estado: 'CERRADO',
        fechaInicio: new Date('2026-04-23T00:00:00.000Z'),
        fechaFin: new Date('2026-04-23T23:59:59.999Z'),
        periodoPadreId: 'mes-1',
        fechaApertura: new Date('2026-04-23T00:00:00.000Z'),
        fechaCierre: new Date('2026-04-23T23:59:59.999Z'),
        fechaAprobacion: null,
        fechaReapertura: null,
        apertura: {
          aperturaId: 'ap-1',
          createdAt: new Date('2026-04-23T00:00:00.000Z'),
        },
        snapshots: [{ snapshotId: 'snap-1', version: 1, createdAt: new Date() }],
        subperiodos: [],
      },
    ]);

    const result = await listPeriodos({ tipo: 'DIARIO' });

    expect(result.items[0]).toMatchObject({
      codigo: 'D-2026-04-23',
      tieneSnapshot: true,
      versionSnapshotActual: 1,
      blockers: [],
    });
  });

  it('falla con error tipado si el runtime Prisma no expone periodoContable', async () => {
    const original = prismaMock.periodoContable;
    // @ts-expect-error test runtime fallback
    prismaMock.periodoContable = undefined;

    await expect(listPeriodos({})).rejects.toThrow(
      ListadoPeriodosPersistenceUnavailableError
    );

    prismaMock.periodoContable = original;
  });

  it('expone type guard para error tipado', () => {
    expect(
      isListadoPeriodosPersistenceUnavailableError(
        new ListadoPeriodosPersistenceUnavailableError()
      )
    ).toBe(true);
  });
});

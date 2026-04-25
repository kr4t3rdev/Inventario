import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const auditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: auditLogMock,
  },
}));

import {
  isPeriodoPersistenceUnavailableError,
  persistOpeningPeriod,
  PeriodoPersistenceUnavailableError,
} from '@/lib/services/apertura-periodo-persistence-service';

describe('apertura-periodo-persistence-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogMock.mockResolvedValue(undefined);
  });

  it('persiste período y apertura cuando no existe el código', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          periodoId: 'periodo-1',
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          fechaInicio: new Date('2026-04-23T00:00:00.000Z'),
          fechaFin: new Date('2026-04-23T23:59:59.999Z'),
          estado: 'ABIERTO',
        }),
      },
      aperturaPeriodo: {
        create: vi.fn().mockResolvedValue({
          aperturaId: 'apertura-1',
          periodoId: 'periodo-1',
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistOpeningPeriod({
      tipoPeriodo: 'DIARIO',
      referencia: new Date('2026-04-23T10:00:00.000Z'),
      usuarioId: 'user-1',
      previousPeriod: {
        periodoId: 'periodo-previo',
        codigo: 'D-2026-04-22',
        resumen: {
          saldoCajaFinal: 150,
          saldoBancoFinal: 400,
        },
      },
      observaciones: 'Apertura automática',
    });

    expect(result.wasCreated).toBe(true);
    expect(tx.periodoContable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          observaciones: 'Apertura automática',
        }),
      })
    );
    expect(tx.aperturaPeriodo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodoId: 'periodo-1',
          origenPeriodoId: 'periodo-previo',
          saldoCajaInicial: 150,
          saldoBancoInicial: 400,
        }),
      })
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'PERIODO_CONTABLE',
        entidadId: 'periodo-1',
        usuarioId: 'user-1',
      })
    );
  });

  it('es idempotente si el período ya existe', async () => {
    const tx = {
      periodoContable: {
        findFirst: vi.fn().mockResolvedValue({
          periodoId: 'periodo-ya-existente',
          codigo: 'D-2026-04-23',
          tipo: 'DIARIO',
          fechaInicio: new Date('2026-04-23T00:00:00.000Z'),
          fechaFin: new Date('2026-04-23T23:59:59.999Z'),
          estado: 'ABIERTO',
        }),
        create: vi.fn(),
      },
      aperturaPeriodo: {
        create: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx)
    );

    const result = await persistOpeningPeriod({
      tipoPeriodo: 'DIARIO',
      referencia: new Date('2026-04-23T10:00:00.000Z'),
      usuarioId: 'user-2',
    });

    expect(result.wasCreated).toBe(false);
    expect(tx.periodoContable.create).not.toHaveBeenCalled();
    expect(tx.aperturaPeriodo.create).not.toHaveBeenCalled();
  });

  it('falla con error tipado si el runtime prisma no expone los modelos nuevos', async () => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({})
    );

    await expect(
      persistOpeningPeriod({
        tipoPeriodo: 'DIARIO',
        referencia: new Date('2026-04-23T10:00:00.000Z'),
        usuarioId: 'user-3',
      })
    ).rejects.toThrow(PeriodoPersistenceUnavailableError);
  });

  it('detecta el error tipado de persistencia no disponible', () => {
    const error = new PeriodoPersistenceUnavailableError();

    expect(isPeriodoPersistenceUnavailableError(error)).toBe(true);
  });
});

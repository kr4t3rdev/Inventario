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
  assertOperationAllowed,
  isPeriodoOperacionError,
  PeriodoOperacionError,
  resolveOperationDate,
  serializePeriodoOperacionError,
} from '@/lib/services/periodo-operacion-guard';

import { ESTADO_PERIODO, TIPO_PERIODO } from '@/lib/services/periodo-contable-service';

describe('periodo-operacion-guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite operar si no hay períodos configurados', async () => {
    prismaMock.periodoContable.findMany.mockResolvedValue([]);

    await expect(
      assertOperationAllowed(new Date('2026-04-23T10:00:00.000Z'))
    ).resolves.toBeUndefined();
  });

  it('permite operar cuando todos los períodos aplicables están abiertos', async () => {
    prismaMock.periodoContable.findMany.mockResolvedValue([
      {
        periodoId: 'd-1',
        codigo: 'D-2026-04-23',
        tipo: TIPO_PERIODO.DIARIO,
        estado: ESTADO_PERIODO.ABIERTO,
      },
      {
        periodoId: 'm-1',
        codigo: 'M-2026-04',
        tipo: TIPO_PERIODO.MENSUAL,
        estado: ESTADO_PERIODO.REABIERTO,
      },
    ]);

    await expect(
      assertOperationAllowed(new Date('2026-04-23T10:00:00.000Z'), 'VENTA')
    ).resolves.toBeUndefined();
  });

  it('bloquea la operación cuando encuentra un período cerrado', async () => {
    prismaMock.periodoContable.findMany.mockResolvedValue([
      {
        periodoId: 'm-1',
        codigo: 'M-2026-04',
        tipo: TIPO_PERIODO.MENSUAL,
        estado: ESTADO_PERIODO.CERRADO,
      },
    ]);

    await expect(
      assertOperationAllowed(
        new Date('2026-04-23T10:00:00.000Z'),
        'RECONCILIACION_VENTA'
      )
    ).rejects.toThrow(
      'La operación RECONCILIACION_VENTA está bloqueada por período contable'
    );
  });

  it('resuelve fechas inválidas al momento actual sin romper el flujo', () => {
    const result = resolveOperationDate('fecha-invalida');

    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it('serializa errores del guard de forma consistente', () => {
    const error = new PeriodoOperacionError('Periodo bloqueado');

    expect(isPeriodoOperacionError(error)).toBe(true);
    expect(serializePeriodoOperacionError(error)).toEqual({
      error: 'Periodo bloqueado',
      code: 'PERIODO_BLOQUEADO',
    });
  });
});

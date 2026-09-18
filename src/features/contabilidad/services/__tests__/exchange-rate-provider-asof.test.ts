import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tasaCambio: { findFirst: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { exchangeRateProvider } from '../exchange-rate-provider';

describe('exchangeRateProvider.getRateAsOf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(exchangeRateProvider as never, 'ensureDefaultCurrencies').mockResolvedValue(
      undefined as never,
    );
  });

  it('selecciona la tasa vigente más reciente sin exceder el límite', async () => {
    prismaMock.tasaCambio.findFirst.mockResolvedValue({
      tasaId: 'tasa-7',
      tasa: 24.5,
      fechaVigencia: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await exchangeRateProvider.getRateAsOf({
      sourceCurrency: 'usd',
      targetCurrency: 'CUP',
      boundaryAt: new Date('2026-03-15T12:00:00.000Z'),
    });

    expect(result).toMatchObject({ tasaId: 'tasa-7', tasa: 24.5 });
    expect(prismaMock.tasaCambio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          monedaOrigenId: 'USD',
          monedaDestino: 'CUP',
          fechaVigencia: { lte: new Date('2026-03-15T12:00:00.000Z') },
        },
        orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }, { tasaId: 'desc' }],
        take: 1,
      }),
    );
  });

  it('devuelve null sin candidato elegible o monedas inválidas', async () => {
    prismaMock.tasaCambio.findFirst.mockResolvedValue(null);
    expect(
      await exchangeRateProvider.getRateAsOf({
        sourceCurrency: 'USD',
        targetCurrency: 'CUP',
        boundaryAt: new Date('2026-03-15T12:00:00.000Z'),
      }),
    ).toBeNull();
    expect(prismaMock.tasaCambio.findFirst).toHaveBeenCalledTimes(1);

    expect(
      await exchangeRateProvider.getRateAsOf({
        sourceCurrency: '   ',
        targetCurrency: 'CUP',
        boundaryAt: new Date('2026-03-15T12:00:00.000Z'),
      }),
    ).toBeNull();
  });
});

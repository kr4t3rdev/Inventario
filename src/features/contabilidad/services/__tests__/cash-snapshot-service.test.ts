import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  cuentaPorCobrar: { findMany: vi.fn() },
  cuentaPorPagar: { findMany: vi.fn() },
  cashSnapshot: { createMany: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { CashSnapshotService } from '../cash-snapshot-service';
import type { Prisma } from '@/generated/prisma';

const tenantId = 'tenant-a';

function makeClient(): Prisma.TransactionClient {
  return mockPrisma as unknown as Prisma.TransactionClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.cuentaPorCobrar.findMany.mockResolvedValue([
    {
      id: 'cxc-1',
      montoDeudaFuncional: '100.00',
      montoPagadoFuncional: '25.00',
      monedaFuncional: 'CUP',
      tasaCambio: null,
      rateEffectiveAt: null,
      fxEvidenceFingerprint: null,
      prestamoCash: { id: 'loan-1' },
    },
  ]);
  mockPrisma.cuentaPorPagar.findMany.mockResolvedValue([]);
  mockPrisma.cashSnapshot.createMany.mockResolvedValue({ count: 1 });
});

describe('CashSnapshotService.capturar', () => {
  it('reutiliza el cliente transaccional del cierre sin abrir una transacción anidada', async () => {
    const result = await CashSnapshotService.capturar({
      tenantId,
      fechaCorte: new Date('2026-10-07T14:00:00.000Z'),
      periodoId: 'period-1',
      motivo: 'CIERRE_PERIODO',
      client: makeClient(),
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.cashSnapshot.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        tenantId,
        periodoId: 'period-1',
        motivo: 'CIERRE_PERIODO',
        fechaCorte: new Date('2026-10-07T00:00:00.000Z'),
        saldoFuncional: expect.objectContaining({ d: expect.any(Array) }),
      })],
      skipDuplicates: true,
    });
    expect(result).toMatchObject({ creados: 1, existentes: 0, omitidos: 0 });
  });

  it('abre una transacción serializable cuando no recibe cliente', async () => {
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(makeClient()));

    await CashSnapshotService.capturar({ tenantId });

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('reintenta una colisión serializable aislada y vuelve a contar existentes', async () => {
    mockPrisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(makeClient()));
    mockPrisma.cashSnapshot.createMany.mockResolvedValue({ count: 0 });

    const result = await CashSnapshotService.capturar({ tenantId });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ creados: 0, existentes: 1, omitidos: 0 });
  });

  it('no reintenta una colisión dentro de una transacción del caller', async () => {
    mockPrisma.cashSnapshot.createMany.mockRejectedValue({ code: 'P2034' });

    await expect(CashSnapshotService.capturar({ tenantId, client: makeClient() }))
      .rejects.toMatchObject({ code: 'P2034' });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.cashSnapshot.createMany).toHaveBeenCalledTimes(1);
  });

  it('no reintenta errores no transitorios', async () => {
    const error = new Error('database unavailable');
    mockPrisma.$transaction.mockRejectedValue(error);

    await expect(CashSnapshotService.capturar({ tenantId })).rejects.toBe(error);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

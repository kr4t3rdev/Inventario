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
});

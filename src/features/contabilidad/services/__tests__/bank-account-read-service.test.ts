import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findFirst },
    reconciliacionVenta: { findMany },
    reconciliacionServicio: { findMany: vi.fn().mockResolvedValue([]) },
    reconciliacionGasto: { findMany: vi.fn().mockResolvedValue([]) },
    ajusteBancario: { findMany: vi.fn().mockResolvedValue([]) },
    transferenciaBancaria: { findMany: vi.fn().mockResolvedValue([]) },
    inyeccionCapital: { findMany: vi.fn().mockResolvedValue([]) },
    pagoDeuda: { findMany: vi.fn().mockResolvedValue([]) },
    gastoCompra: { findMany: vi.fn().mockResolvedValue([]) },
    salario: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { BankAccountReadService } from '../bank-account-read-service';

describe('BankAccountReadService.getHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue({ cuentaId: 'cuenta-1', saldo: 0, moneda: 'CUP' });
    findMany.mockResolvedValue([]);
  });

  it('filtra el historial con límites zonalizados en la zona contable, no en UTC', async () => {
    await BankAccountReadService.getHistory({
      tenantId: 'tenant-1',
      cuentaId: 'cuenta-1',
      fechaInicio: '2026-01-15',
      fechaFin: '2026-01-31',
    });

    // Enero en America/Havana está en hora estándar (UTC-5): las medianoches
    // civiles corresponden a las 05:00Z, no a las 00:00Z.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fechaReconciliacion: {
            gte: new Date('2026-01-15T05:00:00.000Z'),
            lt: new Date('2026-02-01T05:00:00.000Z'),
          },
        }),
      }),
    );
  });
});
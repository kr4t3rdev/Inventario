import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
const update = vi.fn();
const findUnique = vi.fn();
const transaction = vi.fn();
const acquireAccountingTenantLock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique },
    $transaction: transaction,
  },
}));

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
}));

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn() },
}));

vi.mock('../accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock,
}));

describe('AccountingOperationsMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      cuentaId: 'account-1',
      tenantId: 'tenant-1',
      isActive: true,
      saldo: 1000,
      nombreBanco: 'Banco',
    });
    create.mockResolvedValue({ ajusteId: 'adjustment-1' });
    update.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      ajusteBancario: { create },
      cuentaBancaria: { update },
    }));
  });

  it('persiste la fecha de operación elegida para el ajuste', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const fechaOperacion = '2026-01-15T12:00:00.000Z';

    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId: 'account-1',
        tipo: 'egreso',
        monto: 100,
        moneda: 'CUP',
        descripcion: 'Corrección bancaria',
        motivo: 'Diferencia conciliada',
        fechaOperacion,
      },
      user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montoConvertido: 100,
        tasaCambio: 1,
        fechaOperacion: new Date(fechaOperacion),
      }),
    });
  });

  it('pasa dos mutaciones del mismo tenant por el lock contable común', async () => {
    const { AccountingOperationsMutationService } = await import('../accounting-operations-mutation-service');
    const input = {
      cuentaId: 'account-1',
      tipo: 'ingreso' as const,
      monto: 25,
      moneda: 'CUP',
      descripcion: 'Ingreso',
      motivo: 'Prueba de concurrencia',
    };

    await Promise.all([
      AccountingOperationsMutationService.createBankAdjustment({
        input,
        user: { userId: 'user-1', tenantId: 'tenant-1' } as never,
      }),
      AccountingOperationsMutationService.createBankAdjustment({
        input: { ...input, descripcion: 'Segundo ingreso' },
        user: { userId: 'user-2', tenantId: 'tenant-1' } as never,
      }),
    ]);

    expect(acquireAccountingTenantLock).toHaveBeenCalledTimes(2);
    expect(acquireAccountingTenantLock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'tenant-1',
    );
    expect(acquireAccountingTenantLock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'tenant-1',
    );
  });
});

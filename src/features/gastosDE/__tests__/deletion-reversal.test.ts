import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  gastosDE: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn(), deleteMany: vi.fn() },
  cuentaBancaria: { updateMany: vi.fn(), findUnique: vi.fn() },
  cuentaPorPagar: { findUnique: vi.fn(), delete: vi.fn() },
  pagoCuentaPorPagar: { deleteMany: vi.fn() },
  transaccionMoneda: { deleteMany: vi.fn() },
  anticipoMovimiento: { findMany: vi.fn() },
  anticipo: { update: vi.fn(), findUnique: vi.fn() },
  $queryRaw: vi.fn(),
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  gastosDE: { findFirst: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { deleteGastosDEAction } from '@/features/gastosDE/actions';

const user = {
  userId: 'u1', name: 'Test', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'admin',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(user);
  prisma.$transaction.mockImplementation((callback: any) => callback(tx));
  tx.gastosDE.findUnique.mockResolvedValue({
    gastosDEId: 'g-1', tenantId: 'tenant-1', monto: 100, cuentaPorPagar: null,
  });
  tx.gastosDE.updateMany.mockResolvedValue({ count: 1 });
  tx.cuentaBancaria.findUnique.mockResolvedValue({ cuentaId: 'cash-1', tenantId: 'tenant-1', moneda: 'CUP' });
  tx.gastosDE.deleteMany.mockResolvedValue({ count: 1 });
  tx.reconciliacionGasto.findMany.mockResolvedValue([]);
  tx.reconciliacionGasto.deleteMany.mockResolvedValue({ count: 0 });
  tx.transaccionMoneda.deleteMany.mockResolvedValue({ count: 0 });
});

describe('deleteGastosDEAction financial reversal', () => {
  it('restores paid account balance, removes reconciliation and claims deletion atomically', async () => {
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-1', tenantId: 'tenant-1', referenciaId: 'g-1', tipoGasto: 'gastoDE',
      cuentaId: 'cash-1', tipoPagoId: 'cash', monto: 40, moneda: 'CUP', montoConvertido: 40,
      estado: 'PAGADA', cuentaPorPagarId: null,
    }]);
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });

    const result = await deleteGastosDEAction('g-1');

    expect(result.success).toBe(true);
    expect(tx.gastosDE.deleteMany).toHaveBeenCalledWith({
      where: { gastosDEId: 'g-1', tenantId: 'tenant-1' },
    });
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'cash-1', tenantId: 'tenant-1' },
      data: { saldo: { increment: 40 } },
    }));
    expect(tx.reconciliacionGasto.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', tipoGasto: 'gastoDE', referenciaId: 'g-1' },
    });
  });

  it('restores the account-currency debit for FX payments', async () => {
    tx.cuentaBancaria.findUnique.mockResolvedValue({ cuentaId: 'cash-1', tenantId: 'tenant-1', moneda: 'USD' });
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-fx', tenantId: 'tenant-1', referenciaId: 'g-1', tipoGasto: 'gastoDE',
      cuentaId: 'cash-1', tipoPagoId: 'cash', monto: 10, moneda: 'CUP', tasaCambio: 0.5,
      montoConvertido: 10, estado: 'PAGADA', cuentaPorPagarId: null,
    }]);
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });

    await deleteGastosDEAction('g-1');

    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { saldo: { increment: 5 } },
    }));
  });

  it('does not reverse twice when the atomic claim loses a race', async () => {
    tx.gastosDE.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await deleteGastosDEAction('g-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ALREADY_DELETED');
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
    expect(tx.reconciliacionGasto.deleteMany).not.toHaveBeenCalled();
  });

  it('restores CxP and removes payment rows linked to reconciliations', async () => {
    tx.gastosDE.findUnique.mockResolvedValue({
      gastosDEId: 'g-1', tenantId: 'tenant-1', monto: 100,
      cuentaPorPagar: { cuentaPorPagarId: 'cxp-1', montoDeuda: 100, montoPagado: 100, saldoPendiente: 0, estado: 'PAGADA' },
    });
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-1', tenantId: 'tenant-1', referenciaId: 'g-1', tipoGasto: 'gastoDE',
      cuentaId: 'cash-1', tipoPagoId: 'cash', monto: 100, moneda: 'CUP', montoConvertido: 100,
      estado: 'PAGADA', cuentaPorPagarId: 'cxp-1',
    }]);
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });
    tx.cuentaPorPagar.findUnique.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1', tenantId: 'tenant-1', montoDeuda: 100, montoPagado: 100,
      saldoPendiente: 0, estado: 'PAGADA', gastosDEId: 'g-1',
    });

    const result = await deleteGastosDEAction('g-1');

    expect(result.success).toBe(true);
    expect(tx.pagoCuentaPorPagar.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', cuentaPorPagarId: 'cxp-1' },
    }));
    expect(tx.cuentaPorPagar.delete).toHaveBeenCalledWith({ where: { cuentaPorPagarId: 'cxp-1' } });
  });

  it('rejects a CxP owned by another GastosDE source', async () => {
    tx.gastosDE.findUnique.mockResolvedValue({
      gastosDEId: 'g-1', tenantId: 'tenant-1', monto: 100,
      cuentaPorPagar: { cuentaPorPagarId: 'cxp-1' },
    });
    tx.cuentaPorPagar.findUnique.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1', tenantId: 'tenant-1', gastosDEId: 'g-other',
    });

    const result = await deleteGastosDEAction('g-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(tx.cuentaPorPagar.delete).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));

const tx = vi.hoisted(() => ({
  compraServicio: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  reconciliacionGasto: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  cuentaBancaria: { updateMany: vi.fn(), findUnique: vi.fn() },
  cuentaPorPagar: { findUnique: vi.fn(), delete: vi.fn() },
  pagoCuentaPorPagar: { deleteMany: vi.fn() },
  transaccionMoneda: { deleteMany: vi.fn() },
  anticipoMovimiento: { findMany: vi.fn() },
  anticipo: { findUnique: vi.fn(), update: vi.fn() },
  anticipoMovimientoCreate: vi.fn(),
  $queryRaw: vi.fn(),
}));
const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));
vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { deleteCompraServicioAction } from '@/features/compras-servicios/actions';

const user = {
  userId: 'u1', name: 'Test', email: 'test@example.com', role: 'admin', isActive: true,
  tenantId: 'tenant-1', tenantRole: 'manager',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(user);
  prisma.$transaction.mockImplementation((callback: any) => callback(tx));
  tx.compraServicio.findUnique.mockResolvedValue({ compraServicioId: 'cs-1', tenantId: 'tenant-1' });
  tx.compraServicio.findFirst.mockResolvedValue({ numeroFactura: null });
  tx.compraServicio.updateMany.mockResolvedValue({ count: 1 });
  tx.compraServicio.deleteMany.mockResolvedValue({ count: 1 });
  tx.reconciliacionGasto.findMany.mockResolvedValue([]);
  tx.reconciliacionGasto.findFirst.mockResolvedValue(undefined);
  tx.reconciliacionGasto.deleteMany.mockResolvedValue({ count: 0 });
  tx.transaccionMoneda.deleteMany.mockResolvedValue({ count: 0 });
  tx.anticipoMovimiento.findMany.mockResolvedValue([]);
  tx.cuentaBancaria.findUnique.mockResolvedValue({ cuentaId: 'bank-1', tenantId: 'tenant-1', moneda: 'CUP' });
});

describe('deleteCompraServicioAction financial reversal', () => {
  it('restores paid bank balance and removes service reconciliation atomically', async () => {
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-1', tenantId: 'tenant-1', referenciaId: 'cs-1', tipoGasto: 'servicio',
      cuentaId: 'bank-1', tipoPagoId: 'transfer', monto: 70, moneda: 'CUP', montoConvertido: 70,
      estado: 'PAGADA', cuentaPorPagarId: null,
    }]);
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });

    const result = await deleteCompraServicioAction('cs-1');

    expect(result.success).toBe(true);
    expect(tx.cuentaBancaria.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'bank-1', tenantId: 'tenant-1' }, data: { saldo: { increment: 70 } },
    }));
    expect(tx.reconciliacionGasto.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', tipoGasto: 'servicio', referenciaId: 'cs-1' },
    });
    expect(tx.compraServicio.deleteMany).toHaveBeenCalledWith({
      where: { compraServicioId: 'cs-1', tenantId: 'tenant-1' },
    });
  });

  it('does not perform a second reversal after a lost atomic claim', async () => {
    tx.compraServicio.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await deleteCompraServicioAction('cs-1');
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('ALREADY_DELETED');
    expect(tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
  });

  it('aborts if a reconciliation appears during the deletion transaction', async () => {
    tx.reconciliacionGasto.findFirst.mockResolvedValue({ reconciliacionId: 'late-rec' });

    const result = await deleteCompraServicioAction('cs-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('CONCURRENT_RECONCILIATION');
    expect(tx.compraServicio.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks deletion when a service reconciliation references an unowned CxP', async () => {
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-cxp', tenantId: 'tenant-1', referenciaId: 'cs-1', tipoGasto: 'servicio',
      cuentaId: 'bank-1', tipoPagoId: 'transfer', monto: 70, moneda: 'CUP', montoConvertido: 70,
      estado: 'PAGADA', cuentaPorPagarId: 'cxp-foreign',
    }]);

    const result = await deleteCompraServicioAction('cs-1');

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('HAS_IMPACT');
    expect(tx.cuentaPorPagar.delete).not.toHaveBeenCalled();
    expect(tx.compraServicio.deleteMany).not.toHaveBeenCalled();
  });

  it('reverses a service CxP linked by the tenant invoice', async () => {
    tx.compraServicio.findFirst.mockResolvedValue({ numeroFactura: 'SVC-001' });
    tx.reconciliacionGasto.findMany.mockResolvedValueOnce([{
      reconciliacionId: 'rec-cxp', tenantId: 'tenant-1', referenciaId: 'cs-1', tipoGasto: 'servicio',
      cuentaId: 'bank-1', tipoPagoId: 'transfer', monto: 70, moneda: 'CUP', montoConvertido: 70,
      estado: 'PAGADA', cuentaPorPagarId: 'cxp-service',
    }]);
    tx.cuentaBancaria.updateMany.mockResolvedValue({ count: 1 });
    tx.cuentaPorPagar.findUnique.mockResolvedValue({
      cuentaPorPagarId: 'cxp-service', tenantId: 'tenant-1', tipo: 'servicio', numeroFactura: 'SVC-001',
      gastosDEId: null,
    });

    const result = await deleteCompraServicioAction('cs-1');
    expect(result.success).toBe(true);
    expect(tx.cuentaPorPagar.delete).toHaveBeenCalledWith({ where: { cuentaPorPagarId: 'cxp-service' } });
    expect(tx.compraServicio.deleteMany).toHaveBeenCalled();
  });
});

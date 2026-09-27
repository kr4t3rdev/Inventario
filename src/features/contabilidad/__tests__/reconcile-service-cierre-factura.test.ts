/**
 * @description Tests del cierre del ciclo de facturación de servicios al cobrar
 * (C-6): `reconcileService` marca PAGADA la Factura y la CxC enlazadas dentro
 * de su transacción; sin documento ni CxC no toca nada.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn(),
}));

const mockTx = {
  ventaServicios: {
    findUnique: vi.fn().mockResolvedValue({ total: 10000 }),
    update: vi.fn().mockResolvedValue({}),
  },
  cuentaBancaria: { update: vi.fn().mockResolvedValue({}) },
  reconciliacionServicio: { create: vi.fn().mockResolvedValue({}) },
  factura: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  cuentaPorCobrar: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = { $transaction: vi.fn((cb: any) => cb(mockTx)) };
  return { prisma: prismaMock, default: prismaMock };
});

import { AccountingReconciliationService } from '@/features/contabilidad/services/accounting-reconciliation-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user = {
  userId: 'user-1', name: 'T', email: 't@t.com',
  role: 'regularUser', isActive: true, tenantId: 'tenant-1', tenantRole: 'manager',
} as unknown as AuthenticatedUser;

const input = {
  ventaServicioId: 'vs-1',
  distribuciones: [{ cuentaId: 'cta-1', tipoPagoId: 'tp-1', monto: 10000, moneda: 'CUP' }],
};

describe('cierre de factura y CxC al cobrar servicios (C-6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marca PAGADA la Factura y la CxC enlazadas en la misma transacción', async () => {
    mockTx.factura.findFirst.mockResolvedValue({ idFactura: 'fac-1', estado: 'PENDIENTE' });
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      estado: 'PENDIENTE',
      montoDeuda: 10000,
    });

    const r = await AccountingReconciliationService.reconcileService({ input, user });

    expect(r.reconciliado).toBe(true);
    expect(mockTx.factura.update).toHaveBeenCalledWith({
      where: { idFactura: 'fac-1' },
      data: { estado: 'PAGADA' },
    });
    expect(mockTx.cuentaPorCobrar.update).toHaveBeenCalledWith({
      where: { id: 'cxc-1' },
      data: { estado: 'PAGADA', montoPagado: 10000 },
    });
  });

  it('sin factura ni CxC el cobro funciona sin tocar documentos', async () => {
    mockTx.factura.findFirst.mockResolvedValue(null);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null);

    const r = await AccountingReconciliationService.reconcileService({ input, user });

    expect(r.reconciliado).toBe(true);
    expect(mockTx.factura.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.update).not.toHaveBeenCalled();
  });

  it('Factura o CxC ya PAGADAS no se actualizan de nuevo', async () => {
    mockTx.factura.findFirst.mockResolvedValue({ idFactura: 'fac-1', estado: 'PAGADA' });
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      estado: 'PAGADA',
      montoDeuda: 10000,
    });

    await AccountingReconciliationService.reconcileService({ input, user });

    expect(mockTx.factura.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.update).not.toHaveBeenCalled();
  });
});

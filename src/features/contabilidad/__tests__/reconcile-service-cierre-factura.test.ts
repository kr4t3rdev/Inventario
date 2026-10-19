/**
 * @description Tests del cierre del ciclo de facturación de servicios al cobrar
 * (C-6): `reconcileService` marca PAGADA la Factura y la CxC enlazadas dentro
 * de su transacción; sin documento ni CxC no toca nada. Con claims de estado
 * (B-5): las escrituras filtran por estado vivo, así una anulación concurrente
 * no se resurrecta ni se sobre-escribe.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn(),
}));

const mockTx = {
  ventaServicios: {
    findFirst: vi.fn().mockResolvedValue({ total: 10000, reconciliado: false }),
    update: vi.fn().mockResolvedValue({}),
  },
  cuentaBancaria: { count: vi.fn().mockResolvedValue(1), update: vi.fn().mockResolvedValue({}) },
  tipoPago: { count: vi.fn().mockResolvedValue(1) },
  reconciliacionServicio: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
  factura: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  $executeRaw: vi.fn(),
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = { $transaction: vi.fn((cb: any) => cb(mockTx)) };
  return { prisma: prismaMock, default: prismaMock };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { reconciliarServicioAction } from '@/features/contabilidad/actions-reconciliacion';
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, role: 'admin' });
  });

  it.each(['service', 'action'] as const)(
    '%s espera el documento después del lock contable y antes de leer o escribir la venta',
    async (entrypoint) => {
      let releaseDocument!: () => void;
      const heldDocument = new Promise<void>((resolve) => { releaseDocument = resolve; });
      mockTx.$executeRaw.mockImplementationOnce(async () => {
        await heldDocument;
        return 1;
      });
      mockTx.factura.findFirst.mockResolvedValue(null);
      mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null);
      const pending = entrypoint === 'service'
        ? AccountingReconciliationService.reconcileService({ input, user })
        : reconciliarServicioAction(input);
      try {
        await vi.waitFor(() => expect(mockTx.$executeRaw).toHaveBeenCalled());
        expect(acquireAccountingTenantLock).toHaveBeenCalledWith(mockTx, 'tenant-1');
        expect(vi.mocked(acquireAccountingTenantLock).mock.invocationCallOrder[0])
          .toBeLessThan(mockTx.$executeRaw.mock.invocationCallOrder[0]);
        expect((mockTx.$executeRaw.mock.calls[0] as unknown[])[1])
          .toBe(JSON.stringify(['venta-servicio-doc', 'vs-1']));
        expect(mockTx.ventaServicios.findFirst).not.toHaveBeenCalled();
        expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
        expect(mockTx.cuentaBancaria.update).not.toHaveBeenCalled();
        expect(mockTx.reconciliacionServicio.create).not.toHaveBeenCalled();
      } finally {
        releaseDocument();
        await pending;
      }
      const result = await pending;
      expect('success' in result ? result.success : result.reconciliado).toBe(true);
      expect(mockTx.ventaServicios.update).toHaveBeenCalledTimes(1);
    },
  );

  it('marca PAGADA la Factura y la CxC enlazadas en la misma transacción', async () => {
    mockTx.factura.findFirst.mockResolvedValue({ idFactura: 'fac-1', estado: 'PENDIENTE' });
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      estado: 'PENDIENTE',
      montoDeuda: 10000,
    });

    const r = await AccountingReconciliationService.reconcileService({ input, user });

    expect(r.reconciliado).toBe(true);
    // B-6: el writer toma el lock del documento dentro de su transacción.
    expect(mockTx.$executeRaw).toHaveBeenCalled();
    // B-5: claims de estado — solo se cierra lo que sigue vivo.
    expect(mockTx.factura.updateMany).toHaveBeenCalledWith({
      where: { idFactura: 'fac-1', estado: 'PENDIENTE' },
      data: { estado: 'PAGADA' },
    });
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { id: 'cxc-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: { estado: 'PAGADA', montoPagado: 10000 },
    });
  });

  it('sin factura ni CxC vivas el cobro funciona sin tocar documentos', async () => {
    mockTx.factura.findFirst.mockResolvedValue(null);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null);

    const r = await AccountingReconciliationService.reconcileService({ input, user });

    expect(r.reconciliado).toBe(true);
    expect(mockTx.factura.updateMany).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('Factura o CxC ya PAGADAS no aparecen en el claim y no se actualizan', async () => {
    // El claim consulta solo lo vivo (PENDIENTE/PARCIAL); lo ya pagado o
    // anulado no regresa del findFirst y por tanto no se escribe.
    mockTx.factura.findFirst.mockResolvedValue(null);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null);

    await AccountingReconciliationService.reconcileService({ input, user });

    expect(mockTx.factura.updateMany).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('una anulación concurrente no se resurrecta: el claim pierde en silencio', async () => {
    // B-5: la CxC se leyó PENDIENTE y fue anulada antes del updateMany; el
    // filtro de estado hace que el claim afecte 0 filas y el cobro continúa
    // sin resurrectar la anulación.
    mockTx.factura.findFirst.mockResolvedValue(null);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      estado: 'PENDIENTE',
      montoDeuda: 10000,
    });
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 0 });

    const r = await AccountingReconciliationService.reconcileService({ input, user });

    expect(r.reconciliado).toBe(true);
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { id: 'cxc-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: { estado: 'PAGADA', montoPagado: 10000 },
    });
  });
});

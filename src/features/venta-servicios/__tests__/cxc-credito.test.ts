/**
 * @description Tests de cuenta por cobrar en ventas de servicios a crédito (B-06).
 * Antes del fix ninguna venta de servicios generaba obligación de cobro, así que
 * un servicio a crédito era invisible para la cartera de cobros.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn(), getRateAsOfExact: vi.fn() },
}));

const mockTx = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  ventaServicios: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  cuentaPorCobrar: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  cliente: { findFirst: vi.fn().mockResolvedValue({ clienteId: 'cliente-1', limiteCredito: null }) },
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  anticipo: { findUnique: vi.fn() },
  reconciliacionServicio: { create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-serv-mock' }) },
  transaccionMoneda: { create: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ventaServicios: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    servicios: { findFirst: vi.fn(), findMany: vi.fn() },
    cliente: { findFirst: vi.fn() },
    reconciliacionServicio: { count: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createVentaServicioAction } from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
  userId: 'user-1', name: 'Test', email: 'test@test.com',
  role: 'admin', isActive: true, tenantId: 'tenant-test', tenantRole: 'manager',
};

describe('B-06: crédito en ventas de servicios genera CxC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000 },
    ] as any);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'cli-1' } as any);
    mockTx.cuentaBancaria.findFirst.mockResolvedValue({
      cuentaId: 'cta-1',
      tipoCuenta: 'EFECTIVO',
    } as any);
    mockTx.reconciliacionServicio.create.mockImplementation(async ({ data }: any) => ({
      reconciliacionId: 'rec-serv-mock',
      ...data,
    }));
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1', total: 10000 } as any);
    mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' } as any);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' } as any);
  });

  it('CONTADO (default) no crea cuenta por cobrar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({ servicioId: 'sv-1', cantidad: 2, clienteId: 'cli-1' } as never);

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('CREDITO sin cliente es error de validación', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1', cantidad: 2, condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('CREDITO con cliente crea la CxC vinculada por el total con vencimiento', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
      fechaVencimiento: '2026-10-15',
    } as never);

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error).toBeUndefined();
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-test',
        clienteId: 'cli-1',
        ventaServicioId: 'vs-1',
        montoDeuda: 10000,
        monedaFuncional: 'CUP',
        fxProvenanceKind: 'SAME_CURRENCY',
        estado: 'PENDIENTE',
        tipoCuenta: 'VENTA_SERVICIO',
        fechaVencimiento: new Date('2026-10-15'),
      }),
    });
    const cxcData = mockTx.cuentaPorCobrar.create.mock.calls[0][0].data;
    expect(cxcData.montoDeudaFuncional.toFixed()).toBe('10000');
    expect(cxcData.tasaCambio.toFixed()).toBe('1');
    expect(cxcData.fxEvidenceVersion).toBe(2);
  });

  it('CREDITO con anticipo parcial devenga la CxC bruta y registra el pago aplicado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const { applyAnticipoAllocations } = await import('@/lib/services/anticipos-workflow');
    vi.mocked(applyAnticipoAllocations).mockResolvedValue([{ anticipoId: 'ant-1', montoAplicado: 4000 }] as never);
    mockTx.anticipo.findUnique.mockResolvedValue({
      moneda: 'CUP', cuentaOrigenId: 'cta-1', tipoPagoOrigenId: 'tp-1', clienteId: 'cli-1', tipo: 'RECIBIDO',
    } as never);
    mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' } as never);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
      anticipos: [{ anticipoId: 'ant-1', montoAplicado: 4000 }],
    } as never);

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montoDeuda: 10000,
        monedaOriginal: 'CUP',
        montoOriginal: 10000,
        monedaFuncional: 'CUP',
        fxProvenanceKind: 'SAME_CURRENCY',
      }),
    });
    const cxcData = mockTx.cuentaPorCobrar.create.mock.calls[0][0].data;
    expect(cxcData.montoDeudaFuncional.toFixed()).toBe('10000');
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montoPagado: 4000, estado: 'PARCIAL' }),
    }));
  });

  it('CREDITO cubierto con anticipos conserva la obligación bruta como PAGADA', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    const { applyAnticipoAllocations } = await import('@/lib/services/anticipos-workflow');
    vi.mocked(applyAnticipoAllocations).mockResolvedValue([{ anticipoId: 'ant-1', montoAplicado: 10000 }] as never);
    mockTx.anticipo.findUnique.mockResolvedValue({
      moneda: 'CUP', cuentaOrigenId: 'cta-1', tipoPagoOrigenId: 'tp-1', clienteId: 'cli-1', tipo: 'RECIBIDO',
    } as never);
    mockTx.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' } as never);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
      anticipos: [{ anticipoId: 'ant-1', montoAplicado: 10000 }],
    } as never);

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ montoPagado: 10000, estado: 'PAGADA' }),
    }));
  });
});

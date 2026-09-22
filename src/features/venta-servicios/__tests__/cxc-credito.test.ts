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
  exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

const mockTx = {
  ventaServicios: { create: vi.fn() },
  cuentaPorCobrar: { create: vi.fn() },
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
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1' } as any);
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

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-test',
        clienteId: 'cli-1',
        ventaServicioId: 'vs-1',
        montoDeuda: 10000,
        estado: 'PENDIENTE',
        tipoCuenta: 'VENTA_SERVICIO',
        fechaVencimiento: new Date('2026-10-15'),
      }),
    });
  });

  it('CREDITO con anticipo parcial crea la CxC solo por el remanente', async () => {
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
      data: expect.objectContaining({ montoDeuda: 6000 }),
    });
  });

  it('CREDITO cubierto por completo con anticipos no crea CxC', async () => {
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
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });
});

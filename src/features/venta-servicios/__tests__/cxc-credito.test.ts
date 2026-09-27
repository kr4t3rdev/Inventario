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
  ventaServicios: { create: vi.fn(), update: vi.fn() },
  cuentaPorCobrar: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  anticipo: { findUnique: vi.fn() },
  reconciliacionServicio: { create: vi.fn() },
  transaccionMoneda: { create: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    ventaServicios: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    servicios: { findFirst: vi.fn(), findMany: vi.fn() },
    cliente: { findFirst: vi.fn() },
    cuentaPorCobrar: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    reconciliacionServicio: { count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  };
  // audit-log-service hace import default de '@/lib/prisma': exponer ambas formas.
  return { prisma: prismaMock, default: prismaMock };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { createVentaServicioAction, updateVentaServicioAction } from '@/features/venta-servicios/actions';
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

describe('enforcement del límite de crédito en venta de servicios (C-2)', () => {
  const dependiente = {
    userId: 'user-dependiente', name: 'Dep', email: 'dep@test.com',
    role: 'regularUser', isActive: true, tenantId: 'tenant-test',
    tenantRole: 'dependiente', planFeatures: { servicios: true },
  } as unknown as AuthenticatedUser;

  const manager = {
    userId: 'user-manager', name: 'Manager', email: 'm@test.com',
    role: 'regularUser', isActive: true, tenantId: 'tenant-test',
    tenantRole: 'manager', planFeatures: { servicios: true },
  } as unknown as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.stubEnv('PERIODO_GUARD_SKIP', 'true');
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 5000 },
    ] as never);
    // Cliente con tope de 1000: cualquier venta de 2 unidades (10000) lo supera.
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: 1000,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([] as never);
    mockTx.ventaServicios.create.mockResolvedValue({ ventaServicioId: 'vs-1', total: 10000 } as never);
    mockTx.cuentaPorCobrar.create.mockResolvedValue({ id: 'cxc-1' } as never);
  });

  it('mixto CREDITO sobre el tope sin permiso: CREDITO_EXCEDIDO y cero filas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
    vi.mocked(prisma.$transaction).mockImplementation((args: never) => {
      if (Array.isArray(args)) return Promise.all(args);
      return (args as (tx: unknown) => Promise<unknown>)(mockTx);
    });

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(prisma.ventaServicios.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('mixto CREDITO sobre el tope con override: pasa y audita CREDITO_OVERRIDE', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    vi.mocked(prisma.$transaction).mockImplementation((args: never) => {
      if (Array.isArray(args)) return Promise.all(args);
      return (args as (tx: unknown) => Promise<unknown>)(mockTx);
    });
    vi.mocked(prisma.ventaServicios.create).mockResolvedValue({
      ventaServicioId: 'vs-1', total: 10000,
    } as never);

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(true);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = mockTx.auditLog.create.mock.calls[0][0].data;
    expect(auditData.entidad).toBe('VENTA_SERVICIO');
    expect(auditData.detalles).toMatchObject({ tipo: 'CREDITO_OVERRIDE' });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('legacy CREDITO sobre el tope sin permiso: CREDITO_EXCEDIDO y no crea la venta', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(mockTx.ventaServicios.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('legacy CREDITO dentro del tope pasa sin alertas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
    // 2 × 500 = 1000 = tope exacto → la igualdad no bloquea.
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 500 },
    ] as never);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(true);
    expect(mockTx.ventaServicios.create).toHaveBeenCalled();
  });

  it('legacy con anticipos evalúa el remanente, no el total', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
    // Total 20000, anticipos 19500 → remanente 500 ≤ tope 1000 → pasa.
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([
      { servicioId: 'sv-1', moneda: 'CUP', precio: 10000 },
    ] as never);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
      anticipos: [{ anticipoId: 'ant-1', montoAplicado: 19500 }],
    } as never);

    expect(result.success).toBe(true);
    expect(mockTx.ventaServicios.create).toHaveBeenCalled();
  });

  it('CONTADO nunca evalúa el tope aunque el cliente lo tenga agotado', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependiente);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: 0,
    } as never);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1',
      cantidad: 2,
      clienteId: 'cli-1',
    } as never);

    expect(result.success).toBe(true);
  });
});

describe('update coherente con la CxC (C-4)', () => {
  const adminUser = mockUser;
  const ventaCredito = {
    ventaServicioId: 'vs-1',
    cantidad: 1,
    total: 5000,
    precioUnitario: 5000,
    clienteId: 'cli-1',
    condicionPago: 'CREDITO',
  };
  const cxcActiva = {
    cuentaPorCobrarId: 'cxc-1',
    estado: 'PENDIENTE',
    montoDeuda: 5000,
    clienteId: 'cli-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(ventaCredito as never);
    vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(cxcActiva as never);
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-2', limiteCredito: null,
    } as never);
    mockTx.ventaServicios.update.mockResolvedValue(ventaCredito as never);
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('cambio de cantidad ajusta montoDeuda en la misma transacción', async () => {
    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.ventaServicios.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ventaServicioId: 'vs-1' },
        data: expect.objectContaining({ cantidad: 2, total: 10000 }),
      }),
    );
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { cuentaPorCobrarId: 'cxc-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: { montoDeuda: 10000 },
    });
  });

  it('con reconciliaciones registradas rechaza el cambio de cantidad (HAS_REFERENCES)', async () => {
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(2 as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HAS_REFERENCES');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('con la CxC PAGADA rechaza el cambio de total (CXC_PAGADA)', async () => {
    vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({
      ...cxcActiva, estado: 'PAGADA',
    } as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CXC_PAGADA');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('cambio de cliente mueve la CxC en la misma transacción', async () => {
    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: 'cli-2',
    });

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { cuentaPorCobrarId: 'cxc-1', estado: { not: 'ANULADA' } },
      data: { clienteId: 'cli-2' },
    });
  });

  it('cambio de cliente sobre el tope del nuevo cliente sin permiso: CREDITO_EXCEDIDO', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-2', limiteCredito: 100,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([] as never);
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      planFeatures: { servicios: true },
      permissions: new Set(['ventas.servicios.editar']),
    } as unknown as AuthenticatedUser);

    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: 'cli-2',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('quitar el cliente de una venta a crédito con CxC activa es rechazado', async () => {
    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('si la CxC cambió de estado entre lectura y escritura falla con CXC_ESTADO_CAMBIO', async () => {
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CXC_ESTADO_CAMBIO');
  });
});

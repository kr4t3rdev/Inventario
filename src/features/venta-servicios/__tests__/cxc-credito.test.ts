/**
 * @description Tests de cuenta por cobrar en ventas de servicios a crédito (B-06).
 * Antes del fix ninguna venta de servicios generaba obligación de cobro, así que
 * un servicio a crédito era invisible para la cartera de cobros.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/contabilidad/services/period-close-write-guard', () => ({
  guardAccountingWriteInTransaction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/anticipos-workflow', () => ({ applyAnticipoAllocations: vi.fn() }));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
  exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

// Lecturas compartidas raíz↔tx (mismo fn): el chequeo de crédito y las
// lecturas del update corren por tx dentro de la transacción; los tests
// configuran una sola vez. Los writes quedan separados (atomicidad).
// vi.hoisted: la fábrica de vi.mock se ejecuta antes que cualquier const.
const {
	mockVentaFindFirst,
	mockClienteFindFirst,
	mockCxcFindFirst,
	mockCxcFindMany,
	mockFacturaFindFirst,
	mockReconciliacionCount,
} = vi.hoisted(() => ({
	mockVentaFindFirst: vi.fn(),
	mockClienteFindFirst: vi.fn(),
	mockCxcFindFirst: vi.fn(),
	mockCxcFindMany: vi.fn(),
	mockFacturaFindFirst: vi.fn(),
	mockReconciliacionCount: vi.fn(),
}));

const mockTx = {
  ventaServicios: { create: vi.fn(), update: vi.fn(), findFirst: mockVentaFindFirst },
  cuentaPorCobrar: { create: vi.fn(), findFirst: mockCxcFindFirst, findMany: mockCxcFindMany, update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  factura: { findFirst: mockFacturaFindFirst },
  cliente: { findFirst: mockClienteFindFirst },
  reconciliacionServicio: { create: vi.fn(), count: mockReconciliacionCount },
  $executeRaw: vi.fn(),
  tipoPago: { findFirst: vi.fn() },
  cuentaBancaria: { findFirst: vi.fn() },
  anticipo: { findUnique: vi.fn() },
  transaccionMoneda: { create: vi.fn() },
  tenantAccountingPolicy: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    ventaServicios: { findMany: vi.fn(), findFirst: mockVentaFindFirst, create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    servicios: { findFirst: vi.fn(), findMany: vi.fn() },
    cliente: { findFirst: mockClienteFindFirst },
    cuentaPorCobrar: { findMany: mockCxcFindMany, create: vi.fn(), findFirst: mockCxcFindFirst },
    factura: { findFirst: mockFacturaFindFirst, count: vi.fn() },
    reconciliacionServicio: { count: mockReconciliacionCount },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((operation: ((tx: typeof mockTx) => Promise<unknown>) | readonly Promise<unknown>[]) =>
      typeof operation === 'function' ? operation(mockTx) : Promise.all(operation),
    ),
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
  planFeatures: { 'cuentas-cobrar': true },
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

  it('Basic cannot create legacy or mixed service sales that open a new receivable', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'manager',
      planFeatures: { servicios: true, 'cuentas-cobrar': false },
    } as AuthenticatedUser);

    const legacyResult = await createVentaServicioAction({
      servicioId: 'sv-1', cantidad: 1, clienteId: 'cli-1', condicionPago: 'CREDITO',
    } as never);
    const mixedResult = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 1 }],
      clienteId: 'cli-1', condicionPago: 'CREDITO',
    } as never);

    expect(legacyResult.success).toBe(false);
    expect(expectActionFailure(legacyResult).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(mixedResult.success).toBe(false);
    expect(expectActionFailure(mixedResult).error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(mockTx.ventaServicios.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('CREDITO sin cliente es error de validación', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

    const result = await createVentaServicioAction({
      servicioId: 'sv-1', cantidad: 2, condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('VALIDATION_ERROR');
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('CREDITO con cliente crea la CxC vinculada por el total con vencimiento y toma el lock de crédito', async () => {
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
    // B-4: el chequeo del tope corre dentro de la transacción con el lock.
    expect(mockTx.$executeRaw).toHaveBeenCalled();
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
    tenantRole: 'dependiente', planFeatures: { servicios: true, 'cuentas-cobrar': true },
  } as unknown as AuthenticatedUser;

  const manager = {
    userId: 'user-manager', name: 'Manager', email: 'm@test.com',
    role: 'regularUser', isActive: true, tenantId: 'tenant-test',
    tenantRole: 'manager', planFeatures: { servicios: true, 'cuentas-cobrar': true },
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

    const result = await createVentaServicioAction({
      lineas: [{ tipoLinea: 'SERVICIO', servicioId: 'sv-1', cantidad: 2 }],
      clienteId: 'cli-1',
      condicionPago: 'CREDITO',
    } as never);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(prisma.ventaServicios.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
  });

  it('mixto CREDITO sobre el tope con override: pasa y audita CREDITO_OVERRIDE', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
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
    if (result.success) throw new Error("Expected action failure");
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
    id: 'cxc-1',
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
    // Default anti-fuga: sin factura previa salvo que el test la configure.
    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null as never);
    mockTx.ventaServicios.update.mockResolvedValue(ventaCredito as never);
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 } as never);
  });

  it('Basic cannot increase an existing receivable balance after downgrade', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'manager',
      planFeatures: { servicios: true, 'cuentas-cobrar': false },
    } as AuthenticatedUser);

    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1',
      cantidad: 2,
    } as never);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('espera el lock del documento antes de leer y rechaza la factura emitida mientras esperaba', async () => {
    let releaseLock!: () => void;
    const invoiceCommitted = new Promise<void>((resolve) => { releaseLock = resolve; });
    mockTx.$executeRaw.mockImplementationOnce(async () => {
      await invoiceCommitted;
      return 1;
    });

    const pendingUpdate = updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });
    try {
      await vi.waitFor(() => expect(mockTx.$executeRaw).toHaveBeenCalled());
      const documentLock = mockTx.$executeRaw.mock.calls[0] as unknown[];
      expect(documentLock[1]).toBe(JSON.stringify(['venta-servicio-doc', 'vs-1']));
      expect(mockVentaFindFirst).toHaveBeenCalledTimes(1);
      expect(mockVentaFindFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
        select: { createdAt: true },
      }));
      expect(mockCxcFindFirst).not.toHaveBeenCalled();
      expect(mockFacturaFindFirst).not.toHaveBeenCalled();
      // La otra transacción emite su factura antes de liberar el mismo lock.
      mockFacturaFindFirst.mockResolvedValue({ idFactura: 'factura-concurrente' });
    } finally {
      releaseLock();
      await pendingUpdate;
    }

    const result = await pendingUpdate;
    expect(expectActionFailure(result).error.code).toBe('VENTA_FACTURADA_INMUTABLE');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
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
      where: { id: 'cxc-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: { montoDeuda: 10000 },
    });
  });

  it('con reconciliaciones registradas rechaza el cambio de cantidad (HAS_REFERENCES)', async () => {
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(2 as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('HAS_REFERENCES');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('con la CxC PAGADA rechaza el cambio de total (CXC_PAGADA)', async () => {
    vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({
      ...cxcActiva, estado: 'PAGADA',
    } as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CXC_PAGADA');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('cambio de cliente mueve la CxC en la misma transacción', async () => {
    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: 'cli-2',
    });

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { id: 'cxc-1', estado: { not: 'ANULADA' } },
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
      planFeatures: { servicios: true, 'cuentas-cobrar': true },
      permissions: new Set(['ventas.servicios.editar']),
    } as unknown as AuthenticatedUser);

    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: 'cli-2',
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('quitar el cliente de una venta a crédito con CxC activa es rechazado', async () => {
    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', clienteId: null,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('un aumento de cantidad que supera el tope se rechaza: CREDITO_EXCEDIDO (B-1)', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: 6000,
    } as never);
    // Saldo vivo del mismo cliente SIN la CxC propia (queda excluida): 2000.
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      { id: 'cxc-otra', montoDeuda: 2000, montoPagado: 0, estado: 'PENDIENTE' },
    ] as never);
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      planFeatures: { servicios: true, 'cuentas-cobrar': true },
      permissions: new Set(['ventas.servicios.editar']),
    } as unknown as AuthenticatedUser);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    // Nuevo total 10000 + saldo 2000 = 12000 > límite 6000 → rechazado; el
    // código pre-fix ni siquiera evaluaba este camino.
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
    // B-4: la evaluación corre dentro de la transacción con el lock del cliente.
    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('cambio de cliente con aumento de cantidad valida el nuevo total, no la deuda previa (B-1)', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-2', limiteCredito: 8000,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([] as never);
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      role: 'regularUser',
      planFeatures: { servicios: true, 'cuentas-cobrar': true },
      permissions: new Set(['ventas.servicios.editar']),
    } as unknown as AuthenticatedUser);

    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', cantidad: 2, clienteId: 'cli-2',
    });

    // El código pre-fix validaba la deuda vieja (5000 ≤ 8000) y dejaba pasar
    // el nuevo total 10000 > 8000. Ahora se exige el nuevo total.
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CREDITO_EXCEDIDO');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('una venta con factura emitida es inmutable en cantidad y cliente (B-3)', async () => {
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ idFactura: 'fac-1' } as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('VENTA_FACTURADA_INMUTABLE');
    expect(mockTx.ventaServicios.update).not.toHaveBeenCalled();
  });

  it('las observaciones de una venta facturada siguen editables (B-3)', async () => {
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ idFactura: 'fac-1' } as never);

    const result = await updateVentaServicioAction({
      ventaServicioId: 'vs-1', observaciones: 'nota sin efecto financiero',
    });

    expect(result.success).toBe(true);
  });

  it('si la CxC cambió de estado entre lectura y escritura falla con CXC_ESTADO_CAMBIO', async () => {
    mockTx.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 2 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected action failure");
    expect(result.error?.code).toBe('CXC_ESTADO_CAMBIO');
  });
});

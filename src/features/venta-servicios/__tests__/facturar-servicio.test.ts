/**
 * @description Tests de facturación de ventas de servicios (C-6): emisión única
 * con numeración de serie, enlace de la CxC existente (sin deuda nueva),
 * estados según cobro y permiso dedicado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
  acquireAccountingTenantLock: vi.fn(),
}));

// Lecturas compartidas raíz↔tx (mismo fn): la venta, la factura previa y la
// CxC se leen por tx dentro de la transacción (lock del documento, B-6).
// vi.hoisted: la fábrica de vi.mock se ejecuta antes que cualquier const.
const {
	mockVentaFindFirst,
	mockFacturaFindFirst,
	mockCxcFindFirst,
} = vi.hoisted(() => ({
	mockVentaFindFirst: vi.fn(),
	mockFacturaFindFirst: vi.fn(),
	mockCxcFindFirst: vi.fn(),
}));

const mockTx = {
  serieFacturacion: {
    findFirst: vi.fn().mockResolvedValue({ serieId: 'serie-1', prefijo: 'FV', consecutivo: 3 }),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ serieId: 'serie-1', consecutivo: 4 }),
  },
  ventaServicios: { findFirst: mockVentaFindFirst },
  factura: { create: vi.fn(), findFirst: mockFacturaFindFirst, updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  cuentaPorCobrar: { findFirst: mockCxcFindFirst, updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  $executeRaw: vi.fn(),
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    ventaServicios: { findFirst: mockVentaFindFirst },
    factura: { findFirst: mockFacturaFindFirst, count: vi.fn() },
    cliente: { findFirst: vi.fn() },
    cuentaPorCobrar: { findMany: vi.fn(), findFirst: mockCxcFindFirst },
    reconciliacionServicio: { count: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  };
  return { prisma: prismaMock, default: prismaMock };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  facturarVentaServicioAction,
  deleteVentaServicioAction,
} from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerUser = {
  userId: 'user-manager', name: 'Manager', email: 'm@test.com',
  role: 'regularUser', isActive: true, tenantId: 'tenant-test',
  tenantRole: 'manager', planFeatures: { servicios: true, facturacion: true, 'ventas-factura': true },
} as unknown as AuthenticatedUser;

const ventaServicio = {
  ventaServicioId: 'vs-1',
  tenantId: 'tenant-test',
  clienteId: 'cli-1',
  total: 10000,
  reconciliado: false,
  condicionPago: 'CREDITO',
  factura: null,
};

describe('facturarVentaServicioAction (C-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false');
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(ventaServicio as never);
    // Default anti-fuga: sin factura previa salvo que el test la configure
    // (clearAllMocks no elimina implementaciones heredadas de tests previos).
    vi.mocked(prisma.factura.findFirst).mockResolvedValue(null as never);
    mockTx.factura.create.mockResolvedValue({
      idFactura: 'fac-1',
      numeroFactura: 'FV-000003',
      estado: 'PENDIENTE',
    } as never);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      estado: 'PENDIENTE',
      montoDeuda: 10000,
    } as never);
  });

  it('emite la factura con número de serie y enlaza la CxC existente sin deuda nueva', async () => {
    const result = await facturarVentaServicioAction({
      ventaServicioId: 'vs-1',
      fechaVencimiento: '2026-10-20',
    });

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.factura.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-test',
        ventaServicioId: 'vs-1',
        clienteId: 'cli-1',
        numeroFactura: 'FV-000003',
        tipoDocumento: 'FACTURA',
        total: 10000,
        estado: 'PENDIENTE',
        fechaVencimiento: new Date('2026-10-20'),
      }),
    });
    // La deuda ya existía: solo se enlaza el documento, no se crea CxC nueva.
    // Claim de estado: la CxC solo se toca si sigue viva (B-5).
    expect(mockTx.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { id: 'cxc-1', estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: expect.objectContaining({
        facturaId: 'fac-1',
        numeroFactura: 'FV-000003',
      }),
    });
    expect(mockTx.cuentaPorCobrar.updateMany.mock.calls[0][0].data).not.toHaveProperty('montoDeuda');
    // B-6: la venta y sus documentos se leen dentro de la transacción, bajo el
    // lock del documento compartido con el cobro.
    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('venta ya cobrada (reconciliada) emite la factura PAGADA y cierra la CxC', async () => {
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
      ...ventaServicio,
      reconciliado: true,
      condicionPago: 'CONTADO',
    } as never);
    mockTx.cuentaPorCobrar.findFirst.mockResolvedValue(null as never);

    const result = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });

    expect(result.success).toBe(true);
    expect(mockTx.factura.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ estado: 'PAGADA' }),
    });
    expect(mockTx.cuentaPorCobrar.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza la doble facturación (VENTA_YA_FACTURADA)', async () => {
    vi.mocked(prisma.factura.findFirst).mockResolvedValue({ idFactura: 'fac-0' } as never);

    const result = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VENTA_YA_FACTURADA');
    expect(mockTx.factura.create).not.toHaveBeenCalled();
  });

  it('rechaza facturar una venta sin cliente (FACTURA_REQUIERE_CLIENTE)', async () => {
    vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue({
      ...ventaServicio,
      clienteId: null,
    } as never);

    const result = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FACTURA_REQUIERE_CLIENTE');
  });

  it('no revalida el tope de crédito: la deuda ya fue validada y existe', async () => {
    vi.mocked(prisma.cliente.findFirst).mockResolvedValue({
      clienteId: 'cli-1', limiteCredito: 0,
    } as never);
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      { id: 'cxc-vieja', montoDeuda: 999999, montoPagado: 0, estado: 'PENDIENTE' },
    ] as never);

    const result = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });

    expect(result.success).toBe(true);
    // El helper de crédito nunca consulta: no hay exposición nueva al facturar.
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(prisma.cuentaPorCobrar.findMany).not.toHaveBeenCalled();
  });

  it('sin el permiso ventas.servicios.facturar recibe FORBIDDEN', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...managerUser,
      tenantRole: 'dependiente',
      permissions: new Set(['operaciones.servicios.acceder']),
    } as unknown as AuthenticatedUser);

    const result = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  it('audita la emisión del documento dentro de la transacción', async () => {
    const _dbg = await facturarVentaServicioAction({ ventaServicioId: 'vs-1' });
    if (!_dbg.success) console.error('DEBUG_ERR', JSON.stringify(_dbg.error));

    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = mockTx.auditLog.create.mock.calls[0][0].data;
    expect(auditData.entidad).toBe('VENTA_SERVICIO');
    expect(auditData.detalles).toMatchObject({
      tipo: 'VENTA_SERVICIO_FACTURADA',
      numeroFactura: 'FV-000003',
    });
  });

  it('delete con factura emitida es rechazado (VENTA_CON_FACTURA)', async () => {
    vi.mocked(prisma.factura.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.reconciliacionServicio.count).mockResolvedValue(0 as never);

    const result = await deleteVentaServicioAction('vs-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VENTA_CON_FACTURA');
  });
});

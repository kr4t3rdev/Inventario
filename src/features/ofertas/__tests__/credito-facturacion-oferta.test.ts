/**
 * @description Tests del enforcement del tope de crédito en la facturación de
 *              ofertas (Sesión C).
 *
 * `facturarOfertaAction` con vencimiento distinto de `contra_pago` crea una
 * CuentaPorCobrar por el total de la oferta: es deuda nueva del cliente y,
 * por tanto, debe pasar por el mismo enforcement de `exigirLimiteCredito` que
 * el resto de writers de deuda (venta de servicios, facturación de productos,
 * POS). Además debe tomar el lock de crédito del cliente para que dos
 * facturaciones concurrentes del mismo cliente no aprueben sobre el mismo
 * saldo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/anticipos-workflow', () => ({
  applyAnticipoAllocations: vi.fn(),
}));
vi.mock('@/features/turnos-pos', () => ({
  getOrCreateTurnoActivo: vi.fn().mockResolvedValue({ success: true, data: { turnoId: 'turno-1' } }),
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
  allocateFifoForSale: vi.fn(),
}));
vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { logStrict: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>()),
  applyFacturacionCobroWorkflow: vi.fn().mockResolvedValue({
    tipoVencimiento: 'plazo',
    reconciliacionId: null,
  }),
}));

const mockTx = {
  $executeRaw: vi.fn(),
  oferta: { findFirst: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  venta: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  ventaServicios: { create: vi.fn() },
  factura: { create: vi.fn(), update: vi.fn() },
  serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  producto: { findUnique: vi.fn() },
  stockUbicacion: { findUnique: vi.fn() },
  servicios: { findFirst: vi.fn() },
  cliente: { findFirst: vi.fn() },
  cuentaPorCobrar: { findMany: vi.fn(), upsert: vi.fn() },
  auditLog: { create: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oferta: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn(),
    },
    cliente: { findFirst: vi.fn() },
    producto: { findFirst: vi.fn() },
    turnoPuntoVenta: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { facturarOfertaAction } from '@/features/ofertas/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const SIN_OVERRIDE: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Vendedor',
  email: 'vendedor@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'economico',
  planFeatures: { ofertas: true, 'cuentas-cobrar': true },
  permissions: new Set(['ventas.ofertas.gestionar']),
};

const CON_OVERRIDE: AuthenticatedUser = {
  ...SIN_OVERRIDE,
  userId: 'user-2',
  permissions: new Set(['ventas.ofertas.gestionar', 'ventas.venta.credito-override']),
};

/** Oferta de 1000 con items de producto (flujo que crea deuda). */
function ofertaMock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'of-1',
    estado: 'PENDIENTE',
    clienteId: 'cli-1',
    tenantId: 'tenant-A',
    subtotal: 1000,
    impuestos: 0,
    total: 1000,
    fechaVencimiento: null,
    items: [
      { productoId: 'prod-1', servicioId: null, cantidad: 2, precioUnitario: 500, total: 1000 },
    ],
    cliente: { clienteId: 'cli-1', nombre: 'Cliente' },
    ...overrides,
  };
}

/**
 * @description Extrae las llamadas al advisory lock cuyo identificador es el
 *              del crédito (distinto del lock de oferta).
 * @param {typeof mockTx} tx - Transacción mockeada.
 * @returns {number} Cantidad de locks de crédito tomados.
 */
function locksDeCredito(tx: typeof mockTx): number {
  return tx.$executeRaw.mock.calls.filter((call) =>
    call.slice(1).some((valor) => typeof valor === 'string' && valor.includes('credito')),
  ).length;
}

describe('facturarOfertaAction — tope de crédito (Sesión C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(SIN_OVERRIDE);
    vi.mocked(prisma.oferta.findFirst).mockResolvedValue(ofertaMock() as never);
    mockTx.oferta.findFirst.mockResolvedValue(ofertaMock() as never);
    mockTx.serieFacturacion.findFirst.mockResolvedValue({
      serieId: 'serie-1', prefijo: 'FV', consecutivo: 1, esPorDefecto: true, activa: true,
    } as never);
    mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 } as never);
    mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' } as never);
    mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' } as never);
    mockTx.producto.findUnique.mockResolvedValue({
      id: 'prod-1', nombre: 'Producto', tenantId: 'tenant-A',
    } as never);
    mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 } as never);
    mockTx.cliente.findFirst.mockResolvedValue({ limiteCredito: 500 } as never);
    mockTx.cuentaPorCobrar.findMany.mockResolvedValue([
      { id: 'cxc-1', montoDeuda: 400, montoPagado: 0, estado: 'PENDIENTE' },
    ] as never);
  });

  it('rechaza la facturación a crédito que excede el límite del cliente', async () => {
    const result = await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'plazo',
    });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('CREDITO_EXCEDIDO');
  });

  it('no emite factura ni crea deuda cuando el tope se excede', async () => {
    await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'plazo',
    });

    expect(mockTx.factura.create).not.toHaveBeenCalled();
    expect(mockTx.cuentaPorCobrar.upsert).not.toHaveBeenCalled();
    expect(applyFacturacionCobroWorkflow).not.toHaveBeenCalled();
    expect(mockTx.venta.create).not.toHaveBeenCalled();
  });

  it('toma el lock de crédito del cliente antes de evaluar el saldo', async () => {
    await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'plazo',
    });

    expect(locksDeCredito(mockTx)).toBeGreaterThan(0);
  });

  it('permite exceder el límite con el permiso de override y lo audita', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(CON_OVERRIDE);

    const result = await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'plazo',
    });

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data).toBeDefined();
    expect(AuditLogService.logStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'EXECUTE',
        detalles: expect.objectContaining({
          tipo: 'CREDITO_OVERRIDE',
          clienteId: 'cli-1',
        }),
      }),
      mockTx,
    );
  });

  it('no evalúa el tope cuando el cobro es contra pago (no crea deuda)', async () => {
    const result = await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'contra_pago',
    });

    expect(result.success).toBe(true);
    expect(locksDeCredito(mockTx)).toBe(0);
  });

  it('no evalúa el tope cuando el cliente no tiene límite de crédito', async () => {
    mockTx.cliente.findFirst.mockResolvedValue({ limiteCredito: null } as never);

    const result = await facturarOfertaAction({
      ofertaId: 'of-1',
      puntoDeVentaId: 'pv-1',
      tipoVencimiento: 'plazo',
    });

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorCobrar.findMany).not.toHaveBeenCalled();
  });
});

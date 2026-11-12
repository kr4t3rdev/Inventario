/**
 * @description Tests F-2: devoluciones a proveedor (DevolucionCompra).
 *
 * Contrato del spec devoluciones-compra:
 * - Crear valida compra origen no ANULADA y cantidad disponible por ítem
 *   (comprada − devuelta − asignada FIFO), fail-closed.
 * - Completar descuenta stock y kardex (DEVOLUCION_COMPRA) e imputa la CxP
 *   o deja saldo a favor; SIN_CXP_PARA_IMPUTAR si no hay CxP.
 * - Anular revierte stock/kardex y restaura la CxP.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/services/stock-ubicacion-queries', () => ({
  getStockTotalProducto: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', () => ({
  registrarMovimiento: vi.fn(),
  revertirMovimientosDeOrigen: vi.fn(),
}));
vi.mock('@/features/contabilidad-formal/services/supplier-return-posting-service', () => ({
  emitirDevolucionCompra: vi.fn(),
}));
vi.mock('@/features/contabilidad-formal/services/reversal-service', () => ({
  reverseFormalEntries: vi.fn(),
}));

const mockTx = {
  $queryRaw: vi.fn(),
  devolucionCompra: {
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  compraDocumento: { findFirst: vi.fn(), findMany: vi.fn() },
  compraDocumentoItem: { findFirst: vi.fn() },
  cuentaPorPagar: { update: vi.fn(), findFirst: vi.fn() },
  pagoCuentaPorPagar: { findFirst: vi.fn() },
  producto: { findUnique: vi.fn(), findFirst: vi.fn() },
  purchaseAllocation: { aggregate: vi.fn(), groupBy: vi.fn() },
  purchaseReceiptInvoiceAllocation: { findMany: vi.fn() },
  devolucionCompraItem: { aggregate: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    devolucionCompra: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    compraDocumento: { findFirst: vi.fn(), findMany: vi.fn() },
    compraDocumentoItem: { findFirst: vi.fn() },
    cuentaPorPagar: { update: vi.fn(), findFirst: vi.fn() },
    pagoCuentaPorPagar: { findFirst: vi.fn() },
    producto: { findUnique: vi.fn(), findFirst: vi.fn() },
    purchaseAllocation: { aggregate: vi.fn(), groupBy: vi.fn() },
    purchaseReceiptInvoiceAllocation: { findMany: vi.fn() },
    devolucionCompraItem: { aggregate: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(mockTx)),
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { getStockTotalProducto } from '@/lib/services/stock-ubicacion-queries';
import {
  registrarMovimiento,
  revertirMovimientosDeOrigen,
} from '@/features/inventario/movimientos';
import {
  anularDevolucionCompraAction,
  completarDevolucionCompraAction,
  crearDevolucionCompraAction,
  getDevolucionesCompraDataAction,
} from '../devoluciones';
import { emitirDevolucionCompra } from '@/features/contabilidad-formal/services/supplier-return-posting-service';
import { reverseFormalEntries } from '@/features/contabilidad-formal/services/reversal-service';

const user = {
  userId: 'user-1',
  role: 'admin',
  tenantId: 'tenant-1',
  tenantRole: 'admin',
  isActive: true,
} as any;

/** Compra origen: 2 ítems de 24 y 10 unidades a 500 y 800. */
const compraOrigen = {
  compraDocumentoId: 'cd-1',
  proveedorId: 'ven-1',
  tenantId: 'tenant-1',
  estado: 'PAGADA',
  deletedAt: null,
  moneda: 'CUP',
  items: [
    {
      compraDocumentoItemId: 'cdi-1',
      productoId: 'prod-1',
      cantidad: 24,
      precioUnitario: 500,
      totalLinea: 12000,
    },
    {
      compraDocumentoItemId: 'cdi-2',
      productoId: 'prod-2',
      cantidad: 10,
      precioUnitario: 800,
      totalLinea: 8000,
    },
  ],
};

describe('F-2: getDevolucionesCompraDataAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(prisma.devolucionCompra.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.compraDocumento.findMany).mockResolvedValue([] as any);
  });

  it('lista devoluciones y compras elegibles aisladas por tenant', async () => {
    const result = await getDevolucionesCompraDataAction();

    expect(result.success).toBe(true);
    expect(prisma.devolucionCompra.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
    expect(prisma.compraDocumento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', deletedAt: null }),
    }));
  });
});

describe('F-2: crearDevolucionCompraAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    } as any);
    mockTx.purchaseReceiptInvoiceAllocation.findMany.mockResolvedValue([] as any);
    mockTx.devolucionCompraItem.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    } as any);
    mockTx.compraDocumento.findFirst.mockResolvedValue(
      compraOrigen as any,
    );
    mockTx.devolucionCompra.count.mockResolvedValue(0);
    mockTx.devolucionCompra.create.mockResolvedValue({
      devolucionId: 'dc-1',
      numero: 'DV-2026-000001',
      estado: 'PENDIENTE',
      montoTotal: 2000,
    } as any);
  });

  it('crea la devolución PENDIENTE con numeración y montos', async () => {
    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'IMPUTACION_CXP',
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 4 }],
    });

    expect(result.success).toBe(true);
    expect(mockTx.devolucionCompra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          compraDocumentoId: 'cd-1',
          proveedorId: compraOrigen.proveedorId,
          estado: 'PENDIENTE',
          montoTotal: 2000, // 4 × 500
          items: {
            create: [
              expect.objectContaining({
                compraDocumentoItemId: 'cdi-1',
                productoId: 'prod-1',
                cantidad: 4,
                costoUnitario: 500,
                total: 2000,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('rechaza compra origen ANULADA', async () => {
    mockTx.compraDocumento.findFirst.mockResolvedValue({
      ...compraOrigen,
      estado: 'ANULADA',
    } as any);

    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('COMPRA_ANULADA');
    expect(mockTx.devolucionCompra.create).not.toHaveBeenCalled();
  });

  it('rechaza cantidad mayor al disponible (comprada − devuelta − asignada FIFO)', async () => {
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({
      _sum: { cantidad: 10 },
    } as any);
    mockTx.devolucionCompraItem.aggregate.mockResolvedValue({
      _sum: { cantidad: 4 },
    } as any);

    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      // 24 − 10 asignadas − 4 devueltas = 10 disponible; pide 11
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 11 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STOCK_DEVUELTO_ASIGNADO');
    expect(mockTx.devolucionCompra.create).not.toHaveBeenCalled();
  });

  it('cuenta como asignadas las ventas desde recibo ligadas por capa de factura', async () => {
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    } as any);
    mockTx.purchaseReceiptInvoiceAllocation.findMany.mockResolvedValue([
      { id: 'layer-1' },
    ] as any);
    mockTx.purchaseAllocation.groupBy.mockResolvedValue([
      { purchaseReceiptInvoiceAllocationId: 'layer-1', _sum: { cantidad: 15 } },
    ] as any);
    mockTx.devolucionCompraItem.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    } as any);

    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      // 24 compradas − 15 vendidas desde recibo = 9 disponibles; pide 10
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STOCK_DEVUELTO_ASIGNADO');
    expect(mockTx.devolucionCompra.create).not.toHaveBeenCalled();
  });

  it('permite devolver justo lo disponible tras ventas desde recibo', async () => {
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    } as any);
    mockTx.purchaseReceiptInvoiceAllocation.findMany.mockResolvedValue([
      { id: 'layer-1' },
    ] as any);
    mockTx.purchaseAllocation.groupBy.mockResolvedValue([
      { purchaseReceiptInvoiceAllocationId: 'layer-1', _sum: { cantidad: 15 } },
    ] as any);

    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 9 }],
    });

    expect(result.success).toBe(true);
  });

  it('rechaza ítem ajeno a la compra', async () => {
    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      items: [{ compraDocumentoItemId: 'cdi-otro', cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('exige el permiso de gestión de compras a quien no sea admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...user,
      role: 'manager',
      permissions: new Set(),
    } as any);

    const result = await crearDevolucionCompraAction({
      compraDocumentoId: 'cd-1',
      formaImputacion: 'SALDO_FAVOR',
      items: [{ compraDocumentoItemId: 'cdi-1', cantidad: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(mockTx.compraDocumento.findFirst).not.toHaveBeenCalled();
  });
});

describe('F-2: completarDevolucionCompraAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } } as any);
    mockTx.purchaseReceiptInvoiceAllocation.findMany.mockResolvedValue([] as any);
    mockTx.devolucionCompraItem.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } } as any);
    mockTx.compraDocumentoItem.findFirst.mockResolvedValue({ cantidad: 24 } as any);
  });

  const devolucionBase = (overrides: Record<string, unknown> = {}) => ({
    devolucionId: 'dc-1',
    tenantId: 'tenant-1',
    estado: 'PENDIENTE',
    formaImputacion: 'IMPUTACION_CXP',
    montoTotal: 2000,
    compraDocumento: {
      compraDocumentoId: 'cd-1',
      cuentaPorPagar: {
        cuentaPorPagarId: 'cxp-1',
        montoDeuda: 12000,
        montoPagado: 0,
        saldoPendiente: 12000,
        estado: 'PENDIENTE',
      },
    },
    items: [
      {
        id: 'dci-1',
        productoId: 'prod-1',
        cantidad: 4,
        costoUnitario: 500,
        total: 2000,
      },
    ],
    ...overrides,
  });

  it('vuelve a validar FIFO al completar una devolución pendiente', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({
        formaImputacion: 'SALDO_FAVOR',
        items: [{
          id: 'dci-1',
          compraDocumentoItemId: 'cdi-1',
          productoId: 'prod-1',
          cantidad: 4,
          costoUnitario: 500,
        }],
      }) as any,
    );
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({ _sum: { cantidad: 21 } } as any);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STOCK_DEVUELTO_ASIGNADO');
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
  });

  it('vuelve a validar al completar las ventas desde recibo ligadas por capa', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({
        formaImputacion: 'SALDO_FAVOR',
        items: [{
          id: 'dci-1',
          compraDocumentoItemId: 'cdi-1',
          productoId: 'prod-1',
          cantidad: 4,
          costoUnitario: 500,
        }],
      }) as any,
    );
    mockTx.purchaseAllocation.aggregate.mockResolvedValue({ _sum: { cantidad: 0 } } as any);
    mockTx.purchaseReceiptInvoiceAllocation.findMany.mockResolvedValue([
      { id: 'layer-1' },
    ] as any);
    mockTx.purchaseAllocation.groupBy.mockResolvedValue([
      { purchaseReceiptInvoiceAllocationId: 'layer-1', _sum: { cantidad: 21 } },
    ] as any);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STOCK_DEVUELTO_ASIGNADO');
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
  });

  it('descuenta stock y kardex DEVOLUCION_COMPRA e imputa la CxP', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(devolucionBase() as any);
    mockTx.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      almacenId: 'alm-1',
    } as any);
    vi.mocked(getStockTotalProducto).mockResolvedValue(20);
    mockTx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1', montoDeuda: 12000, montoPagado: 0, saldoPendiente: 12000,
    } as any);
    mockTx.cuentaPorPagar.update.mockResolvedValue({} as any);
    mockTx.devolucionCompra.update.mockResolvedValue({
      estado: 'COMPLETADA',
      devolucionId: 'dc-1',
      montoTotal: 2000,
      montoImputado: 2000,
      saldoAFavor: 0,
      moneda: 'CUP',
    } as any);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    // Stock: −4 en el almacén del producto
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productoId: 'prod-1',
        modo: 'increment',
        delta: -4,
      }),
    );
    // Kardex append-only con el nuevo tipo de movimiento
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productoId: 'prod-1',
        tipoOrigen: 'DEVOLUCION_COMPRA',
        origenId: 'dc-1',
        cantidad: -4,
        costoUnitario: 500,
      }),
    );
    // Imputación a la CxP: 2000 de 12000
    expect(mockTx.cuentaPorPagar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cuentaPorPagarId: 'cxp-1' },
        data: expect.objectContaining({
          montoDeuda: 10000,
          saldoPendiente: 10000,
          estado: 'PENDIENTE',
        }),
      }),
    );
    expect(mockTx.devolucionCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'COMPLETADA',
          montoImputado: 2000,
          saldoAFavor: 0,
        }),
      }),
    );
    expect(emitirDevolucionCompra).toHaveBeenCalledWith(
      expect.anything(),
      { tenantId: 'tenant-1', userId: 'user-1' },
      expect.objectContaining({
        devolucionId: 'dc-1',
        montoTotal: 2000,
        montoImputado: 2000,
        saldoAFavor: 0,
      }),
    );
  });

  it('falla cerrado sin CxP al pedir IMPUTACION_CXP', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({
        compraDocumento: { compraDocumentoId: 'cd-1', cuentaPorPagar: null },
      }) as any,
    );

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SIN_CXP_PARA_IMPUTAR');
    expect(mockTx.devolucionCompra.update).not.toHaveBeenCalled();
  });

  it('SALDO_FAVOR registra el monto sin tocar CxP', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({ formaImputacion: 'SALDO_FAVOR' }) as any,
    );
    mockTx.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      almacenId: 'alm-1',
    } as any);
    vi.mocked(getStockTotalProducto).mockResolvedValue(20);
    mockTx.devolucionCompra.update.mockResolvedValue({
      estado: 'COMPLETADA',
    } as any);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorPagar.update).not.toHaveBeenCalled();
    expect(mockTx.devolucionCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'COMPLETADA',
          montoImputado: 0,
          saldoAFavor: 2000,
        }),
      }),
    );
  });

  it('falla con STOCK_INSUFICIENTE si el stock no alcanza', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(devolucionBase() as any);
    mockTx.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      almacenId: 'alm-1',
    } as any);
    vi.mocked(getStockTotalProducto).mockResolvedValue(2);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('STOCK_INSUFICIENTE');
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });

  it('es idempotente si ya está COMPLETADA', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({ estado: 'COMPLETADA' }) as any,
    );

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(mockTx.devolucionCompra.update).not.toHaveBeenCalled();
  });

  it('envía a saldo a favor el importe que excede la CxP pendiente', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue(
      devolucionBase({
        montoTotal: 3000,
        compraDocumento: {
          compraDocumentoId: 'cd-1',
          cuentaPorPagar: {
            cuentaPorPagarId: 'cxp-1',
            montoDeuda: 12000,
            montoPagado: 11000,
            saldoPendiente: 1000,
            estado: 'PARCIAL',
          },
        },
      }) as any,
    );
    mockTx.producto.findUnique.mockResolvedValue({ id: 'prod-1', almacenId: 'alm-1' } as any);
    vi.mocked(getStockTotalProducto).mockResolvedValue(20);
    mockTx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1', montoDeuda: 12000, montoPagado: 11000, saldoPendiente: 1000,
    } as any);
    mockTx.cuentaPorPagar.update.mockResolvedValue({} as any);
    mockTx.devolucionCompra.update.mockResolvedValue({ estado: 'COMPLETADA' } as any);

    const result = await completarDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    expect(mockTx.cuentaPorPagar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          montoDeuda: 11000,
          saldoPendiente: 0,
          estado: 'PAGADA',
        }),
      }),
    );
    expect(mockTx.devolucionCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ montoImputado: 1000, saldoAFavor: 2000 }),
      }),
    );
  });
});

describe('F-2: anularDevolucionCompraAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
  });

  it('revierte stock, kardex y CxP de una devolución COMPLETADA', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue({
      devolucionId: 'dc-1',
      tenantId: 'tenant-1',
      estado: 'COMPLETADA',
      montoImputado: 2000,
      completadaAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [
        { id: 'dci-1', productoId: 'prod-1', cantidad: 4, costoUnitario: 500 },
      ],
        compraDocumento: {
          compraDocumentoId: 'cd-1',
          cuentaPorPagar: {
            cuentaPorPagarId: 'cxp-1',
            montoDeuda: 10000,
            montoPagado: 2000,
            saldoPendiente: 8000,
          },
        },
    } as any);
    mockTx.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1', montoDeuda: 10000, montoPagado: 2000, saldoPendiente: 8000,
    } as any);
    mockTx.devolucionCompra.update.mockResolvedValue({
      estado: 'ANULADA',
    } as any);
    mockTx.cuentaPorPagar.update.mockResolvedValue({} as any);

    const result = await anularDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    // Stock restaurado
    expect(upsertStockUbicacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productoId: 'prod-1', delta: 4 }),
    );
    // Kardex: reversión del origen completo
    expect(revertirMovimientosDeOrigen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipoOrigen: 'DEVOLUCION_COMPRA',
        origenId: 'dc-1',
      }),
    );
    expect(reverseFormalEntries).toHaveBeenCalledWith(
      expect.anything(),
      { tenantId: 'tenant-1', userId: 'user-1' },
      [{ tipo: 'devolucion_compra', id: 'dc-1' }],
    );
    // CxP restaurada
    expect(mockTx.cuentaPorPagar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cuentaPorPagarId: 'cxp-1' },
        data: expect.objectContaining({
          montoDeuda: 12000,
          saldoPendiente: 10000,
          estado: 'PARCIAL',
        }),
      }),
    );
    expect(mockTx.devolucionCompra.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'ANULADA' }),
      }),
    );
  });

  it('bloquea la anulación si hubo pagos de CxP después de completar', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue({
      devolucionId: 'dc-1',
      tenantId: 'tenant-1',
      estado: 'COMPLETADA',
      montoImputado: 2000,
      completadaAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [],
      compraDocumento: {
        cuentaPorPagar: { cuentaPorPagarId: 'cxp-1' },
      },
    } as any);
    mockTx.pagoCuentaPorPagar.findFirst.mockResolvedValue({ pagoCuentaPorPagarId: 'pay-1' } as any);

    const result = await anularDevolucionCompraAction('dc-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DEVOLUCION_IMPUTACION_CONSUMIDA');
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(mockTx.devolucionCompra.update).not.toHaveBeenCalled();
  });

  it('anula PENDIENTE sin tocar stock', async () => {
    mockTx.devolucionCompra.findFirst.mockResolvedValue({
      devolucionId: 'dc-1',
      tenantId: 'tenant-1',
      estado: 'PENDIENTE',
      montoImputado: 0,
      items: [],
      compraDocumento: { compraDocumentoId: 'cd-1' },
    } as any);
    mockTx.devolucionCompra.update.mockResolvedValue({
      estado: 'ANULADA',
    } as any);

    const result = await anularDevolucionCompraAction('dc-1');

    expect(result.success).toBe(true);
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
    expect(revertirMovimientosDeOrigen).not.toHaveBeenCalled();
  });
});

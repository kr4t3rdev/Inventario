/**
 * @description Verifies invoice cancellation frees receipt capacity for a replacement invoice.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { reconciliarCostosRecepcionConFactura } from '@/lib/services/reconciliar-costos-recepcion';
import { allocateFifoForSale, restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { anularCompraProductoAction } = await import('@/features/compras-productos/actions');

const prefix = `t4-cancel-${randomUUID().replaceAll('-', '')}`;
const tenantId = `tenant-${prefix}`;
const userId = `user-${prefix}`;
const invoiceIds = [`invoice-${prefix}`, `replacement-${prefix}`];
const categoryId = `category-${prefix}`;
const unitId = `unit-${prefix}`;
const warehouseId = `warehouse-${prefix}`;
const productId = `product-${prefix}`;
const vendorId = `vendor-${prefix}`;
const orderId = `order-${prefix}`;
const orderItemId = `order-item-${prefix}`;
const receiptId = `receipt-${prefix}`;
const receiptItemId = `receipt-item-${prefix}`;
const originalLineId = `original-line-${prefix}`;
const replacementLineId = `replacement-line-${prefix}`;
const originalAllocationId = `original-allocation-${prefix}`;
let actor: AuthenticatedUser;

describe('purchase invoice cancellation and replacement — disposable PostgreSQL', () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{
      databaseName: string;
      roleName: string;
      serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName",
        current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    await prisma.tenant.create({ data: { tenantId, nombre: prefix, slug: prefix } });
    await prisma.user.create({ data: {
      userId,
      name: prefix,
      email: `${prefix}@test.local`,
      password: 'disposable-fixture',
    } });
    await prisma.vendor.create({ data: { vendorId, tenantId, nombre: prefix } });
    await prisma.categoria.create({ data: { catId: categoryId, tenantId, nombre: prefix } });
    await prisma.unidad.create({
      data: { unidadId: unitId, tenantId, nombre: prefix, simbolo: prefix, dimension: 'COUNT' },
    });
    await prisma.almacen.create({ data: { almacenId: warehouseId, tenantId, nombre: prefix } });
    await prisma.puntoDeVenta.create({ data: { pvId: `pv-${prefix}`, tenantId, nombre: prefix } });
    await prisma.producto.create({ data: {
      id: productId,
      tenantId,
      nombre: prefix,
      precioCosto: 100,
      precioVenta: 200,
      stock: 0,
      categoriaId: categoryId,
      unidadId: unitId,
      almacenId: warehouseId,
    } });
    await prisma.ordenCompra.create({ data: { id: orderId, tenantId, proveedorId: vendorId } });
    await prisma.ordenCompraItem.create({ data: {
      id: orderItemId,
      tenantId,
      ordenId: orderId,
      productoId: productId,
      cantidadPedida: 3,
      cantidadRecibida: 3,
      precioUnitario: 100,
    } });
    await prisma.recepcion.create({ data: { id: receiptId, tenantId, ordenId: orderId } });
    await prisma.recepcionItem.create({ data: {
      id: receiptItemId,
      tenantId,
      recepcionId: receiptId,
      ordenItemId: orderItemId,
      productoId: productId,
      cantidad: 3,
      cantidadFacturada: 3,
      montoFacturado: 300,
    } });
    await prisma.compraDocumento.create({ data: {
      compraDocumentoId: invoiceIds[0],
      tenantId,
      proveedorId: vendorId,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      moneda: 'CUP',
      total: 300,
      ordenCompraId: orderId,
    } });
    await prisma.compraDocumentoItem.create({ data: {
      compraDocumentoItemId: originalLineId,
      tenantId,
      compraDocumentoId: invoiceIds[0],
      productoId: productId,
      cantidad: 3,
      precioUnitario: 100,
      totalLinea: 300,
    } });
    await prisma.purchaseReceiptInvoiceAllocation.create({ data: {
      id: originalAllocationId,
      tenantId,
      compraDocumentoItemId: originalLineId,
      recepcionItemId: receiptItemId,
      cantidad: 3,
      costoUnitarioSnapshot: 100,
      fifoMonedaOrigen: 'CUP',
      fifoFechaFuente: new Date('2026-11-01T00:00:00.000Z'),
    } });

    actor = {
      userId,
      name: prefix,
      email: `${prefix}@test.local`,
      role: 'regularUser',
      isActive: true,
      tenantId,
      tenantRole: 'manager',
    } as AuthenticatedUser;
    auth.user = actor;
  });

  afterAll(async () => {
    auth.user = null;
    await prisma.purchaseAllocation.deleteMany({ where: { tenantId } });
    await prisma.purchaseReceiptInvoiceAllocation.deleteMany({ where: { tenantId } });
    await prisma.lote.deleteMany({ where: { tenantId } });
    await prisma.venta.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.compraDocumentoItem.deleteMany({ where: { tenantId } });
    await prisma.compraDocumento.deleteMany({ where: { tenantId } });
    await prisma.recepcionItem.deleteMany({ where: { tenantId } });
    await prisma.recepcion.deleteMany({ where: { tenantId } });
    await prisma.ordenCompraItem.deleteMany({ where: { tenantId } });
    await prisma.ordenCompra.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { id: productId } });
    await prisma.almacen.deleteMany({ where: { almacenId: warehouseId } });
    await prisma.puntoDeVenta.deleteMany({ where: { pvId: `pv-${prefix}` } });
    await prisma.unidad.deleteMany({ where: { unidadId: unitId } });
    await prisma.categoria.deleteMany({ where: { catId: categoryId } });
    await prisma.vendor.deleteMany({ where: { vendorId, tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('keeps cancelled provenance and lets a replacement invoice use the released receipt quantity', async () => {
    const receiptLot = await prisma.lote.create({ data: {
      tenantId,
      productoId: productId,
      codigo: `${prefix}-receipt-lot`,
      cantidadInicial: 3,
      cantidadDisponible: 3,
      recepcionItemId: receiptItemId,
    } });
    const priorSale = await prisma.venta.create({
      data: {
        tenantId,
        cantidad: 1,
        puntoDeVentaId: `pv-${prefix}`,
        total: 200,
        estado: 'FACTURADA',
        metodoPago: 'EFECTIVO',
        esVentaUnica: true,
        items: { create: [{ productoId: productId, cantidad: 1, precioUnitario: 200, total: 200 }] },
      },
      include: { items: true },
    });
    await prisma.purchaseAllocation.create({
      data: {
        tenantId,
        recepcionItemId: receiptItemId,
        purchaseReceiptInvoiceAllocationId: originalAllocationId,
        ventaItemId: priorSale.items[0].id,
        loteId: receiptLot.id,
        cantidad: 1,
      },
    });

    const cancelled = await anularCompraProductoAction({ id: invoiceIds[0] });
    expect(cancelled.success).toBe(true);

    expect(await prisma.recepcionItem.findUniqueOrThrow({ where: { id: receiptItemId } }))
      .toMatchObject({ cantidadFacturada: 0, montoFacturado: 0 });
    expect(await prisma.purchaseReceiptInvoiceAllocation.count({
      where: { tenantId, id: originalAllocationId },
    })).toBe(1);
    expect(await prisma.purchaseAllocation.findFirstOrThrow({
      where: { tenantId, ventaItemId: priorSale.items[0].id },
    })).toMatchObject({
      purchaseReceiptInvoiceAllocationId: originalAllocationId,
      recepcionItemId: receiptItemId,
      cantidad: 1,
    });

    await prisma.compraDocumento.create({ data: {
      compraDocumentoId: invoiceIds[1],
      tenantId,
      proveedorId: vendorId,
      formaPago: 'PAGO_COMPLETO',
      estado: 'PAGADA',
      moneda: 'USD',
      total: 3000,
      fechaCompra: new Date('2026-11-08T00:00:00.000Z'),
      ordenCompraId: orderId,
    } });
    await prisma.compraDocumentoItem.create({ data: {
      compraDocumentoItemId: replacementLineId,
      tenantId,
      compraDocumentoId: invoiceIds[1],
      productoId: productId,
      cantidad: 3,
      precioUnitario: 1000,
      totalLinea: 3000,
    } });
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: '$' },
      update: {},
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    await prisma.$transaction((tx) => reconciliarCostosRecepcionConFactura(tx, {
      tenantId,
      ordenId: orderId,
      fechaFactura: new Date('2026-11-08T00:00:00.000Z'),
      moneda: 'USD',
      tasaCambio: 0.0003333333,
      items: [{
        compraDocumentoItemId: replacementLineId,
        productoId: productId,
        cantidad: 3,
        precioUnitario: 1000,
      }],
    }));

    expect(await prisma.recepcionItem.findUniqueOrThrow({ where: { id: receiptItemId } }))
      .toMatchObject({ cantidadFacturada: 3, montoFacturado: 3000 });
    expect(await prisma.purchaseReceiptInvoiceAllocation.count({
      where: { tenantId, compraDocumentoItemId: replacementLineId, recepcionItemId: receiptItemId },
    })).toBe(1);

    const sale = await prisma.venta.create({
      data: {
        tenantId,
        cantidad: 2,
        puntoDeVentaId: `pv-${prefix}`,
        total: 400,
        estado: 'FACTURADA',
        metodoPago: 'EFECTIVO',
        esVentaUnica: true,
        items: { create: [{ productoId: productId, cantidad: 2, precioUnitario: 200, total: 400 }] },
      },
      include: { items: true },
    });
    await prisma.$transaction((tx) => allocateFifoForSale(tx, tenantId, sale.ventaId));
    const allocated = await prisma.purchaseAllocation.findMany({
      where: { tenantId, ventaItemId: sale.items[0].id },
    });
    expect(allocated).toHaveLength(1);
    expect(allocated[0]).toMatchObject({
      recepcionItemId: receiptItemId,
      purchaseReceiptInvoiceAllocationId: expect.any(String),
      cantidad: 2,
      costoUnitarioSnapshot: 1000,
      fifoMonedaOrigen: 'USD',
      fifoMonedaFuncional: 'CUP',
    });
    expect(allocated[0].fifoCostoFuncional?.toString()).toBe('0.6667');
    expect(allocated[0].fifoEvidenciaFx).toBeTruthy();

    const restoredFunctionalAmounts: number[] = [];
    for (const cantidad of [1, 1]) {
      const restored = await prisma.$transaction((tx) => restaurarAllocacionesFifo(tx, {
        tenantId,
        ventaItemId: sale.items[0].id,
        cantidad,
      }));
      expect(restored.restaurado).toBe(cantidad);
      restoredFunctionalAmounts.push(restored.fuentes[0].montoFuncional ?? 0);
    }
    expect(restoredFunctionalAmounts).toEqual([0.3334, 0.3333]);
    expect(restoredFunctionalAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(0.6667);
    expect(await prisma.purchaseAllocation.count({ where: { tenantId, ventaItemId: sale.items[0].id } }))
      .toBe(0);
  });
});

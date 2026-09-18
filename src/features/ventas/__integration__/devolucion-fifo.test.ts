/**
 * @description Test de integración real (DNC-T3.4): dos compras del mismo
 * producto a costos distintos, una venta que cruza ambos lotes y una
 * devolución parcial. Verifica stock reintegrado, allocations restauradas en
 * orden FIFO, kardex con costo ponderado, NC con serie propia, cascada
 * financiera (CxC + saldo a favor) y replay idempotente.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { DevolucionVentaService } from '@/features/ventas/services/devolucion-venta-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const stamp = Date.now();
const nuevosIds: { tenantIds: string[] } = { tenantIds: [] };

/**
 * @description Crea el escenario: compra de 3 unidades a 100 y otra de 2 a 300;
 * venta de 4 unidades (cruza ambos lotes) con factura y CxC parcialmente paga.
 */
async function crearEscenario() {
  const tenant = await prisma.tenant.create({
    data: { nombre: `T-DNC ${stamp}`, slug: `t-dnc-${stamp}` },
  });
  nuevosIds.tenantIds.push(tenant.tenantId);
  const tenantId = tenant.tenantId;

  const user = await prisma.user.create({
    data: { name: 'Tester DNC', email: `dnc-${stamp}@test.local`, password: 'x' },
  });
  const categoria = await prisma.categoria.create({
    data: { nombre: `Cat ${stamp}`, tenantId },
  });
  const almacen = await prisma.almacen.create({
    data: { nombre: `Alm ${stamp}`, tenantId },
  });
  const pv = await prisma.puntoDeVenta.create({
    data: { nombre: `PV ${stamp}`, tenantId },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: 'Prod DNC',
      precioCosto: 100,
      precioVenta: 500,
      stock: 5,
      tenant: { connect: { tenantId } },
      categoria: { connect: { catId: categoria.catId } },
      almacen: { connect: { almacenId: almacen.almacenId } },
    },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: 'Cliente DNC', tenantId },
  });

  // Lote A: 3 uds a costo 100. Lote B: 2 uds a costo 300.
  const vendor = await prisma.vendor.create({
    data: { nombre: `Proveedor ${stamp}`, tenantId },
  });
  const compraA = await prisma.compraDocumento.create({
    data: {
      tenantId,
      proveedorId: vendor.vendorId,
      formaPago: 'EFECTIVO',
      estado: 'RECIBIDA',
    },
  });
  const compraB = await prisma.compraDocumento.create({
    data: {
      tenantId,
      proveedorId: vendor.vendorId,
      formaPago: 'EFECTIVO',
      estado: 'RECIBIDA',
    },
  });
  const itemA = await prisma.compraDocumentoItem.create({
    data: {
      compraDocumentoId: compraA.compraDocumentoId,
      tenantId,
      productoId: producto.id,
      cantidad: 3,
      precioUnitario: 100,
      totalLinea: 300,
      createdAt: new Date('2026-09-01T00:00:00Z'),
    },
  });
  const itemB = await prisma.compraDocumentoItem.create({
    data: {
      compraDocumentoId: compraB.compraDocumentoId,
      tenantId,
      productoId: producto.id,
      cantidad: 2,
      precioUnitario: 300,
      totalLinea: 600,
      createdAt: new Date('2026-09-02T00:00:00Z'),
    },
  });

  const venta = await prisma.venta.create({
    data: {
      tenantId,
      cantidad: 4,
      puntoDeVentaId: pv.pvId,
      clienteId: cliente.clienteId,
      total: 2000,
      estado: 'FACTURADA',
      metodoPago: 'CREDITO',
      esVentaUnica: true,
      items: {
        create: [
          { productoId: producto.id, cantidad: 4, precioUnitario: 500, total: 2000 },
        ],
      },
    },
    include: { items: true },
  });
  const ventaItem = venta.items[0];

  // Allocations de la venta: 3 del lote A + 1 del lote B (como haría allocateFIFO).
  await prisma.purchaseAllocation.createMany({
    data: [
      { tenantId, compraDocumentoItemId: itemA.compraDocumentoItemId, ventaItemId: ventaItem.id, cantidad: 3 },
      { tenantId, compraDocumentoItemId: itemB.compraDocumentoItemId, ventaItemId: ventaItem.id, cantidad: 1 },
    ],
  });

  // Factura + CxC con pago parcial (deuda 2000, pagado 400 → saldo 1600).
  const serie = await prisma.serieFacturacion.create({
    data: {
      tenantId,
      prefijo: 'FV',
      descripcion: 'Ventas',
      consecutivo: 2,
      esPorDefecto: true,
    },
  });
  const factura = await prisma.factura.create({
    data: {
      tenantId,
      serieId: serie.serieId,
      numeroConsecutivo: 1,
      numeroFactura: 'FV-000001',
      clienteId: cliente.clienteId,
      ventaId: venta.ventaId,
      subtotal: 2000,
      total: 2000,
      tasaCambio: 12.5,
      estado: 'PENDIENTE',
      creadoPor: user.userId,
    },
  });
  const cxc = await prisma.cuentaPorCobrar.create({
    data: {
      tenantId,
      clienteId: cliente.clienteId,
      facturaId: factura.idFactura,
      montoDeuda: 2000,
      montoPagado: 400,
      estado: 'PARCIAL',
    },
  });

  // Stock del PV reducido por la venta (5 comprados - 4 vendidos = 1).
  await prisma.stockUbicacion.create({
    data: {
      tenantId,
      productoId: producto.id,
      tipoUbicacion: 'punto_venta',
      ubicacionId: pv.pvId,
      cantidad: 5,
      cantidadDisponible: 1,
    },
  });

  return { tenantId, user, producto, venta, ventaItem, factura, cxc, pv };
}

describe('devolución FIFO con NC e idempotencia (integración real)', { timeout: 60_000 }, () => {
  afterAll(async () => {
    // Limpieza opcional: la base es descartable; se deja el rastro para inspección.
    await prisma.$disconnect();
  });

  it('devuelve 2 unidades y aplica toda la cadena de efectos', async () => {
    const { tenantId, user, venta } = await crearEscenario();

    const userCtx = {
      userId: user.userId,
      role: 'admin',
      tenantId,
      isActive: true,
    } as unknown as AuthenticatedUser;

    const key = crypto.randomUUID();
    const r1 = await DevolucionVentaService.registrar({
      input: {
        ventaId: venta.ventaId,
        items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }],
        motivo: 'Devolución parcial de prueba',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: key,
      },
      user: userCtx,
    });

    // NC emitida con serie propia y tasa histórica
    expect(r1.notaCreditoId).toBeTruthy();
    const nc = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: r1.notaCreditoId as string },
    });
    expect(nc.tipoDocumento).toBe('NOTA_CREDITO');
    expect(nc.numeroFactura).toBe('NC-000001');
    expect(nc.estado).toBe('PAGADA');
    expect(Number(nc.tasaCambio)).toBe(12.5);
    expect(Number(nc.total)).toBe(1000);

    // Stock reintegrado al punto de venta
    const stock = await prisma.stockUbicacion.findFirstOrThrow({
      where: { tenantId, tipoUbicacion: 'punto_venta', ubicacionId: venta.puntoDeVentaId },
    });
    expect(stock.cantidadDisponible).toBe(3); // 1 + 2 devueltas

    // FIFO: el lote viejo recupera sus unidades primero (allocation pasa 3 → 1);
    // el lote nuevo queda intacto (1). Las devueltas quedan asociadas al lote barato.
    const allocA = await prisma.purchaseAllocation.findFirstOrThrow({
      where: { tenantId, compraDocumentoItemId: (await prisma.compraDocumentoItem.findFirstOrThrow({ where: { compraDocumento: { tenantId }, cantidad: 3 } })).compraDocumentoItemId },
    });
    expect(allocA.cantidad).toBe(1);

    // Kardex: línea positiva ligada a la devolución con costo ponderado 100
    const kardex = await prisma.stockMoveLine.findMany({
      where: { tenantId, origenId: r1.devolucionId, tipoOrigen: 'VENTA' },
    });
    expect(kardex.length).toBe(1);
    expect(kardex[0].cantidad).toBe(2);
    expect(kardex[0].costoUnitario).toBe(100);

    // CxC reducida: pagado 400 + aplicado 1000 → 1400... resto saldo a favor
    // total devolución 1000, saldo era 1600 → aplicado 1000, sin excedente
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { tenantId },
    });
    expect(Number(cxc.montoPagado)).toBe(1400);
    expect(r1.aplicadoCxc).toBe(1000);
    expect(r1.saldoFavor).toBe(0);

    // Replay idempotente: misma clave → misma devolución, sin duplicar efectos
    const r2 = await DevolucionVentaService.registrar({
      input: {
        ventaId: venta.ventaId,
        items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }],
        motivo: 'Reintento',
        preferenciaFinanciera: 'SALDO_FAVOR',
        idempotencyKey: key,
      },
      user: userCtx,
    });
    expect(r2.devolucionId).toBe(r1.devolucionId);
    expect(r2.repetida).toBe(true);

    const devoluciones = await prisma.devolucionVenta.findMany({ where: { tenantId } });
    expect(devoluciones).toHaveLength(1);
    const kardexTotal = await prisma.stockMoveLine.count({
      where: { tenantId, origenId: r1.devolucionId },
    });
    expect(kardexTotal).toBe(1);
  });
});

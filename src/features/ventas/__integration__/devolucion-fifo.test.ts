/**
 * @description Test de integración real (DNC-T3.4): dos compras del mismo
 * producto a costos distintos, una venta que cruza ambos lotes y una
 * devolución parcial. Verifica stock reintegrado, allocations restauradas en
 * orden FIFO, kardex con costo ponderado, NC con serie propia, cascada
 * financiera (CxC + saldo a favor) y replay idempotente.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence, buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { DevolucionVentaService } from '@/features/ventas/services/devolucion-venta-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const stamp = Date.now();
const nuevosIds: { tenantIds: string[] } = { tenantIds: [] };

/**
 * @description Crea el escenario: compra de 3 unidades a 100 y otra de 2 a 300;
 * venta de 4 unidades (cruza ambos lotes) con factura y CxC parcialmente paga.
 */
async function crearEscenario() {
  const scenarioId = crypto.randomUUID();
  const tenant = await prisma.tenant.create({
    data: { nombre: `T-DNC ${stamp}`, slug: `t-dnc-${stamp}-${scenarioId}` },
  });
  nuevosIds.tenantIds.push(tenant.tenantId);
  const tenantId = tenant.tenantId;

  const user = await prisma.user.create({
    data: { name: 'Tester DNC', email: `dnc-${stamp}-${scenarioId}@test.local`, password: 'x' },
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

  it('reintenta toda la transacción tras SQLSTATE 40001 después del progreso FIFO', async () => {
    const { tenantId, user, venta, producto, pv } = await crearEscenario();
    const userCtx = {
      userId: user.userId,
      role: 'admin',
      tenantId,
      isActive: true,
    } as unknown as AuthenticatedUser;
    const key = crypto.randomUUID();
    const faultId = crypto.randomUUID().replaceAll('-', '');
    const sequenceName = `r15_retry_${faultId}`;
    const functionName = `r15_retry_fn_${faultId}`;
    const triggerName = `r15_retry_trg_${faultId}`;

    // nextval no revierte con la transacción: fuerza exactamente un 40001 en
    // el INSERT del kardex, después de restaurar FIFO y actualizar stock.
    try {
      await prisma.$executeRawUnsafe(`CREATE SEQUENCE "${sequenceName}" START 1`);
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
        BEGIN
          IF nextval('"${sequenceName}"') = 1 THEN
            RAISE EXCEPTION 'injected serialization conflict after FIFO progress'
              USING ERRCODE = '40001';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "StockMoveLine"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
      `);

      const input = {
        ventaId: venta.ventaId,
        items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }],
        motivo: 'Retry SQLSTATE de prueba',
        preferenciaFinanciera: 'SALDO_FAVOR' as const,
        idempotencyKey: key,
      };
      const result = await DevolucionVentaService.registrar({ input, user: userCtx });

      expect(await prisma.$queryRawUnsafe<Array<{ last_value: bigint }>>(
        `SELECT last_value FROM "${sequenceName}"`,
      )).toEqual([{ last_value: BigInt(2) }]);
      expect(await prisma.devolucionVenta.count({ where: { tenantId } })).toBe(1);
      expect(await prisma.devolucionVentaItem.count({ where: { devolucionId: result.devolucionId } })).toBe(1);
      expect(await prisma.stockMoveLine.count({ where: { origenId: result.devolucionId } })).toBe(1);
      expect(await prisma.factura.count({ where: { tenantId, tipoDocumento: 'NOTA_CREDITO' } })).toBe(1);
      expect(Number((await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } })).montoPagado)).toBe(1400);

      const stock = await prisma.stockUbicacion.findFirstOrThrow({
        where: { tenantId, productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: pv.pvId },
      });
      expect(stock.cantidadDisponible).toBe(3);
      const allocations = await prisma.purchaseAllocation.findMany({
        where: { tenantId, ventaItemId: venta.items[0].id },
        orderBy: { compraDocumentoItem: { createdAt: 'asc' } },
      });
      expect(allocations.map(({ cantidad }) => cantidad)).toEqual([1, 1]);

      const replay = await DevolucionVentaService.registrar({ input, user: userCtx });
      expect(replay.devolucionId).toBe(result.devolucionId);
      expect(replay.repetida).toBe(true);
      expect(await prisma.stockMoveLine.count({ where: { origenId: result.devolucionId } })).toBe(1);
      expect(Number((await prisma.cuentaPorCobrar.findFirstOrThrow({ where: { tenantId } })).montoPagado)).toBe(1400);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "StockMoveLine"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
      await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${sequenceName}"`);
    }
  });

  it('hereda FX del snapshot CxC y revierte ingreso/COGS con asientos balanceados', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const scenarioId = crypto.randomUUID();
    const tenant = await prisma.tenant.create({
      data: { nombre: `T-DNC-FX ${scenarioId}`, slug: `t-dnc-fx-${scenarioId}` },
    });
    nuevosIds.tenantIds.push(tenant.tenantId);
    const tenantId = tenant.tenantId;
    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      update: {},
    });
    const user = await prisma.user.create({
      data: {
        name: 'Tester DNC FX',
        email: `dnc-fx-${scenarioId}@test.local`,
        password: 'integration-test-only',
      },
    });
    const [categoria, almacen, pv, cliente, proveedor] = await Promise.all([
      prisma.categoria.create({ data: { nombre: `DNC FX Cat ${scenarioId}`, tenantId } }),
      prisma.almacen.create({ data: { nombre: `DNC FX Alm ${scenarioId}`, tenantId } }),
      prisma.puntoDeVenta.create({ data: { nombre: `DNC FX PV ${scenarioId}`, tenantId } }),
      prisma.cliente.create({ data: { nombre: `DNC FX Cliente ${scenarioId}`, tenantId } }),
      prisma.vendor.create({ data: { nombre: `DNC FX Vendor ${scenarioId}`, tenantId } }),
    ]);
    const producto = await prisma.producto.create({
      data: {
        tenantId,
        nombre: `DNC FX Producto ${scenarioId}`,
        precioCosto: 100,
        precioVenta: 500,
        stock: 1,
        categoriaId: categoria.catId,
        almacenId: almacen.almacenId,
      },
    });

    await prisma.$transaction(async (tx) => {
      await seedPlantillasGlobales(tx);
      await seedPlanContable(tx, tenantId);
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: user.userId },
    });
    await prisma.tenantLicense.create({
      data: {
        tenantId,
        activa: true,
        expiracion: new Date('2099-01-01T00:00:00Z'),
        features: { 'contabilidad-formal': true },
      },
    });
    const now = new Date();
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
      },
    });

    const tasaVigente = new Date('2026-09-30T00:00:00Z');
    const compraAEvidencia = buildAppliedFxEvidence({
      originalAmount: 300,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 7200,
      rateEffectiveAt: tasaVigente,
      source: 'accounting-reconciliation-service',
    });
    const compraBEvidencia = buildAppliedFxEvidence({
      originalAmount: 600,
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: 24,
      convertedAmount: 14400,
      rateEffectiveAt: tasaVigente,
      source: 'accounting-reconciliation-service',
    });
    const compraA = await prisma.compraDocumento.create({
      data: {
        tenantId,
        proveedorId: proveedor.vendorId,
        formaPago: 'PAGO_COMPLETO',
        moneda: 'USD',
        tasaCambio: 24,
        montoConvertido: 7200,
        functionalCurrency: 'CUP',
        rateEffectiveAt: tasaVigente,
        fxProvenanceKind: compraAEvidencia.fxProvenanceKind,
        fxProvenanceSource: compraAEvidencia.fxProvenanceSource,
        fxCatalogRateId: compraAEvidencia.fxCatalogRateId,
        fxEvidenceFingerprint: compraAEvidencia.fxEvidenceFingerprint,
        fxEvidenceVersion: compraAEvidencia.fxEvidenceVersion,
        estado: 'RECIBIDA',
        total: 300,
      },
    });
    const compraB = await prisma.compraDocumento.create({
      data: {
        tenantId,
        proveedorId: proveedor.vendorId,
        formaPago: 'PAGO_COMPLETO',
        moneda: 'USD',
        tasaCambio: 24,
        montoConvertido: 14400,
        functionalCurrency: 'CUP',
        rateEffectiveAt: tasaVigente,
        fxProvenanceKind: compraBEvidencia.fxProvenanceKind,
        fxProvenanceSource: compraBEvidencia.fxProvenanceSource,
        fxCatalogRateId: compraBEvidencia.fxCatalogRateId,
        fxEvidenceFingerprint: compraBEvidencia.fxEvidenceFingerprint,
        fxEvidenceVersion: compraBEvidencia.fxEvidenceVersion,
        estado: 'RECIBIDA',
        total: 600,
      },
    });
    const [itemA, itemB] = await Promise.all([
      prisma.compraDocumentoItem.create({
        data: {
          tenantId,
          compraDocumentoId: compraA.compraDocumentoId,
          productoId: producto.id,
          cantidad: 3,
          precioUnitario: 100,
          totalLinea: 300,
          createdAt: new Date('2026-09-01T00:00:00Z'),
        },
      }),
      prisma.compraDocumentoItem.create({
        data: {
          tenantId,
          compraDocumentoId: compraB.compraDocumentoId,
          productoId: producto.id,
          cantidad: 2,
          precioUnitario: 300,
          totalLinea: 600,
          createdAt: new Date('2026-09-02T00:00:00Z'),
        },
      }),
    ]);
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
        items: { create: [{ productoId: producto.id, cantidad: 4, precioUnitario: 500, total: 2000 }] },
      },
      include: { items: true },
    });
    const ventaItem = venta.items[0];
    await prisma.purchaseAllocation.createMany({
      data: [
        { tenantId, compraDocumentoItemId: itemA.compraDocumentoItemId, ventaItemId: ventaItem.id, cantidad: 3 },
        { tenantId, compraDocumentoItemId: itemB.compraDocumentoItemId, ventaItemId: ventaItem.id, cantidad: 1 },
      ],
    });
    const serie = await prisma.serieFacturacion.create({
      data: { tenantId, prefijo: 'FVFX', descripcion: 'Facturas FX', consecutivo: 2 },
    });
    const factura = await prisma.factura.create({
      data: {
        tenantId,
        serieId: serie.serieId,
        numeroConsecutivo: 1,
        numeroFactura: `FVFX-${scenarioId.slice(0, 8)}`,
        clienteId: cliente.clienteId,
        ventaId: venta.ventaId,
        subtotal: 2000,
        total: 2000,
        estado: 'PENDIENTE',
        creadoPor: user.userId,
      },
    });
    const snapshot = buildAppliedFxEvidenceExact({
      originalAmount: '2000',
      originalCurrency: 'USD',
      functionalCurrency: 'CUP',
      exchangeRate: '24',
      convertedAmount: '48000',
      rateEffectiveAt: tasaVigente,
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: 'rate-usd-return',
      fxProvenanceKind: 'CATALOG_RATE',
    });
    await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: cliente.clienteId,
        facturaId: factura.idFactura,
        montoDeuda: 2000,
        montoPagado: 400,
        montoPagadoFuncional: 9600,
        estado: 'PARCIAL',
        monedaOriginal: 'USD',
        montoOriginal: 2000,
        montoDeudaFuncional: 48000,
        monedaFuncional: 'CUP',
        tasaCambio: 24,
        rateEffectiveAt: snapshot.rateEffectiveAt,
        fxProvenanceKind: snapshot.evidence.fxProvenanceKind,
        fxProvenanceSource: snapshot.evidence.fxProvenanceSource,
        fxCatalogRateId: snapshot.evidence.fxCatalogRateId,
        fxEvidenceJson: snapshot.evidence as never,
        fxEvidenceFingerprint: snapshot.evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: snapshot.evidence.fxEvidenceVersion,
      },
    });
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
    const userCtx = {
      userId: user.userId,
      role: 'admin',
      tenantId,
      isActive: true,
    } as unknown as AuthenticatedUser;

    try {
      const result = await DevolucionVentaService.registrar({
        input: {
          ventaId: venta.ventaId,
          items: [{ ventaItemId: ventaItem.id, cantidad: 2 }],
          motivo: 'Devolución FX parcial',
          preferenciaFinanciera: 'SALDO_FAVOR',
          idempotencyKey: crypto.randomUUID(),
        },
        user: userCtx,
      });

      const devolucion = await prisma.devolucionVenta.findUniqueOrThrow({
        where: { devolucionId: result.devolucionId },
      });
      expect(devolucion.moneda).toBe('USD');
      expect(devolucion.tasaCambio?.eq(new Prisma.Decimal('24'))).toBe(true);
      const asiento = await prisma.asiento.findFirstOrThrow({
        where: { tenantId, origenTipo: 'devolucion_venta', origenId: result.devolucionId },
        include: { lineas: true },
      });
      const ingreso = asiento.lineas.filter((linea) => linea.monedaOriginal === 'USD');
      const costo = asiento.lineas.filter((linea) => linea.monedaOriginal === 'CUP');
      expect(ingreso).toHaveLength(2);
      expect(ingreso.every((linea) =>
        linea.montoOriginal.eq(new Prisma.Decimal('1000')) &&
        linea.tasaCambio?.eq(new Prisma.Decimal('24')) &&
        linea.fxEvidenceFingerprint === snapshot.evidence.fxEvidenceFingerprint,
      )).toBe(true);
      expect(costo).toHaveLength(2);
      expect(costo.reduce((sum, linea) => sum.add(linea.debe), new Prisma.Decimal(0))
        .eq(new Prisma.Decimal('4800'))).toBe(true);
      const debe = asiento.lineas.reduce((sum, linea) => sum.add(linea.debe), new Prisma.Decimal(0));
      const haber = asiento.lineas.reduce((sum, linea) => sum.add(linea.haber), new Prisma.Decimal(0));
      expect(debe.eq(haber)).toBe(true);
      const cxcActualizada = await prisma.cuentaPorCobrar.findFirstOrThrow({
        where: { facturaId: factura.idFactura },
      });
      expect(Number(cxcActualizada.montoPagado)).toBe(1400);
      expect(cxcActualizada.montoPagadoFuncional?.eq(new Prisma.Decimal('33600'))).toBe(true);

      const triggerSuffix = crypto.randomUUID().replaceAll('-', '');
      const functionName = `dnc_fx_fail_${triggerSuffix}_fn`;
      const triggerName = `dnc_fx_fail_${triggerSuffix}`;
      await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW."origenTipo" = 'devolucion_venta' THEN
            RAISE EXCEPTION 'forced devolución formal posting failure' USING ERRCODE = '22012';
          END IF;
          RETURN NEW;
        END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "asientos"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
      try {
        const before = {
          devoluciones: await prisma.devolucionVenta.count({ where: { tenantId } }),
          items: await prisma.devolucionVentaItem.count({ where: { devolucion: { tenantId } } }),
          kardex: await prisma.stockMoveLine.count({ where: { tenantId, tipoOrigen: 'VENTA' } }),
          asiento: await prisma.asiento.count({ where: { tenantId, origenTipo: 'devolucion_venta' } }),
          pagado: cxcActualizada.montoPagado,
          pagadoFuncional: cxcActualizada.montoPagadoFuncional,
        };
        await expect(DevolucionVentaService.registrar({
          input: {
            ventaId: venta.ventaId,
            items: [{ ventaItemId: ventaItem.id, cantidad: 1 }],
            motivo: 'Rollback SQL de devolución FX',
            preferenciaFinanciera: 'SALDO_FAVOR',
            idempotencyKey: crypto.randomUUID(),
          },
          user: userCtx,
        })).rejects.toThrow('forced devolución formal posting failure');
        expect(await prisma.devolucionVenta.count({ where: { tenantId } })).toBe(before.devoluciones);
        expect(await prisma.devolucionVentaItem.count({ where: { devolucion: { tenantId } } }))
          .toBe(before.items);
        expect(await prisma.stockMoveLine.count({ where: { tenantId, tipoOrigen: 'VENTA' } }))
          .toBe(before.kardex);
        expect(await prisma.asiento.count({ where: { tenantId, origenTipo: 'devolucion_venta' } }))
          .toBe(before.asiento);
        const cxcPostFallo = await prisma.cuentaPorCobrar.findFirstOrThrow({
          where: { facturaId: factura.idFactura },
        });
        expect(cxcPostFallo.montoPagado.eq(before.pagado)).toBe(true);
        expect(cxcPostFallo.montoPagadoFuncional?.eq(before.pagadoFuncional!)).toBe(true);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "asientos"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
      }
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });

  it('enforce rechaza CxC histórica sin snapshot y no usa Factura.tasaCambio aislada', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    try {
      const { tenantId, user, venta } = await crearEscenario();
      await prisma.tenantAccountingPolicy.create({
        data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: user.userId },
      });
      const userCtx = {
        userId: user.userId,
        role: 'admin',
        tenantId,
        isActive: true,
      } as unknown as AuthenticatedUser;

      await expect(DevolucionVentaService.registrar({
        input: {
          ventaId: venta.ventaId,
          items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }],
          motivo: 'Histórico sin FX',
          preferenciaFinanciera: 'SALDO_FAVOR',
          idempotencyKey: crypto.randomUUID(),
        },
        user: userCtx,
      })).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });

      expect(await prisma.devolucionVenta.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.devolucionVentaItem.count({ where: { devolucion: { tenantId } } })).toBe(0);
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });

  it('shadow conserva devolución histórica sin FX y deja causa durable en el outbox', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    try {
      const { tenantId, user, venta } = await crearEscenario();
      await prisma.tenantAccountingPolicy.create({
        data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: user.userId },
      });
      await prisma.tenantLicense.create({
        data: {
          tenantId,
          activa: true,
          expiracion: new Date('2099-01-01T00:00:00Z'),
          features: { 'contabilidad-formal': true },
        },
      });
      const userCtx = {
        userId: user.userId,
        role: 'admin',
        tenantId,
        isActive: true,
      } as unknown as AuthenticatedUser;

      const result = await DevolucionVentaService.registrar({
        input: {
          ventaId: venta.ventaId,
          items: [{ ventaItemId: venta.items[0].id, cantidad: 2 }],
          motivo: 'Histórico sin FX en shadow',
          preferenciaFinanciera: 'SALDO_FAVOR',
          idempotencyKey: crypto.randomUUID(),
        },
        user: userCtx,
      });

      expect(result.devolucionId).toBeTruthy();
      const outbox = await prisma.shadowPosteoOutbox.findFirstOrThrow({
        where: {
          tenantId,
          tipoEvento: 'DEVOLUCION_VENTA',
          origenTipo: 'devolucion_venta',
          origenId: result.devolucionId,
        },
      });
      expect(outbox.estado).toBe('ERROR_SHADOW');
      expect(outbox.causa).toContain('valoración monetaria');
      expect(await prisma.asiento.count({
        where: { tenantId, origenTipo: 'devolucion_venta', origenId: result.devolucionId },
      })).toBe(0);
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });
});

import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { backfillStockMoves } from '../../../prisma/scripts/backfill-stock-move'

/**
 * @description Integración real del backfill del kardex contra PostgreSQL.
 * Verifica: idempotencia del backfill y paridad sum(StockMoveLine) == StockUbicacion.
 * Solo corre con `pnpm test:integration` (DATABASE_URL_TEST real).
 */
describe('Backfill de kardex (integración)', { timeout: 60_000 }, () => {
  const tenantTag = `bf-${Date.now()}`
  let tenantId: string

  afterEach(async () => {
    if (!tenantId) return
    await prisma.$executeRaw`DELETE FROM "StockMoveLine" WHERE "tenantId" = ${tenantId}` // @ts-expect-error Prisma raw query typing is narrower in integration tests.
    await prisma.$executeRaw`DELETE FROM "StockUbicacion" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "VentaItem" WHERE "productoId" IN (SELECT id FROM "Producto" WHERE "tenantId" = ${tenantId})`
    await prisma.$executeRaw`DELETE FROM "Venta" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "CompraDocumentoItem" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "CompraDocumento" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Transferencia" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Merma" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Producto" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Vendor" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Almacen" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "Categoria" WHERE "tenantId" = ${tenantId}`
    await prisma.$executeRaw`DELETE FROM "tenants" WHERE "tenantId" = ${tenantId}`
  })

  it('puebla el kardex desde documentos y cuadra con StockUbicacion', async () => {
    const tenant = await prisma.tenant.create({
      data: { nombre: `Backfill ${tenantTag}`, slug: tenantTag },
    })
    tenantId = tenant.tenantId

    const categoria = await prisma.categoria.create({
      data: { nombre: `Cat ${tenantTag}`, tenantId },
    })
    const almacen = await prisma.almacen.create({
      data: { nombre: `Alm ${tenantTag}`, tenantId },
    })
    const vendor = await prisma.vendor.create({
      data: { nombre: `Vendor ${tenantTag}`, tenantId },
    })
    const producto = await prisma.producto.create({
      data: {
        nombre: `Prod ${tenantTag}`,
        precioCosto: 100,
        precioVenta: 150,
        stock: 0,
        categoriaId: categoria.catId,
        almacenId: almacen.almacenId,
        tenantId,
      },
    })

    // Compra +10
    const compra = await prisma.compraDocumento.create({
      data: {
        tenantId,
        proveedorId: vendor.vendorId,
        numeroFactura: 'F-1',
        facturaUrl: '',
        formaPago: 'PAGO_COMPLETO',
        estado: 'PAGADA',
        total: 1000,
        items: {
          create: [{
            tenantId,
            productoId: producto.id,
            cantidad: 10,
            precioUnitario: 100,
            totalLinea: 1000,
          }],
        },
      },
    })

    // Merma -2
    await prisma.merma.create({
      data: {
        tenantId,
        productoId: producto.id,
        cantidad: 2,
        costoTotal: 200,
        almacenId: almacen.almacenId,
      },
    })

    // Transferencia completada -3 del almacén al PV ficticio (se registra el kardex;
    // el destino es un PV real para no violar FKs)
    const pv = await prisma.puntoDeVenta.create({
      data: { nombre: `PV ${tenantTag}`, tenantId, almacenId: almacen.almacenId },
    })
    await prisma.transferencia.create({
      data: {
        tenantId,
        productoId: producto.id,
        cantidad: 3,
        origenId: almacen.almacenId,
        puntoDeVentaDestinoId: pv.pvId,
        estado: 'COMPLETADA',
        costoUnitario: 100,
        costoTotal: 300,
      },
    })

    // StockUbicacion materializado coherentemente: almacén 5, PV 3
    await prisma.stockUbicacion.create({
      data: {
        tenantId,
        productoId: producto.id,
        tipoUbicacion: 'almacen',
        ubicacionId: almacen.almacenId,
        cantidad: 5,
        cantidadDisponible: 5,
      },
    })
    await prisma.stockUbicacion.create({
      data: {
        tenantId,
        productoId: producto.id,
        tipoUbicacion: 'punto_venta',
        ubicacionId: pv.pvId,
        cantidad: 3,
        cantidadDisponible: 3,
      },
    })

    const pasada1 = await backfillStockMoves(tenantId)
    expect(pasada1.compras).toBe(1)
    expect(pasada1.mermas).toBe(1)
    expect(pasada1.transferencias).toBe(2)
    expect(pasada1.errores).toHaveLength(0)

    // Idempotencia: una segunda pasada no debe crear duplicados
    await backfillStockMoves(tenantId)
    const [total] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM "StockMoveLine" WHERE "tenantId" = ${tenantId}
    `
    expect(Number(total.total)).toBe(4)

    // Paridad: suma del kardex por ubicación == StockUbicacion.cantidad
    const almacenSuma = await prisma.$queryRaw<{ suma: bigint }[]>`
      SELECT COALESCE(SUM("cantidad"), 0)::bigint AS suma
      FROM "StockMoveLine"
      WHERE "tenantId" = ${tenantId} AND "tipoUbicacion" = 'almacen'
    `
    const pvSuma = await prisma.$queryRaw<{ suma: bigint }[]>`
      SELECT COALESCE(SUM("cantidad"), 0)::bigint AS suma
      FROM "StockMoveLine"
      WHERE "tenantId" = ${tenantId} AND "tipoUbicacion" = 'punto_venta'
    `
    expect(Number(almacenSuma[0].suma)).toBe(5)
    expect(Number(pvSuma[0].suma)).toBe(3)

    // Inmutabilidad: la tabla debe rechazar UPDATE/DELETE
    await expect(
      prisma.$executeRaw`UPDATE "StockMoveLine" SET "cantidad" = 999 WHERE "tenantId" = ${tenantId} LIMIT 1`,
    ).rejects.toThrow()
    await expect(
      prisma.$executeRaw`DELETE FROM "StockMoveLine" WHERE "tenantId" = ${tenantId}`,
    ).rejects.toThrow()
  })
})

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireTenant } from "@/lib/services/tenant-scope"
import { Prisma } from "@/generated/prisma"
import {
  applyFacturacionCobroWorkflow,
  reconciliarVentaDirecta,
} from "@/features/ventas/services/facturacion-workflow"
import {
  applyAnticipoAllocations,
  isAnticipoWorkflowError,
} from "@/lib/services/anticipos-workflow"
import { upsertStockUbicacion } from "@/lib/services/stock-ubicacion-service"
import type { AuthenticatedUser } from "@/lib/auth-middleware"

async function invalidateDashboardCache() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    await fetch(`${baseUrl}/api/dashboard/stats`, { method: 'DELETE' })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
  }
}

async function resolverPrecioVenta(
  listaPrecioId: string | null | undefined,
  productoId: string,
  precioBase: number,
): Promise<number> {
  if (!listaPrecioId) return precioBase

  const precioLista = await prisma.precioProducto.findUnique({
    where: { listaPrecioId_productoId: { listaPrecioId, productoId } },
    select: { precio: true },
  })

  return precioLista?.precio ?? precioBase
}

/**
 * Wraps a Prisma transaction with explicit rollback logging.
 * Logs detailed context on failure for debugging.
 */
async function withVentaTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  context: { userId: string; operation: string; tenantId?: string },
): Promise<T> {
  try {
    return await prisma.$transaction(fn)
  } catch (error) {
    console.error('[VENTA_TX_ROLLBACK]', {
      operation: context.operation,
      userId: context.userId,
      tenantId: context.tenantId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

async function validateVentaLocations(
  puntoDeVentaId: string,
  productos: Array<{ productoId: string }>,
): Promise<{ valid: true } | { valid: false; error: string }> {
  // Validate punto de venta exists
  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
    where: { pvId: puntoDeVentaId },
    select: { pvId: true },
  })
  if (!puntoDeVenta) {
    return { valid: false, error: 'Punto de venta no encontrado' }
  }

  // Validate almacenes for parent products
  for (const item of productos) {
    const producto = await prisma.producto.findUnique({
      where: { id: item.productoId },
      select: { productoPadreId: true },
    })
    if (!producto) {
      return { valid: false, error: `Producto ${item.productoId} no encontrado` }
    }
    if (producto.productoPadreId) {
      const parent = await prisma.producto.findUnique({
        where: { id: producto.productoPadreId },
        select: { almacenId: true },
      })
      if (!parent || !parent.almacenId) {
        return { valid: false, error: 'Almacén no disponible para producto padre' }
      }
      const almacen = await prisma.almacen.findUnique({
        where: { almacenId: parent.almacenId },
        select: { activo: true },
      })
      if (!almacen || !almacen.activo) {
        return { valid: false, error: 'Almacén inactivo o no encontrado' }
      }
    }
  }

  return { valid: true }
}

async function crearFacturaParaVenta(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ventaId: string,
  clienteId: string,
  subtotal: number,
  descuento: number,
  impuestos: number,
  cargoTransporte: number,
  total: number,
  observaciones: string | null,
  creadoPor: string,
  serieId?: string,
  fechaVencimiento?: string | null,
  tipoVencimiento?: string,
  cuentaBancariaId?: string,
  anticipoCobroId?: string,
  idempotencyKey?: string,
) {
  let serie: {
    serieId: string; prefijo: string; consecutivo: number; activa: boolean; esPorDefecto?: boolean
  } | null = null

  if (serieId) {
    serie = await tx.serieFacturacion.findUnique({ where: { serieId } })
    if (!serie || !serie.activa) throw new Error('Serie de facturación no disponible')
  } else {
    serie = await tx.serieFacturacion.findFirst({ where: { esPorDefecto: true } })
    if (!serie) {
      serie = await tx.serieFacturacion.create({
        data: { tenant: { connect: { tenantId } }, prefijo: "SD", descripcion: "Serie por defecto para ventas", consecutivo: 1, activa: true, esPorDefecto: true },
      })
    }
  }

  const serieActualizada = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: { consecutivo: { increment: 1 } },
  })
  const numeroConsecutivoSerie = serieActualizada.consecutivo - 1

  const factura = await tx.factura.create({
    data: {
      tenantId,
      ventaId, clienteId, serieId: serie.serieId,
      subtotal: Number(subtotal), impuestos: Number(impuestos || 0),
      descuento: Number(descuento || 0), cargoTransporte: Number(cargoTransporte || 0),
      total: Number(total), observaciones, creadoPor, estado: 'PENDIENTE',
      numeroFactura: `${serie.prefijo}-${numeroConsecutivoSerie}`,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
    },
  })

  if (anticipoCobroId && idempotencyKey) {
    await applyAnticipoAllocations(
      tx,
      [{ anticipoId: anticipoCobroId, montoAplicado: Number(total) }],
      {
        documentoDestinoId: factura.idFactura, contexto: 'FACTURA_DIRECTA',
        usuarioId: creadoPor, idempotencyKey,
        observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      },
    )

    await reconciliarVentaDirecta(tx, {
      ventaId, montoTotal: Number(total), usuarioId: creadoPor,
      observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      cuentaBancariaId, tenantId,
    })

    await tx.factura.update({
      where: { idFactura: factura.idFactura },
      data: { estado: 'PAGADA', fechaVencimiento: null },
    })
  } else {
    await applyFacturacionCobroWorkflow(tx, {
      ventaId, facturaId: factura.idFactura, clienteId, montoTotal: Number(total),
      usuarioId: creadoPor, observaciones, tipoVencimiento, fechaVencimiento, cuentaBancariaId,
      tenantId,
    })
  }

  return factura
}

async function crearVentaMixta(body: any, user: any) {
  const tenantId = requireTenant(user)
  const lineas = Array.isArray(body.lineas) ? body.lineas : []
  const lineasProducto = lineas.filter((linea: any) => linea.tipoLinea === 'PRODUCTO')
  const lineasServicio = lineas.filter((linea: any) => linea.tipoLinea === 'SERVICIO')

  if (lineasProducto.length === 0 && lineasServicio.length > 0) {
    const ventasServicios = await prisma.$transaction(
      lineasServicio.map((linea: any) =>
        prisma.ventaServicios.create({
          data: {
            servicioId: linea.servicioId, cantidad: linea.cantidad,
            total: linea.cantidad * linea.precioUnitario,
            observaciones: linea.observaciones ?? body.observaciones ?? null,
            clienteId: body.clienteId ?? null,
            tenantId,
          },
        }),
      ),
    )
    await invalidateDashboardCache()
    return NextResponse.json({ tipo: 'venta_mixta_servicios', ventasServicios, lineasProductoProcesadas: 0 }, { status: 201 })
  }

  const ventaProductosResponse = await crearVentaUnica({
    ...body,
    productos: lineasProducto.map((linea: any) => ({ productoId: linea.productoId, cantidad: linea.cantidad })),
  }, user)

  if (ventaProductosResponse.status >= 400) return ventaProductosResponse

  const ventaProductosData = await ventaProductosResponse.json()
  const ventasServicios = lineasServicio.length > 0
    ? await prisma.$transaction(
        lineasServicio.map((linea: any) =>
          prisma.ventaServicios.create({
            data: {
              servicioId: linea.servicioId, cantidad: linea.cantidad,
              total: linea.cantidad * linea.precioUnitario,
              observaciones: linea.observaciones ?? body.observaciones ?? null,
              clienteId: body.clienteId ?? null,
              tenantId,
            },
          }),
        ),
      )
    : []

  await invalidateDashboardCache()
  return NextResponse.json({
    tipo: 'venta_mixta', ventaProductos: ventaProductosData, ventasServicios,
    lineasProductoProcesadas: lineasProducto.length,
    lineasServicioProcesadas: lineasServicio.length,
  }, { status: 201 })
}

async function crearVentaUnica(body: any, user: any) {
  const tenantId = requireTenant(user)
  const {
    productos, puntoDeVentaId, descuento, impuestos, cargoTransporte,
    observaciones, clienteId, serieId, fechaVencimiento, tipoVencimiento,
    cuentaBancariaId, formaPagoAnticipo, anticipoCobroId, idempotencyKey,
  } = body

  if (anticipoCobroId && formaPagoAnticipo !== 'ANTICIPO_COBRO') {
    return NextResponse.json(
      { error: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo' },
      { status: 400 },
    )
  }

  // Validate locations BEFORE transaction
  const locationValidation = await validateVentaLocations(puntoDeVentaId, productos)
  if (!locationValidation.valid) {
    return NextResponse.json({ error: locationValidation.error }, { status: 404 })
  }

  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({ where: { pvId: puntoDeVentaId } })
  if (!puntoDeVenta) return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })

  for (const item of productos) {
    const { productoId, cantidad } = item
    const transferenciasEntrada = await prisma.transferencia.aggregate({
      where: { productoId, puntoDeVentaDestinoId: puntoDeVentaId },
      _sum: { cantidad: true },
    })
    const transferenciasSalida = await prisma.transferencia.aggregate({
      where: { productoId, puntoDeVentaOrigenId: puntoDeVentaId },
      _sum: { cantidad: true },
    })
    const stockVendido = await prisma.ventaItem.aggregate({
      where: { productoId, venta: { puntoDeVentaId } },
      _sum: { cantidad: true },
    })
    const ventasTotal = stockVendido._sum.cantidad || 0
    const stockDisponible = (transferenciasEntrada._sum.cantidad || 0) - (transferenciasSalida._sum.cantidad || 0) - ventasTotal

    if (stockDisponible < cantidad) {
      return NextResponse.json({ error: `Stock insuficiente para el producto ${productoId}`, stockDisponible, productoId }, { status: 400 })
    }
  }

  let subtotalVenta = 0
  const productosConPrecio: any[] = []

  for (const item of productos) {
    const producto = await prisma.producto.findUnique({
      where: { id: item.productoId },
      select: { id: true, precioVenta: true, nombre: true, productoPadreId: true, cantidadEnPack: true },
    })
    if (!producto) return NextResponse.json({ error: `Producto ${item.productoId} no encontrado` }, { status: 404 })

    let precioAplicado: number
    if (item.precioVenta !== undefined && item.precioVenta !== null) {
      precioAplicado = Number(item.precioVenta)
    } else {
      precioAplicado = await resolverPrecioVenta(puntoDeVenta.listaPrecioId, producto.id, Number(producto.precioVenta))
    }
    const subtotal = item.cantidad * precioAplicado
    subtotalVenta += subtotal
    productosConPrecio.push({ ...item, precioVenta: precioAplicado, nombre: producto.nombre, subtotal, productoPadreId: producto.productoPadreId, cantidadEnPack: producto.cantidadEnPack })
  }

  const descuentoNum = Number(descuento || 0)
  const impuestosNum = Number(impuestos || 0)
  const cargoTransporteNum = Number(cargoTransporte || 0)
  const totalVenta = subtotalVenta - descuentoNum + impuestosNum + cargoTransporteNum

  const venta = await withVentaTransaction(
    async (tx) => {
      const ventaCreada = await tx.venta.create({
        data: {
          tenantId,
          idempotencyKey,
          cantidad: productos.reduce((sum: number, item: any) => sum + item.cantidad, 0),
          esVentaUnica: true,
          puntoDeVentaId,
          clienteId: clienteId || undefined,
          descuento: descuentoNum > 0 ? descuentoNum : undefined,
          observaciones: observaciones ?? undefined,
          total: totalVenta,
          items: { create: productosConPrecio.map((item: any) => ({ productoId: item.productoId, cantidad: item.cantidad, precioUnitario: Number(item.precioVenta), total: Number(item.subtotal) })) },
        },
        include: {
          puntoDeVenta: { select: { nombre: true } },
          cliente: { select: { nombre: true } },
          items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true, unidad: { select: { simbolo: true } } } } } },
        },
      })

      if (clienteId && user?.userId) {
        await crearFacturaParaVenta(tx, tenantId, ventaCreada.ventaId, clienteId, subtotalVenta, descuentoNum, impuestosNum, cargoTransporteNum, totalVenta, observaciones || null, user.userId, serieId, fechaVencimiento, tipoVencimiento, cuentaBancariaId, anticipoCobroId, idempotencyKey)
      }

      for (const item of productosConPrecio) {
        await upsertStockUbicacion(tx, { productoId: item.productoId, tipoUbicacion: 'punto_venta', ubicacionId: puntoDeVentaId, modo: 'increment', delta: -item.cantidad })
      }

      for (const item of productosConPrecio) {
        if (item.productoPadreId && item.cantidadEnPack && item.cantidadEnPack > 0) {
          const parentDecrement = Math.floor(item.cantidad / item.cantidadEnPack)
          if (parentDecrement >= 1) {
            await tx.producto.update({ where: { id: item.productoPadreId }, data: { stock: { decrement: parentDecrement } } })
            const productoPadre = await tx.producto.findUnique({ where: { id: item.productoPadreId }, select: { almacenId: true } })
            if (productoPadre) {
              await upsertStockUbicacion(tx, { productoId: item.productoPadreId, tipoUbicacion: 'almacen', ubicacionId: productoPadre.almacenId, modo: 'increment', delta: -parentDecrement })
            }
          }
        }
      }

      return ventaCreada
    },
    { userId: user?.userId, operation: 'create_venta_unica', tenantId },
  )

  await invalidateDashboardCache()

  return NextResponse.json({ ...venta, productos: productosConPrecio, tipo: 'venta_unica' })
}

async function crearVentaIndividual(body: any, user: any) {
  const tenantId = requireTenant(user)
  const {
    productoId, cantidad, precioVenta, puntoDeVentaId, descuento, impuestos,
    cargoTransporte, observaciones, clienteId, serieId, fechaVencimiento,
    tipoVencimiento, cuentaBancariaId, formaPagoAnticipo, anticipoCobroId, idempotencyKey,
  } = body

  if (anticipoCobroId && formaPagoAnticipo !== 'ANTICIPO_COBRO') {
    return NextResponse.json({ error: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo' }, { status: 400 })
  }

  // Validate locations BEFORE transaction
  const locationValidation = await validateVentaLocations(puntoDeVentaId, [{ productoId }])
  if (!locationValidation.valid) {
    return NextResponse.json({ error: locationValidation.error }, { status: 404 })
  }

  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({ where: { pvId: puntoDeVentaId } })
  if (!puntoDeVenta) return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })

  const transferenciasEntrada = await prisma.transferencia.aggregate({
    where: { productoId, puntoDeVentaDestinoId: puntoDeVentaId },
    _sum: { cantidad: true },
  })
  const transferenciasSalida = await prisma.transferencia.aggregate({
    where: { productoId, puntoDeVentaOrigenId: puntoDeVentaId },
    _sum: { cantidad: true },
  })
  const stockVendido = await prisma.ventaItem.aggregate({
    where: { productoId, venta: { puntoDeVentaId } },
    _sum: { cantidad: true },
  })
  const ventasTotal = stockVendido._sum.cantidad || 0
  const stockDisponible = (transferenciasEntrada._sum.cantidad || 0) - (transferenciasSalida._sum.cantidad || 0) - ventasTotal

  if (stockDisponible < cantidad) {
    return NextResponse.json({ error: "Stock insuficiente", stockDisponible }, { status: 400 })
  }

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, precioVenta: true, productoPadreId: true, cantidadEnPack: true },
  })
  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

  let precioAplicado: number
  if (precioVenta !== undefined && precioVenta !== null) {
    precioAplicado = Number(precioVenta)
  } else {
    precioAplicado = await resolverPrecioVenta(puntoDeVenta.listaPrecioId, producto.id, Number(producto.precioVenta))
  }
  const subtotalVenta = cantidad * precioAplicado
  const descuentoNum = Number(descuento || 0)
  const impuestosNum = Number(impuestos || 0)
  const cargoTransporteNum = Number(cargoTransporte || 0)
  const totalVenta = subtotalVenta - descuentoNum + impuestosNum + cargoTransporteNum

  const venta = await withVentaTransaction(
    async (tx) => {
      const ventaCreada = await tx.venta.create({
        data: {
          tenantId,
          idempotencyKey,
          productoId,
          cantidad, puntoDeVentaId,
          clienteId: clienteId || undefined,
          descuento: descuentoNum > 0 ? descuentoNum : undefined,
          observaciones: observaciones ?? undefined,
          total: totalVenta,
          items: { create: [{ productoId, cantidad, precioUnitario: Number(precioAplicado), total: Number(subtotalVenta) }] },
        },
        include: {
          producto: { select: { nombre: true, precioVenta: true } },
          puntoDeVenta: { select: { nombre: true } },
          items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true, unidad: { select: { simbolo: true } } } } } },
        },
      })

      if (clienteId && user?.userId) {
        await crearFacturaParaVenta(tx, tenantId, ventaCreada.ventaId, clienteId, subtotalVenta, descuentoNum, impuestosNum, cargoTransporteNum, totalVenta, observaciones || null, user.userId, serieId, fechaVencimiento, tipoVencimiento, cuentaBancariaId, anticipoCobroId, idempotencyKey)
      }

      await upsertStockUbicacion(tx, { productoId: producto.id, tipoUbicacion: 'punto_venta', ubicacionId: puntoDeVentaId, modo: 'increment', delta: -cantidad })

      if (producto.productoPadreId && producto.cantidadEnPack && producto.cantidadEnPack > 0) {
        const parentDecrement = Math.floor(cantidad / producto.cantidadEnPack)
        if (parentDecrement >= 1) {
          await tx.producto.update({ where: { id: producto.productoPadreId }, data: { stock: { decrement: parentDecrement } } })
          const productoPadre = await tx.producto.findUnique({ where: { id: producto.productoPadreId }, select: { almacenId: true } })
          if (productoPadre) {
            await upsertStockUbicacion(tx, { productoId: producto.productoPadreId, tipoUbicacion: 'almacen', ubicacionId: productoPadre.almacenId, modo: 'increment', delta: -parentDecrement })
          }
        }
      }

      return ventaCreada
    },
    { userId: user?.userId, operation: 'create_venta_individual', tenantId },
  )

  await invalidateDashboardCache()
  return NextResponse.json(venta)
}

export async function getVentasHandler(request: NextRequest, context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user)
    const ventas = await prisma.venta.findMany({
      where: { ventaPadreId: null, tenantId },
      include: {
        producto: { select: { id: true, nombre: true, precioVenta: true, precioCosto: true, categoria: { select: { catId: true, nombre: true } }, subcategoria: { select: { catId: true, nombre: true } } } },
        puntoDeVenta: { select: { pvId: true, nombre: true } },
        cliente: { select: { clienteId: true, nombre: true, telefono: true } },
        factura: true, oferta: true,
        empleado: { select: { empleadoId: true, nombre: true, apellido: true } },
        items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true, precioCosto: true, categoria: { select: { catId: true, nombre: true } }, subcategoria: { select: { catId: true, nombre: true } }, unidad: { select: { simbolo: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(ventas)
  } catch (error) {
    console.error("Error al obtener ventas:", error)
    console.error("Error details:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Error al obtener ventas", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function createVentaHandler(request: NextRequest, context: any, user: any) {
  try {
    // @deprecated - venta.productoId + venta.cantidad are legacy fields
    // Stock tracking consolidated under VentaItem[] from now on.
    console.warn('[DEPRECATION] venta.productoId + venta.cantidad are legacy. Use venta.items[] instead. Will be removed in v2.0.0.')

    const body = await request.json()
    const tenantId = requireTenant(user)

    // ─── Idempotency Key: prevent duplicate sales ────────────
    let idempotencyKey = body.idempotencyKey
    if (idempotencyKey) {
      const existing = await prisma.venta.findFirst({
        where: { idempotencyKey, tenantId },
        include: {
          puntoDeVenta: { select: { nombre: true } },
          cliente: { select: { nombre: true } },
          items: { include: { producto: { select: { id: true, nombre: true } } } },
        },
      })
      if (existing) {
        console.log(`[IDEMPOTENCY] Request with existing key ${idempotencyKey}, returning venta ${existing.ventaId}`)
        return NextResponse.json(existing, { status: 200 })
      }
    } else {
      idempotencyKey = crypto.randomUUID()
    }

    body.idempotencyKey = idempotencyKey

    if (body.lineas && Array.isArray(body.lineas)) {
      return await crearVentaMixta(body, user)
    }

    if (body.productos && Array.isArray(body.productos)) {
      return await crearVentaUnica(body, user)
    } else {
      return await crearVentaIndividual(body, user)
    }
  } catch (error) {
    console.error("[VENTA_HANDLER_ERROR]", {
      userId: user?.userId,
      error: error instanceof Error ? error.message : String(error),
    })
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    // Prisma known request errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Venta duplicada o conflicto de datos' }, { status: 409 })
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Registro no encontrado para actualizar' }, { status: 404 })
      }
    }

    const errorMessage = error instanceof Error ? error.message : ""
    const shouldReturnBadRequest =
      errorMessage.includes('Serie de facturación no disponible') ||
      errorMessage.includes('No hay tipos de pago activos') ||
      errorMessage.includes('No hay cuentas bancarias activas') ||
      errorMessage.includes('La fecha de vencimiento es obligatoria') ||
      errorMessage.includes('Fecha de vencimiento inválida') ||
      errorMessage.includes('El monto total de la factura debe ser mayor que cero')

    if (shouldReturnBadRequest) return NextResponse.json({ error: errorMessage }, { status: 400 })
    return NextResponse.json({ error: "Error al crear venta" }, { status: 500 })
  }
}

export async function getVentaByIdHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser
) {
  try {
    const params = await context.params
    const { id } = params
    const tenantId = requireTenant(user)
    const venta = await prisma.venta.findFirst({
      where: { ventaId: id, tenantId },
      include: {
        producto: true,
        puntoDeVenta: true,
        items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true, unidad: { select: { simbolo: true } } } } } },
      },
    })
    if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    return NextResponse.json(venta)
  } catch (error) {
    console.error("Error al obtener venta:", error)
    return NextResponse.json({ error: "Error al obtener venta" }, { status: 500 })
  }
}

export async function updateVentaHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser
) {
  try {
    const params = await context.params
    const { id } = params
    const tenantId = requireTenant(user)
    const body = await request.json()
    const { productoId, cantidad, fecha, puntoDeVentaId } = body

    const ventaActual = await prisma.venta.findFirst({
      where: { ventaId: id, tenantId },
      include: { items: true },
    })
    if (!ventaActual) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    if (ventaActual.items && ventaActual.items.length > 1) {
      return NextResponse.json({ error: "No se puede actualizar una venta con múltiples productos desde esta ruta" }, { status: 400 })
    }

    const itemActual = ventaActual.items?.[0]
    const productoActualId = ventaActual.productoId || itemActual?.productoId || null
    const cantidadActual = ventaActual.productoId ? ventaActual.cantidad : (itemActual?.cantidad ?? ventaActual.cantidad)

    if (productoId !== productoActualId || cantidad !== cantidadActual) {
      if (productoId !== productoActualId || cantidad > cantidadActual) {
        const productoIdVerificar = productoId || productoActualId
        if (!productoIdVerificar) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

        const producto = await prisma.producto.findUnique({ where: { id: productoIdVerificar } })
        if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

        const cantidadAdicional = productoId !== productoActualId ? cantidad : cantidad - cantidadActual
        if (producto.stock < cantidadAdicional) return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 })
      }

      const productoIdFinal = productoId || productoActualId
      const productoPrecio = productoIdFinal
        ? await prisma.producto.findUnique({ where: { id: productoIdFinal }, select: { precioVenta: true } })
        : null

      const itemPayload = productoIdFinal && productoPrecio
        ? { productoId: productoIdFinal, cantidad, precioUnitario: Number(productoPrecio.precioVenta), total: Number(productoPrecio.precioVenta) * Number(cantidad) }
        : null

      const stockUpdates = []
      if (productoIdFinal && productoActualId && productoIdFinal !== productoActualId) {
        stockUpdates.push(prisma.producto.update({ where: { id: productoActualId }, data: { stock: { increment: cantidadActual } } }))
        stockUpdates.push(prisma.producto.update({ where: { id: productoIdFinal }, data: { stock: { decrement: cantidad } } }))
      } else if (productoIdFinal) {
        stockUpdates.push(prisma.producto.update({ where: { id: productoIdFinal }, data: { stock: { increment: cantidadActual - cantidad } } }))
      }

      const [venta] = await prisma.$transaction([
        prisma.venta.update({
          where: { ventaId: id },
          data: { productoId: ventaActual.productoId ? productoId : undefined, cantidad, createdAt: fecha ? new Date(fecha) : undefined, puntoDeVentaId },
          include: { producto: true, puntoDeVenta: true, items: { include: { producto: { select: { id: true, nombre: true, precioVenta: true, unidad: { select: { simbolo: true } } } } } } },
        }),
        ...(itemPayload ? [ventaActual.items?.[0]?.id
          ? prisma.ventaItem.update({ where: { id: ventaActual.items[0].id }, data: itemPayload })
          : prisma.ventaItem.create({ data: { ventaId: id, ...itemPayload } }),
        ] : []),
        ...stockUpdates,
      ])

      return NextResponse.json(venta)
    } else {
      const venta = await prisma.venta.update({
        where: { ventaId: id },
        data: { createdAt: fecha ? new Date(fecha) : undefined, puntoDeVentaId },
        include: { producto: true, puntoDeVenta: true },
      })
      return NextResponse.json(venta)
    }
  } catch (error) {
    console.error("Error al actualizar venta:", error)
    return NextResponse.json({ error: "Error al actualizar venta" }, { status: 500 })
  }
}

export async function deleteVentaHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser
) {
  try {
    const params = await context.params
    const { id } = params
    const tenantId = requireTenant(user)
    const venta = await prisma.venta.findFirst({ where: { ventaId: id, tenantId }, include: { items: true } })
    if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })

    if (venta.items && venta.items.length > 0) {
      await prisma.venta.delete({ where: { ventaId: id } })
      return NextResponse.json({ success: true, id })
    }

    await prisma.$transaction([
      prisma.venta.delete({ where: { ventaId: id } }),
      prisma.producto.update({ where: { id: venta.productoId! }, data: { stock: { increment: venta.cantidad } } }),
    ])

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error al eliminar venta:", error)
    return NextResponse.json({ error: "Error al eliminar venta" }, { status: 500 })
  }
}

export async function getVentasStatsHandler(
  request: NextRequest,
  context: any,
  user: AuthenticatedUser
) {
  try {
    const tenantId = requireTenant(user)
    const totalVentas = await prisma.venta.count({ where: { tenantId } })
    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    const ventasPorMes = await prisma.$queryRaw<{ mes: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "createdAt") as mes, SUM("cantidad") as total
      FROM "Venta"
      WHERE "createdAt" >= ${fechaInicio} AND "tenantId" = ${tenantId}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY mes ASC
    `

    return NextResponse.json({
      totalVentas,
      ventasPorMes: ventasPorMes.map((item: any) => ({
        mes: new Date(item.mes).toISOString().slice(0, 7),
        total: Number(item.total),
      })),
    })
  } catch (error) {
    console.error("Error al obtener estadísticas de ventas:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}

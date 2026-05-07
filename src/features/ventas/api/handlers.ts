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

async function crearFacturaParaVenta(
  tx: Prisma.TransactionClient,
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
        data: { prefijo: "SD", descripcion: "Serie por defecto para ventas", consecutivo: 1, activa: true, esPorDefecto: true },
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
      cuentaBancariaId,
    })

    await tx.factura.update({
      where: { idFactura: factura.idFactura },
      data: { estado: 'PAGADA', fechaVencimiento: null },
    })
  } else {
    await applyFacturacionCobroWorkflow(tx, {
      ventaId, facturaId: factura.idFactura, clienteId, montoTotal: Number(total),
      usuarioId: creadoPor, observaciones, tipoVencimiento, fechaVencimiento, cuentaBancariaId,
    })
  }

  return factura
}

async function crearVentaMixta(body: any, user: any) {
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
    const [ventasItems, ventasLegacy] = await Promise.all([
      prisma.ventaItem.aggregate({ where: { productoId, venta: { puntoDeVentaId } }, _sum: { cantidad: true } }),
      prisma.venta.aggregate({ where: { productoId, puntoDeVentaId, items: { none: {} } }, _sum: { cantidad: true } }),
    ])
    const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)
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

  const venta = await prisma.$transaction(async (tx) => {
    const ventaCreada = await tx.venta.create({
      data: {
        cantidad: productos.reduce((sum: number, item: any) => sum + item.cantidad, 0),
        esVentaUnica: true,
        puntoDeVenta: { connect: { pvId: puntoDeVentaId } },
        cliente: clienteId ? { connect: { clienteId } } : undefined,
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
      await crearFacturaParaVenta(tx, ventaCreada.ventaId, clienteId, subtotalVenta, descuentoNum, impuestosNum, cargoTransporteNum, totalVenta, observaciones || null, user.userId, serieId, fechaVencimiento, tipoVencimiento, cuentaBancariaId, anticipoCobroId, idempotencyKey)
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
  })

  await invalidateDashboardCache()

  return NextResponse.json({ ...venta, productos: productosConPrecio, tipo: 'venta_unica' })
}

async function crearVentaIndividual(body: any, user: any) {
  const {
    productoId, cantidad, precioVenta, puntoDeVentaId, descuento, impuestos,
    cargoTransporte, observaciones, clienteId, serieId, fechaVencimiento,
    tipoVencimiento, cuentaBancariaId, formaPagoAnticipo, anticipoCobroId, idempotencyKey,
  } = body

  if (anticipoCobroId && formaPagoAnticipo !== 'ANTICIPO_COBRO') {
    return NextResponse.json({ error: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo' }, { status: 400 })
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
  const [ventasItems, ventasLegacy] = await Promise.all([
    prisma.ventaItem.aggregate({ where: { productoId, venta: { puntoDeVentaId } }, _sum: { cantidad: true } }),
    prisma.venta.aggregate({ where: { productoId, puntoDeVentaId, items: { none: {} } }, _sum: { cantidad: true } }),
  ])
  const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)
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

  const venta = await prisma.$transaction(async (tx) => {
    const ventaCreada = await tx.venta.create({
      data: {
        producto: { connect: { id: productoId } },
        cantidad, puntoDeVenta: { connect: { pvId: puntoDeVentaId } },
        cliente: clienteId ? { connect: { clienteId } } : undefined,
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
      await crearFacturaParaVenta(tx, ventaCreada.ventaId, clienteId, subtotalVenta, descuentoNum, impuestosNum, cargoTransporteNum, totalVenta, observaciones || null, user.userId, serieId, fechaVencimiento, tipoVencimiento, cuentaBancariaId, anticipoCobroId, idempotencyKey)
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
  })

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
    const body = await request.json()

    if (body.lineas && Array.isArray(body.lineas)) {
      return await crearVentaMixta(body, user)
    }

    if (body.productos && Array.isArray(body.productos)) {
      return await crearVentaUnica(body, user)
    } else {
      return await crearVentaIndividual(body, user)
    }
  } catch (error) {
    console.error("Error al crear venta:", error)
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
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

export async function getVentaByIdHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const venta = await prisma.venta.findUnique({
      where: { ventaId: id },
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

export async function updateVentaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { productoId, cantidad, fecha, puntoDeVentaId } = body

    const ventaActual = await prisma.venta.findUnique({
      where: { ventaId: id },
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

export async function deleteVentaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const venta = await prisma.venta.findUnique({ where: { ventaId: id }, include: { items: true } })
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

export async function getVentasStatsHandler() {
  try {
    const totalVentas = await prisma.venta.count()
    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    const ventasPorMes = await prisma.$queryRaw<{ mes: Date; total: number }[]>`
      SELECT DATE_TRUNC('month', "fecha") as mes, SUM("cantidad") as total
      FROM "Venta"
      WHERE "fecha" >= ${fechaInicio}
      GROUP BY DATE_TRUNC('month', "fecha")
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

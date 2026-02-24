import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"
import { Prisma } from "@/generated/prisma"
import { applyFacturacionCobroWorkflow } from "@/lib/services/facturacion-ventas-workflow"

// Function to invalidate dashboard cache after creating sales
async function invalidateDashboardCache() {
  try {
    // Call the invalidation endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    await fetch(`${baseUrl}/api/dashboard/stats`, { 
      method: 'DELETE' 
    })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
    // Don't throw error to avoid breaking the sale creation
  }
}

/**
 * @description Crea una factura para una venta y ejecuta workflow de cobro según vencimiento.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} ventaId - ID de la venta.
 * @param {string} clienteId - ID del cliente.
 * @param {number} subtotal - Subtotal de la factura.
 * @param {number} descuento - Descuento aplicado.
 * @param {number} impuestos - Impuestos aplicados.
 * @param {number} cargoTransporte - Cargo por transporte.
 * @param {number} total - Total de la factura.
 * @param {string | null} observaciones - Observaciones opcionales.
 * @param {string} creadoPor - Usuario que crea la factura.
 * @param {string | undefined} serieId - Serie opcional a usar.
 * @param {string | null | undefined} fechaVencimiento - Fecha de vencimiento opcional.
 * @param {string | undefined} tipoVencimiento - Tipo de vencimiento.
 * @param {string | undefined} cuentaBancariaId - Cuenta bancaria opcional para cobro directo.
 * @returns {Promise<any>} Factura creada.
 */
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
  cuentaBancariaId?: string
) {
  // Determinar qué serie usar
  let serie
  if (serieId) {
    serie = await tx.serieFacturacion.findUnique({
      where: { serieId }
    })
    if (!serie || !serie.activa) {
      throw new Error('Serie de facturación no disponible')
    }
  } else {
    // Obtener la serie por defecto "SD"
    serie = await tx.serieFacturacion.findFirst({
      where: { esPorDefecto: true }
    })

    if (!serie) {
      // Crear serie por defecto si no existe
      serie = await tx.serieFacturacion.create({
        data: {
          prefijo: "SD",
          descripcion: "Serie por defecto para ventas",
          consecutivo: 1,
          activa: true,
          esPorDefecto: true
        }
      })
    }
  }

  // Incrementar de forma atómica y usar el valor previo como número emitido
  const serieActualizada = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: {
      consecutivo: { increment: 1 }
    }
  })
  const numeroConsecutivoSerie = serieActualizada.consecutivo - 1

  // Crear la factura con el número final directamente
  const factura = await tx.factura.create({
    data: {
      ventaId,
      clienteId,
      serieId: serie.serieId,
      subtotal: Number(subtotal),
      impuestos: Number(impuestos || 0),
      descuento: Number(descuento || 0),
      cargoTransporte: Number(cargoTransporte || 0),
      total: Number(total),
      observaciones,
      creadoPor,
      estado: 'PENDIENTE',
      numeroFactura: `${serie.prefijo}-${numeroConsecutivoSerie}`,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
    },
  })

  await applyFacturacionCobroWorkflow(tx, {
    ventaId,
    facturaId: factura.idFactura,
    clienteId,
    montoTotal: Number(total),
    usuarioId: creadoPor,
    observaciones,
    tipoVencimiento,
    fechaVencimiento,
    cuentaBancariaId
  })

  return factura
}

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { ventaPadreId: null },
      include: {
         producto: {
           select: {
             id: true,
             nombre: true,
             precioVenta: true,
             precioCosto: true,
             categoria: {
               select: {
                 catId: true,
                 nombre: true,
               }
             },
             subcategoria: {
               select: {
                 catId: true,
                 nombre: true,
               }
             }
           },
         },
        puntoDeVenta: {
          select: {
            pvId: true,
            nombre: true,
          },
        },
        cliente: {
          select: {
            clienteId: true,
            nombre: true,
            telefono: true,
          },
        },
        factura: true,
        oferta: true,
        empleado: {
          select: {
            empleadoId: true,
            nombre: true,
            apellido: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                precioCosto: true,
                categoria: { select: { catId: true, nombre: true } },
                subcategoria: { select: { catId: true, nombre: true } },
                unidad: { select: { simbolo: true } },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
    return NextResponse.json(ventas)
  } catch (error) {
    console.error("Error al obtener ventas:", error)
    console.error("Error details:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Error al obtener ventas", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const body = await request.json()
     
    // Verificar si es una venta única con múltiples productos o una venta individual
    if (body.productos && Array.isArray(body.productos)) {
      // Venta única con múltiples productos
      return await crearVentaUnica(body, user)
    } else {
      // Venta individual (comportamiento original)
      return await crearVentaIndividual(body, user)
    }
  } catch (error) {
    console.error("Error al crear venta:", error)

    const errorMessage = error instanceof Error ? error.message : ""
    const shouldReturnBadRequest =
      errorMessage.includes('Serie de facturación no disponible') ||
      errorMessage.includes('No hay tipos de pago activos') ||
      errorMessage.includes('No hay cuentas bancarias activas') ||
      errorMessage.includes('La fecha de vencimiento es obligatoria') ||
      errorMessage.includes('Fecha de vencimiento inválida') ||
      errorMessage.includes('El monto total de la factura debe ser mayor que cero')

    if (shouldReturnBadRequest) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json({ error: "Error al crear venta" }, { status: 500 })
  }
})

async function crearVentaUnica(body: any, user: any) {
  const {
    productos,
    puntoDeVentaId,
    descuento,
    impuestos,
    cargoTransporte,
    observaciones,
    clienteId,
    serieId,
    fechaVencimiento,
    tipoVencimiento,
    cuentaBancariaId
  } = body

  // Verificar que el punto de venta existe
  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
    where: { pvId: puntoDeVentaId },
  })

  if (!puntoDeVenta) {
    return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })
  }

  // Verificar stock para todos los productos
  for (const item of productos) {
    const { productoId, cantidad } = item

    // Verificar stock disponible en el punto de venta
    const transferenciasEntrada = await prisma.transferencia.aggregate({
      where: {
        productoId,
        puntoDeVentaDestinoId: puntoDeVentaId,
      },
      _sum: {
        cantidad: true,
      },
    })

    const transferenciasSalida = await prisma.transferencia.aggregate({
      where: {
        productoId,
        puntoDeVentaOrigenId: puntoDeVentaId,
      },
      _sum: {
        cantidad: true,
      },
    })

    const [ventasItems, ventasLegacy] = await Promise.all([
      prisma.ventaItem.aggregate({
        where: {
          productoId,
          venta: {
            puntoDeVentaId,
          },
        },
        _sum: {
          cantidad: true,
        },
      }),
      prisma.venta.aggregate({
        where: {
          productoId,
          puntoDeVentaId,
          items: { none: {} },
        },
        _sum: {
          cantidad: true,
        },
      }),
    ])

    const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)

    const stockDisponible =
      (transferenciasEntrada._sum.cantidad || 0) -
      (transferenciasSalida._sum.cantidad || 0) -
      ventasTotal

    if (stockDisponible < cantidad) {
      return NextResponse.json(
        {
          error: `Stock insuficiente para el producto ${productoId}`,
          stockDisponible,
          productoId,
        },
        { status: 400 },
      )
    }
  }

  // Calcular los totales de la venta
  let subtotalVenta = 0
  const productosConPrecio: any[] = []

  for (const item of productos) {
    const producto = await prisma.producto.findUnique({
      where: { id: item.productoId },
      select: { precioVenta: true, nombre: true }
    })

    if (!producto) {
      return NextResponse.json({ error: `Producto ${item.productoId} no encontrado` }, { status: 404 })
    }

    const subtotal = item.cantidad * producto.precioVenta
    subtotalVenta += subtotal
    productosConPrecio.push({
      ...item,
      precioVenta: producto.precioVenta,
      nombre: producto.nombre,
      subtotal
    })
  }

  // Calcular totales finales
  const descuentoNum = Number(descuento || 0)
  const impuestosNum = Number(impuestos || 0)
  const cargoTransporteNum = Number(cargoTransporte || 0)
  const totalVenta = subtotalVenta - descuentoNum + impuestosNum + cargoTransporteNum

  const venta = await prisma.$transaction(async (tx) => {
    // Crear la venta única (cabecera)
    const ventaCreada = await tx.venta.create({
      data: {
        // No conectamos un producto específico para ventas únicas
        cantidad: productos.reduce((sum: number, item: any) => sum + item.cantidad, 0),
        esVentaUnica: true,
        puntoDeVenta: { connect: { pvId: puntoDeVentaId } },
        cliente: clienteId ? { connect: { clienteId } } : undefined,
        descuento: descuentoNum > 0 ? descuentoNum : undefined,
        observaciones: observaciones ?? undefined,
        total: totalVenta,
        items: {
          create: productosConPrecio.map((item: any) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: Number(item.precioVenta),
            total: Number(item.subtotal),
          })),
        },
      },
      include: {
        puntoDeVenta: {
          select: {
            nombre: true,
          },
        },
        cliente: {
          select: {
            nombre: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                unidad: { select: { simbolo: true } },
              },
            },
          },
        },
      },
    })

    // Crear factura si hay cliente
    if (clienteId && user?.userId) {
      await crearFacturaParaVenta(
        tx,
        ventaCreada.ventaId,
        clienteId,
        subtotalVenta,
        descuentoNum,
        impuestosNum,
        cargoTransporteNum,
        totalVenta,
        observaciones || null,
        user.userId,
        serieId,
        fechaVencimiento,
        tipoVencimiento,
        cuentaBancariaId
      )
    }

    return ventaCreada
  })

  // Nota: no se crean ventas separadas por producto en ventas únicas

  // Invalidar cache del dashboard para actualizar las ventas diarias
  await invalidateDashboardCache()

  return NextResponse.json({
    ...venta,
    productos: productosConPrecio,
    tipo: 'venta_unica'
  })
}

async function crearVentaIndividual(body: any, user: any) {
  const {
    productoId,
    cantidad,
    puntoDeVentaId,
    descuento,
    impuestos,
    cargoTransporte,
    observaciones,
    clienteId,
    serieId,
    fechaVencimiento,
    tipoVencimiento,
    cuentaBancariaId
  } = body

  // Verificar que el punto de venta existe
  const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
    where: { pvId: puntoDeVentaId },
  })

  if (!puntoDeVenta) {
    return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })
  }

  // Verificar stock disponible en el punto de venta
  const transferenciasEntrada = await prisma.transferencia.aggregate({
    where: {
      productoId,
      puntoDeVentaDestinoId: puntoDeVentaId,
    },
    _sum: {
      cantidad: true,
    },
  })

  const transferenciasSalida = await prisma.transferencia.aggregate({
    where: {
      productoId,
      puntoDeVentaOrigenId: puntoDeVentaId,
    },
    _sum: {
      cantidad: true,
    },
  })

  const [ventasItems, ventasLegacy] = await Promise.all([
    prisma.ventaItem.aggregate({
      where: {
        productoId,
        venta: {
          puntoDeVentaId,
        },
      },
      _sum: {
        cantidad: true,
      },
    }),
    prisma.venta.aggregate({
      where: {
        productoId,
        puntoDeVentaId,
        items: { none: {} },
      },
      _sum: {
        cantidad: true,
      },
    }),
  ])
  const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)

  // Calcular stock disponible en el punto de venta
  const stockDisponible =
    (transferenciasEntrada._sum.cantidad || 0) -
    (transferenciasSalida._sum.cantidad || 0) -
    ventasTotal

  // Verificar si hay suficiente stock
  if (stockDisponible < cantidad) {
    return NextResponse.json(
      {
        error: "Stock insuficiente",
        stockDisponible,
      },
      { status: 400 },
    )
  }

  // Obtener el precio de venta del producto
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { precioVenta: true }
  })

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  // Calcular los totales de la venta
  const subtotalVenta = cantidad * producto.precioVenta
  const descuentoNum = Number(descuento || 0)
  const impuestosNum = Number(impuestos || 0)
  const cargoTransporteNum = Number(cargoTransporte || 0)
  const totalVenta = subtotalVenta - descuentoNum + impuestosNum + cargoTransporteNum

  const venta = await prisma.$transaction(async (tx) => {
    // Crear la venta
    const ventaCreada = await tx.venta.create({
      data: {
        producto: {
          connect: { id: productoId }
        },
        cantidad,
        puntoDeVenta: {
          connect: { pvId: puntoDeVentaId }
        },
        cliente: clienteId ? { connect: { clienteId } } : undefined,
        descuento: descuentoNum > 0 ? descuentoNum : undefined,
        observaciones: observaciones ?? undefined,
        total: totalVenta,
        items: {
          create: [
            {
              productoId,
              cantidad,
              precioUnitario: Number(producto.precioVenta),
              total: Number(subtotalVenta),
            },
          ],
        },
      },
      include: {
        producto: {
          select: {
            nombre: true,
            precioVenta: true,
          },
        },
        puntoDeVenta: {
          select: {
            nombre: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                unidad: { select: { simbolo: true } },
              },
            },
          },
        },
      },
    })

    // Crear factura si hay cliente
    if (clienteId && user?.userId) {
      await crearFacturaParaVenta(
        tx,
        ventaCreada.ventaId,
        clienteId,
        subtotalVenta,
        descuentoNum,
        impuestosNum,
        cargoTransporteNum,
        totalVenta,
        observaciones || null,
        user.userId,
        serieId,
        fechaVencimiento,
        tipoVencimiento,
        cuentaBancariaId
      )
    }

    return ventaCreada
  })

  // Invalidar cache del dashboard para actualizar las ventas diarias
  await invalidateDashboardCache()

  return NextResponse.json(venta)
}

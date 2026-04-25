import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"
import { Prisma } from "@/generated/prisma"
import {
  applyFacturacionCobroWorkflow,
  reconciliarVentaDirecta
} from "@/lib/services/facturacion-ventas-workflow"
import {
  applyAnticipoAllocations,
  isAnticipoWorkflowError
} from "@/lib/services/anticipos-workflow"
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
import {
  assertOperationAllowed,
  isPeriodoOperacionError,
  serializePeriodoOperacionError
} from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

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
 * @description Resuelve precio de venta para un producto según lista de precio del punto de venta.
 * @param {string | null | undefined} listaPrecioId - Lista aplicada al punto de venta.
 * @param {string} productoId - Producto a cotizar.
 * @param {number} precioBase - Precio base del producto.
 * @returns {Promise<number>} Precio final para registrar la venta.
 */
async function resolverPrecioVenta(
  listaPrecioId: string | null | undefined,
  productoId: string,
  precioBase: number,
): Promise<number> {
  if (!listaPrecioId) {
    return precioBase
  }

  const precioLista = await prisma.precioProducto.findUnique({
    where: {
      listaPrecioId_productoId: {
        listaPrecioId,
        productoId,
      },
    },
    select: {
      precio: true,
    },
  })

  return precioLista?.precio ?? precioBase
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
  cuentaBancariaId?: string,
  anticipoCobroId?: string,
  idempotencyKey?: string
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

  if (anticipoCobroId && idempotencyKey) {
    // Consumir anticipo y crear reconciliación dentro de la transacción
    await applyAnticipoAllocations(
      tx,
      [{ anticipoId: anticipoCobroId, montoAplicado: Number(total) }],
      {
        documentoDestinoId: factura.idFactura,
        contexto: 'FACTURA_DIRECTA',
        usuarioId: creadoPor,
        idempotencyKey,
        observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      }
    )

    // Reconciliar la venta directa
    await reconciliarVentaDirecta(tx, {
      ventaId,
      montoTotal: Number(total),
      usuarioId: creadoPor,
      observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      cuentaBancariaId
    })

    await tx.factura.update({
      where: { idFactura: factura.idFactura },
      data: {
        estado: 'PAGADA',
        fechaVencimiento: null
      }
    })
  } else {
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
  }

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
    await assertOperationAllowed(new Date(), 'VENTA')

    // Venta mixta con líneas de producto + servicio (fase de transición)
    if (body.lineas && Array.isArray(body.lineas)) {
      return await crearVentaMixta(body, user)
    }
     
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
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
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

    if (shouldReturnBadRequest) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json({ error: "Error al crear venta" }, { status: 500 })
  }
})

async function crearVentaMixta(body: any, user: any) {
  const lineas = Array.isArray(body.lineas) ? body.lineas : []
  const lineasProducto = lineas.filter((linea: any) => linea.tipoLinea === 'PRODUCTO')
  const lineasServicio = lineas.filter((linea: any) => linea.tipoLinea === 'SERVICIO')

  // Si solo hay servicios, registrar por módulo de servicios
  if (lineasProducto.length === 0 && lineasServicio.length > 0) {
    const ventasServicios = await prisma.$transaction(
      lineasServicio.map((linea: any) =>
        prisma.ventaServicios.create({
          data: {
            servicioId: linea.servicioId,
            cantidad: linea.cantidad,
            total: linea.cantidad * linea.precioUnitario,
            observaciones: linea.observaciones ?? body.observaciones ?? null,
            clienteId: body.clienteId ?? null,
          },
        })
      )
    )

    await invalidateDashboardCache()
    return NextResponse.json({
      tipo: 'venta_mixta_servicios',
      ventasServicios,
      lineasProductoProcesadas: 0,
    }, { status: 201 })
  }

  const ventaProductosResponse = await crearVentaUnica(
    {
      ...body,
      productos: lineasProducto.map((linea: any) => ({
        productoId: linea.productoId,
        cantidad: linea.cantidad,
      })),
    },
    user
  )

  if (ventaProductosResponse.status >= 400) {
    return ventaProductosResponse
  }

  const ventaProductosData = await ventaProductosResponse.json()

  const ventasServicios = lineasServicio.length > 0
    ? await prisma.$transaction(
        lineasServicio.map((linea: any) =>
          prisma.ventaServicios.create({
            data: {
              servicioId: linea.servicioId,
              cantidad: linea.cantidad,
              total: linea.cantidad * linea.precioUnitario,
              observaciones: linea.observaciones ?? body.observaciones ?? null,
              clienteId: body.clienteId ?? null,
            },
          })
        )
      )
    : []

  await invalidateDashboardCache()

  return NextResponse.json({
    tipo: 'venta_mixta',
    ventaProductos: ventaProductosData,
    ventasServicios,
    lineasProductoProcesadas: lineasProducto.length,
    lineasServicioProcesadas: lineasServicio.length,
  }, { status: 201 })
}

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
    cuentaBancariaId,
    formaPagoAnticipo,
    anticipoCobroId,
    idempotencyKey
  } = body

  if (anticipoCobroId && formaPagoAnticipo !== 'ANTICIPO_COBRO') {
    return NextResponse.json(
      { error: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo' },
      { status: 400 }
    )
  }

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
      select: { id: true, precioVenta: true, nombre: true, productoPadreId: true, cantidadEnPack: true },
    })

    if (!producto) {
      return NextResponse.json({ error: `Producto ${item.productoId} no encontrado` }, { status: 404 })
    }

    let precioAplicado: number;
    if (item.precioVenta !== undefined && item.precioVenta !== null) {
      precioAplicado = Number(item.precioVenta);
    } else {
      precioAplicado = await resolverPrecioVenta(
        puntoDeVenta.listaPrecioId,
        producto.id,
        Number(producto.precioVenta),
      );
    }
    const subtotal = item.cantidad * precioAplicado
    subtotalVenta += subtotal
    productosConPrecio.push({
      ...item,
      precioVenta: precioAplicado,
      nombre: producto.nombre,
      subtotal,
      productoPadreId: producto.productoPadreId,
      cantidadEnPack: producto.cantidadEnPack,
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
        cuentaBancariaId,
        anticipoCobroId,
        idempotencyKey
      )
    }

    // Descontar stock del punto de venta para cada item
    for (const item of productosConPrecio) {
      await upsertStockUbicacion(tx, {
        productoId: item.productoId,
        tipoUbicacion: 'punto_venta',
        ubicacionId: puntoDeVentaId,
        modo: 'increment',
        delta: -item.cantidad,
      })
    }

    // Sync stock padre para items que son hijos de un producto compuesto
    for (const item of productosConPrecio) {
      if (item.productoPadreId && item.cantidadEnPack && item.cantidadEnPack > 0) {
        const parentDecrement = Math.floor(item.cantidad / item.cantidadEnPack)
        if (parentDecrement >= 1) {
          await tx.producto.update({
            where: { id: item.productoPadreId },
            data: { stock: { decrement: parentDecrement } },
          })
          // También decrementar StockUbicacion del almacén del padre
          const productoPadre = await tx.producto.findUnique({
            where: { id: item.productoPadreId },
            select: { almacenId: true },
          })
          if (productoPadre) {
            await upsertStockUbicacion(tx, {
              productoId: item.productoPadreId,
              tipoUbicacion: 'almacen',
              ubicacionId: productoPadre.almacenId,
              modo: 'increment',
              delta: -parentDecrement,
            })
          }
        }
      }
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
    precioVenta,
    puntoDeVentaId,
    descuento,
    impuestos,
    cargoTransporte,
    observaciones,
    clienteId,
    serieId,
    fechaVencimiento,
    tipoVencimiento,
    cuentaBancariaId,
    formaPagoAnticipo,
    anticipoCobroId,
    idempotencyKey
  } = body

  if (anticipoCobroId && formaPagoAnticipo !== 'ANTICIPO_COBRO') {
    return NextResponse.json(
      { error: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo' },
      { status: 400 }
    )
  }

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
    select: { id: true, precioVenta: true, productoPadreId: true, cantidadEnPack: true },
  })

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  // Calcular los totales de la venta
  let precioAplicado: number;
  if (precioVenta !== undefined && precioVenta !== null) {
    precioAplicado = Number(precioVenta);
  } else {
    precioAplicado = await resolverPrecioVenta(
      puntoDeVenta.listaPrecioId,
      producto.id,
      Number(producto.precioVenta),
    )
  }
  const subtotalVenta = cantidad * precioAplicado
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
              precioUnitario: Number(precioAplicado),
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
        cuentaBancariaId,
        anticipoCobroId,
        idempotencyKey
      )
    }

    // Descontar stock del punto de venta
    await upsertStockUbicacion(tx, {
      productoId: producto.id,
      tipoUbicacion: 'punto_venta',
      ubicacionId: puntoDeVentaId,
      modo: 'increment',
      delta: -cantidad,
    })

    // Sync stock padre si el producto vendido es un hijo
    if (producto.productoPadreId && producto.cantidadEnPack && producto.cantidadEnPack > 0) {
      const parentDecrement = Math.floor(cantidad / producto.cantidadEnPack)
      if (parentDecrement >= 1) {
        await tx.producto.update({
          where: { id: producto.productoPadreId },
          data: { stock: { decrement: parentDecrement } },
        })
        // También decrementar StockUbicacion del almacén del padre
        const productoPadre = await tx.producto.findUnique({
          where: { id: producto.productoPadreId },
          select: { almacenId: true },
        })
        if (productoPadre) {
          await upsertStockUbicacion(tx, {
            productoId: producto.productoPadreId,
            tipoUbicacion: 'almacen',
            ubicacionId: productoPadre.almacenId,
            modo: 'increment',
            delta: -parentDecrement,
          })
        }
      }
    }

    return ventaCreada
  })

  // Invalidar cache del dashboard para actualizar las ventas diarias
  await invalidateDashboardCache()

  // Registrar evento contable (no-bloqueante)
  await registrarEventoContable({
    origenTipo: 'VENTA',
    origenId: (venta as Record<string, unknown>).ventaId as string ?? 'unknown',
    monto: Number((venta as Record<string, unknown>).total ?? 0),
    fechaOperacion: new Date(),
    descripcion: `Venta ${(venta as Record<string, unknown>).ventaId ?? ''}`,
    usuarioId: user.userId,
  })

  return NextResponse.json(venta)
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"
import { notificarTransferencia } from "@/lib/notificaciones-utils"
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'

/**
 * @description Calcula el stock disponible para un producto en un punto de venta.
 * @param {string} productoId - ID del producto
 * @param {string} puntoDeVentaId - ID del punto de venta
 * @returns {Promise<number>} Stock disponible en el punto de venta
 */
async function getStockDisponibleEnPuntoVenta(productoId: string, puntoDeVentaId: string): Promise<number> {
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

  return (
    (transferenciasEntrada._sum.cantidad || 0) -
    (transferenciasSalida._sum.cantidad || 0) -
    ventasTotal
  )
}



export const GET = withAuthGet(async (request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const transferencias = await prisma.transferencia.findMany({
      where: { tenantId },
      where: {
        deletedAt: null, // Excluir transferencias eliminadas (soft delete)
      },
      select: {
        transferenciaId: true,
        numeroTransferencia: true,
        productoId: true,
        cantidad: true,
        costoUnitario: true,
        costoTotal: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
        producto: {
          select: {
            nombre: true,
            codigoInterno: true,
          }
        },
        origen: {
          select: {
            almacenId: true,
            nombre: true,
          }
        },
        destino: {
          select: {
            almacenId: true,
            nombre: true,
          }
        },
        puntoDeVentaOrigen: {
          select: {
            pvId: true,
            nombre: true,
          }
        },
        puntoDeVentaDestino: {
          select: {
            pvId: true,
            nombre: true,
          }
        },
        creadoPor: {
          select: {
            userId: true,
            name: true,
            email: true,
          }
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    })

    // Obtener el total para paginación
    const total = await prisma.transferencia.count({
      where: { deletedAt: null }
    })

    // Procesar los datos para determinar el tipo de transferencia y nombres de origen/destino
    const transferenciasProcessed = transferencias.map((t: any) => {
      let tipoTransferencia = ""
      let origenNombre = ""
      let destinoNombre = ""

      // Determinar origen
      if (t.origen) {
        origenNombre = `${t.origen.nombre} (Almacén)`
        tipoTransferencia += "Almacén"
      } else if (t.puntoDeVentaOrigen) {
        origenNombre = `${t.puntoDeVentaOrigen.nombre} (Punto de Venta)`
        tipoTransferencia += "Punto de Venta"
      }

      // Determinar destino
      tipoTransferencia += " → "
      if (t.destino) {
        destinoNombre = `${t.destino.nombre} (Almacén)`
        tipoTransferencia += "Almacén"
      } else if (t.puntoDeVentaDestino) {
        destinoNombre = `${t.puntoDeVentaDestino.nombre} (Punto de Venta)`
        tipoTransferencia += "Punto de Venta"
      }

      return {
        transferenciaId: t.transferenciaId,
        numeroTransferencia: t.numeroTransferencia,
        productoId: t.productoId,
        productoNombre: t.producto.nombre,
        productoCodigoInterno: t.producto.codigoInterno,
        cantidad: t.cantidad,
        costoUnitario: t.costoUnitario,
        costoTotal: t.costoTotal,
        tipoTransferencia,
        origenNombre,
        destinoNombre,
        estado: t.estado,
        creadoPor: t.creadoPor,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return NextResponse.json({
      transferencias: transferenciasProcessed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error("Error al obtener transferencias:", error)
    return NextResponse.json({ error: "Error al obtener transferencias" }, { status: 500 })
  }
})

/**
 * @description Genera un número de transferencia consecutivo (TRF-YYYY-XXXXXX)
 * @param {any} tx - Transacción de Prisma
 * @returns {Promise<string>} Número de transferencia generado
 */
async function generarNumeroTransferencia(tx: any): Promise<string> {
  const year = new Date().getFullYear()
  const count = await tx.transferencia.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  return `TRF-${year}-${String(count + 1).padStart(6, '0')}`
}

export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  try {
    const body = await request.json()
    const { productos, tipoOrigen, origenId, tipoDestino, destinoId, descripcion } = body

    // Verificar que el usuario esté autenticado
    if (!user || !user.userId) {
      return NextResponse.json({ message: "Usuario no autenticado" }, { status: 401 })
    }

    // Validaciones básicas
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ message: "Se requiere al menos un producto" }, { status: 400 })
    }

    if (!tipoOrigen || !origenId || !tipoDestino || !destinoId) {
      return NextResponse.json({ message: "Faltan campos requeridos" }, { status: 400 })
    }

    if (tipoOrigen === tipoDestino && origenId === destinoId) {
      return NextResponse.json({ message: "El origen y destino no pueden ser iguales" }, { status: 400 })
    }

    // Validar que todos los productos existan y tengan stock suficiente
    const productosValidados: { producto: { categoria: { nombre: string; catId: string; createdAt: Date; updatedAt: Date; }; unidad: { nombre: string; createdAt: Date; updatedAt: Date; unidadId: string; simbolo: string; } | null; } & { id: string; nombre: string; stock: number; createdAt: Date; updatedAt: Date; descripcion: string | null; precioCosto: number; precioVenta: number; categoriaId: string; unidadId: string | null; vendorId: string | null; almacenId: string; puntoDeVentaId: string | null; }; cantidad: any; }[] = []
    for (const item of productos) {
      const { productoId, cantidad } = item
      const cantidadNum = Number(cantidad)

      if (!productoId || !Number.isFinite(cantidadNum) || cantidadNum <= 0) {
        return NextResponse.json({ message: "Datos de producto inválidos" }, { status: 400 })
      }

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
        include: {
          categoria: true,
          unidad: true,
        },
      })

      if (!producto) {
        return NextResponse.json({ message: `Producto con ID ${productoId} no encontrado` }, { status: 404 })
      }

      if (tipoOrigen === "punto_venta") {
        const stockDisponible = await getStockDisponibleEnPuntoVenta(productoId, origenId)
        if (stockDisponible < cantidadNum) {
          return NextResponse.json({
            message: `Stock insuficiente para ${producto.nombre} en el punto de venta. Disponible: ${stockDisponible}, Solicitado: ${cantidadNum}`
          }, { status: 400 })
        }
      } else if (producto.stock < cantidadNum) {
        return NextResponse.json({
          message: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidadNum}`
        }, { status: 400 })
      }

      productosValidados.push({
        producto,
        cantidad: cantidadNum,
      })
    }

    // Verificar que origen y destino existan
    let origenValido = null
    let destinoValido = null

    if (tipoOrigen === "almacen") {
      origenValido = await prisma.almacen.findUnique({
        where: { almacenId: origenId },
      })
    } else {
      origenValido = await prisma.puntoDeVenta.findUnique({
        where: { pvId: origenId },
      })
    }

    if (tipoDestino === "almacen") {
      destinoValido = await prisma.almacen.findUnique({
        where: { almacenId: destinoId },
      })
    } else {
      destinoValido = await prisma.puntoDeVenta.findUnique({
        where: { pvId: destinoId },
      })
    }

    if (!origenValido) {
      return NextResponse.json({ message: "Origen no encontrado" }, { status: 404 })
    }

    if (!destinoValido) {
      return NextResponse.json({ message: "Destino no encontrado" }, { status: 404 })
    }

    // Crear las transferencias en una transacción
    const result = await prisma.$transaction(async (tx: any) => {
      const transferenciasCreadas = []

      // Generar número de transferencia único
      const numeroTransferencia = await generarNumeroTransferencia(tx)

      for (const item of productosValidados) {
        const { producto, cantidad } = item

        // Calcular costos
        const costoUnitario = producto.precioCosto
        const costoTotal = cantidad * costoUnitario

        // Crear la transferencia con los campos correctos según el tipo
        const transferenciaData: any = {
          productoId: producto.id,
          cantidad,
          costoUnitario,
          costoTotal,
          descripcion: descripcion || `Transferencia múltiple - ${producto.nombre}`,
          estado: 'COMPLETADA',
          creadoPorId: user.userId,
          numeroTransferencia: `${numeroTransferencia}-${String(transferenciasCreadas.length + 1).padStart(3, '0')}`,
        }

        // Asignar origen según el tipo
        if (tipoOrigen === "almacen") {
          transferenciaData.origenId = origenId
        } else {
          transferenciaData.puntoDeVentaOrigenId = origenId
        }

        // Asignar destino según el tipo
        if (tipoDestino === "almacen") {
          transferenciaData.destinoId = destinoId
        } else {
          transferenciaData.puntoDeVentaDestinoId = destinoId
        }

        const transferencia = await tx.transferencia.create({
          data: transferenciaData,
          include: {
            producto: {
              include: {
                categoria: true,
                unidad: true,
              },
            },
          },
        })

        // Actualizar stock solo cuando el almacén está involucrado
        const stockDelta =
          (tipoOrigen === "almacen" ? -cantidad : 0) +
          (tipoDestino === "almacen" ? cantidad : 0)

        if (stockDelta !== 0) {
          await tx.producto.update({
            where: { id: producto.id },
            data: {
              stock: {
                increment: stockDelta,
              },
            },
          })
        }

        transferenciasCreadas.push(transferencia)
        
        // Decrementar stock en ubicación origen
        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: tipoOrigen,
          ubicacionId: origenId,
          modo: 'increment',
          delta: -cantidad,
        })

        // Incrementar stock en ubicación destino
        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: tipoDestino,
          ubicacionId: destinoId,
          modo: 'increment',
          delta: cantidad,
        })
      }

      return transferenciasCreadas
    })

    // Enviar notificaciones para cada transferencia
    for (const transferencia of result) {
      try {
        await notificarTransferencia(transferencia.transferenciaId)
      } catch (error) {
        console.error("Error enviando notificación de transferencia:", error)
        // No fallar la operación principal por un error de notificación
      }
    }

    return NextResponse.json({
      message: `${result.length} transferencias creadas exitosamente`,
      transferencias: result,
      totalProductos: result.length,
      totalUnidades: result.reduce((sum: number, t: { cantidad: number }) => sum + t.cantidad, 0),
    })
  } catch (error) {
    console.log("[TRANSFERENCIAS_POST]", error)
    return NextResponse.json({
      message: "Error interno del servidor"
    }, {
      status: 500
    })
  }
})

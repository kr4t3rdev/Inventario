import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet, withAuth } from "@/lib/auth-middleware"

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

export const GET = withAuthGet(async (request: NextRequest, context: any) => {
  try {
    const params = await context.params;
    const { id } = params;
    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null, // Excluir eliminadas
      },
      include: {
        producto: true,
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
        creadoPor: {
          select: {
            userId: true,
            name: true,
            email: true,
          }
        },
      },
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    return NextResponse.json(transferencia)
  } catch (error) {
    console.error("Error al obtener transferencia:", error)
    return NextResponse.json({ error: "Error al obtener transferencia" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const params = await context.params;
    const { id } = params;
    const { productoId, cantidad, tipoOrigen, origenId, tipoDestino, destinoId } = await request.json()
    const nuevaCantidad = Number(cantidad)

    // Verificar autenticación
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    if (!productoId || !Number.isFinite(nuevaCantidad) || nuevaCantidad <= 0) {
      return NextResponse.json({ error: "Datos de transferencia inválidos" }, { status: 400 })
    }

    const transferenciaActual = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null, // No permitir editar eliminadas
      },
    })

    if (!transferenciaActual) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    // Validar que no se puede editar una transferencia cancelada
    if (transferenciaActual.estado === 'CANCELADA') {
      return NextResponse.json({
        error: "No se puede modificar una transferencia cancelada"
      }, { status: 400 })
    }

    if (tipoOrigen === "punto_venta") {
      let stockDisponible = await getStockDisponibleEnPuntoVenta(productoId, origenId)

      if (
        transferenciaActual.productoId === productoId &&
        transferenciaActual.puntoDeVentaOrigenId === origenId
      ) {
        stockDisponible += transferenciaActual.cantidad
      }

      if (stockDisponible < nuevaCantidad) {
        return NextResponse.json(
          {
            error: "Stock insuficiente en el punto de venta",
            stockDisponible,
          },
          { status: 400 },
        )
      }
    }

    // Preparar los datos según el tipo de transferencia
    const data: any = {
      productoId,
      cantidad: nuevaCantidad,
      // Limpiar todos los campos de origen y destino
      origenId: null,
      destinoId: null,
      puntoDeVentaOrigenId: null,
      puntoDeVentaDestinoId: null,
    }

    // Configurar origen
    if (tipoOrigen === "almacen") {
      data.origenId = origenId
    } else if (tipoOrigen === "punto_venta") {
      data.puntoDeVentaOrigenId = origenId
    }

    // Configurar destino
    if (tipoDestino === "almacen") {
      data.destinoId = destinoId
    } else if (tipoDestino === "punto_venta") {
      data.puntoDeVentaDestinoId = destinoId
    }

    const oldDelta =
      (transferenciaActual.origenId ? -transferenciaActual.cantidad : 0) +
      (transferenciaActual.destinoId ? transferenciaActual.cantidad : 0)

    const newDelta =
      (tipoOrigen === "almacen" ? -nuevaCantidad : 0) +
      (tipoDestino === "almacen" ? nuevaCantidad : 0)

    const transferencia = await prisma.$transaction(async (tx: any) => {
      const transferenciaActualizada = await tx.transferencia.update({
        where: { transferenciaId: id },
        data,
        include: {
          producto: true,
          origen: true,
          destino: true,
          puntoDeVentaOrigen: true,
          puntoDeVentaDestino: true,
        },
      })

      if (transferenciaActual.productoId !== productoId) {
        if (oldDelta !== 0) {
          await tx.producto.update({
            where: { id: transferenciaActual.productoId },
            data: {
              stock: {
                increment: -oldDelta,
              },
            },
          })
        }

        if (newDelta !== 0) {
          await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: {
                increment: newDelta,
              },
            },
          })
        }
      } else if (newDelta !== oldDelta) {
        await tx.producto.update({
          where: { id: productoId },
          data: {
            stock: {
              increment: newDelta - oldDelta,
            },
          },
        })
      }

      return transferenciaActualizada
    })

    return NextResponse.json(transferencia)
  } catch (error) {
    console.error("Error al actualizar transferencia:", error)
    return NextResponse.json({ error: "Error al actualizar transferencia" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const params = await context.params;
    const { id } = params;

    // Verificar autenticación
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    // Obtener la transferencia con todos los detalles necesarios
    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null, // Solo permitir eliminar si no está ya eliminada
      },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          }
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      }
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    // Validar que no se puede cancelar una transferencia ya cancelada
    if (transferencia.estado === 'CANCELADA') {
      return NextResponse.json({
        error: "La transferencia ya está cancelada"
      }, { status: 400 })
    }

    const stockDelta =
      (transferencia.origenId ? transferencia.cantidad : 0) +
      (transferencia.destinoId ? -transferencia.cantidad : 0)

    // Realizar el soft delete y actualización de stock en una transacción
    await prisma.$transaction(async (tx: any) => {
      // Soft delete: actualizar estado y deletedAt en lugar de eliminar
      await tx.transferencia.update({
        where: { transferenciaId: id },
        data: {
          estado: 'CANCELADA',
          deletedAt: new Date(),
        }
      })

      // Revertir impacto en stock solo si hubo almacén involucrado
      if (stockDelta !== 0) {
        await tx.producto.update({
          where: {
            id: transferencia.productoId
          },
          data: {
            stock: {
              increment: stockDelta
            }
          }
        })
      }
    })

    // Determinar nombres de origen y destino para el mensaje de respuesta
    let origenNombre = ""
    let destinoNombre = ""

    if (transferencia.origen) {
      origenNombre = `${transferencia.origen.nombre} (Almacén)`
    } else if (transferencia.puntoDeVentaOrigen) {
      origenNombre = `${transferencia.puntoDeVentaOrigen.nombre} (Punto de Venta)`
    }

    if (transferencia.destino) {
      destinoNombre = `${transferencia.destino.nombre} (Almacén)`
    } else if (transferencia.puntoDeVentaDestino) {
      destinoNombre = `${transferencia.puntoDeVentaDestino.nombre} (Punto de Venta)`
    }

    return NextResponse.json({
      success: true,
      id: id,
      message: stockDelta !== 0
        ? `Transferencia cancelada. Stock de ${Math.abs(stockDelta)} ${transferencia.producto.unidad?.simbolo || 'unidades'} de ${transferencia.producto.nombre} ajustado.`
        : "Transferencia cancelada exitosamente.",
      detalles: {
        producto: transferencia.producto.nombre,
        cantidad: transferencia.cantidad,
        origen: origenNombre,
        destino: destinoNombre,
        stockAjustado: stockDelta,
        estado: 'CANCELADA'
      }
    })
  } catch (error) {
    console.error("Error al cancelar transferencia:", error)
    return NextResponse.json({
      error: "Error al cancelar transferencia",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
})


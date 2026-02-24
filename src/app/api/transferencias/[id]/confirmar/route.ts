import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

/**
 * @description Endpoint para confirmar la recepción de una transferencia
 * Actualiza el estado según las discrepancias entre cantidad enviada y recibida
 * @param {NextRequest} request - Request con datos de confirmación
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Respuesta con la transferencia actualizada
 */
export const PATCH = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const params = await context.params;
    const { id } = params;
    const { cantidadRecibida } = await request.json()

    // Verificar autenticación
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    // Validar datos de entrada
    if (!id) {
      return NextResponse.json({ error: "ID de transferencia requerido" }, { status: 400 })
    }

    if (cantidadRecibida === undefined || cantidadRecibida === null) {
      return NextResponse.json({ error: "Cantidad recibida requerida" }, { status: 400 })
    }

    const cantidadRecibidaNum = Number(cantidadRecibida)
    if (!Number.isFinite(cantidadRecibidaNum) || cantidadRecibidaNum < 0) {
      return NextResponse.json({ error: "Cantidad recibida inválida" }, { status: 400 })
    }

    // Obtener la transferencia actual
    const transferencia = await prisma.transferencia.findFirst({
      where: {
        transferenciaId: id,
        deletedAt: null,
      },
      include: {
        producto: {
          include: {
            unidad: true,
          },
        },
        origen: true,
        destino: true,
        puntoDeVentaOrigen: true,
        puntoDeVentaDestino: true,
      },
    })

    if (!transferencia) {
      return NextResponse.json({ error: "Transferencia no encontrada" }, { status: 404 })
    }

    // Validar que solo se pueden confirmar transferencias PENDIENTE o EN_TRANSITO
    if (transferencia.estado !== 'PENDIENTE' && transferencia.estado !== 'EN_TRANSITO') {
      return NextResponse.json({
        error: `No se puede confirmar una transferencia en estado ${transferencia.estado}`
      }, { status: 400 })
    }

    // Determinar el nuevo estado según la discrepancia
    const cantidadEnviada = transferencia.cantidad
    let nuevoEstado: 'COMPLETADA' | 'PARCIAL'
    let mensaje: string

    if (cantidadRecibidaNum === cantidadEnviada) {
      nuevoEstado = 'COMPLETADA'
      mensaje = "Recepción confirmada exitosamente - Cantidad completa"
    } else if (cantidadRecibidaNum < cantidadEnviada) {
      nuevoEstado = 'PARCIAL'
      const faltante = cantidadEnviada - cantidadRecibidaNum
      mensaje = `Recepción confirmada - Cantidad parcial. Faltan ${faltante} unidades.`
    } else {
      return NextResponse.json({
        error: "La cantidad recibida no puede ser mayor a la cantidad enviada"
      }, { status: 400 })
    }

    // Ejecutar la actualización en una transacción
    const resultado = await prisma.$transaction(async (tx: any) => {
      // Actualizar la transferencia
      const transferenciaActualizada = await tx.transferencia.update({
        where: { transferenciaId: id },
        data: {
          estado: nuevoEstado,
          cantidad: cantidadRecibidaNum, // Actualizar cantidad a la recibida real
        },
        include: {
          producto: {
            include: {
              unidad: true,
            },
          },
          origen: true,
          destino: true,
          puntoDeVentaOrigen: true,
          puntoDeVentaDestino: true,
        },
      })

      // Si hay discrepancia (recepción parcial), ajustar el stock del origen
      if (nuevoEstado === 'PARCIAL') {
        const diferencia = cantidadEnviada - cantidadRecibidaNum
        
        // Devolver al origen la diferencia si el origen era almacén
        if (transferencia.origenId) {
          await tx.producto.update({
            where: { id: transferencia.productoId },
            data: {
              stock: {
                increment: diferencia,
              },
            },
          })
        }
        
        // Si el destino es almacén, ajustar el stock del destino
        // Nota: El stock ya se incrementó al crear la transferencia, 
        // pero como ahora es menor cantidad, debemos revertir la diferencia
        if (transferencia.destinoId) {
          await tx.producto.update({
            where: { id: transferencia.productoId },
            data: {
              stock: {
                decrement: diferencia,
              },
            },
          })
        }
      }

      return transferenciaActualizada
    })

    // Determinar nombres para el mensaje
    const origenNombre = transferencia.origen?.nombre || transferencia.puntoDeVentaOrigen?.nombre || "Origen"
    const destinoNombre = transferencia.destino?.nombre || transferencia.puntoDeVentaDestino?.nombre || "Destino"

    return NextResponse.json({
      success: true,
      mensaje,
      transferencia: resultado,
      detalles: {
        transferenciaId: id,
        producto: resultado.producto.nombre,
        cantidadEnviada,
        cantidadRecibida: cantidadRecibidaNum,
        diferencia: cantidadEnviada - cantidadRecibidaNum,
        estado: nuevoEstado,
        origen: origenNombre,
        destino: destinoNombre,
      }
    })

  } catch (error) {
    console.error("Error al confirmar recepción:", error)
    return NextResponse.json({
      error: "Error al confirmar recepción de transferencia",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
})

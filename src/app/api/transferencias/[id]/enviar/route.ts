import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

/**
 * @description Endpoint para marcar una transferencia como EN_TRANSITO
 * Se utiliza cuando el producto ha salido del origen pero aún no ha llegado al destino
 * @param {NextRequest} request - Request con el ID de la transferencia
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Respuesta con la transferencia actualizada
 */
export const PATCH = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const params = await context.params;
    const { id } = params;

    // Verificar autenticación
    if (!user || !user.userId) {
      return NextResponse.json({ error: "Usuario no autenticado" }, { status: 401 })
    }

    // Validar ID
    if (!id) {
      return NextResponse.json({ error: "ID de transferencia requerido" }, { status: 400 })
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

    // Validar que solo se pueden enviar transferencias PENDIENTE
    if (transferencia.estado !== 'PENDIENTE') {
      return NextResponse.json({
        error: `No se puede marcar como en tránsito una transferencia en estado ${transferencia.estado}`
      }, { status: 400 })
    }

    // Actualizar la transferencia
    const transferenciaActualizada = await prisma.transferencia.update({
      where: { transferenciaId: id },
      data: {
        estado: 'EN_TRANSITO',
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

    // Determinar nombres para el mensaje
    const origenNombre = transferencia.origen?.nombre || transferencia.puntoDeVentaOrigen?.nombre || "Origen"
    const destinoNombre = transferencia.destino?.nombre || transferencia.puntoDeVentaDestino?.nombre || "Destino"

    return NextResponse.json({
      success: true,
      mensaje: "Transferencia marcada como en tránsito",
      transferencia: transferenciaActualizada,
      detalles: {
        transferenciaId: id,
        producto: transferencia.producto.nombre,
        cantidad: transferencia.cantidad,
        estado: 'EN_TRANSITO',
        origen: origenNombre,
        destino: destinoNombre,
      }
    })

  } catch (error) {
    console.error("Error al marcar como en tránsito:", error)
    return NextResponse.json({
      error: "Error al marcar transferencia como en tránsito",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
})

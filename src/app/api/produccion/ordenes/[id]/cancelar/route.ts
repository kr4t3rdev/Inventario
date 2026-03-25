import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Cancela una orden de producción, liberando los materiales reservados.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden cancelada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || 'system';

    // Obtener la orden con sus ingredientes
    const orden = await prisma.ordenProduccion.findUnique({
      where: { ordenProduccionId: id },
      include: {
        receta: {
          include: {
            ingredientes: true,
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    const estadoOrden = String(orden.estado);
    if (estadoOrden === 'COMPLETADA' || estadoOrden === 'CANCELADA') {
      return NextResponse.json({ error: 'La orden ya no puede ser cancelada.' }, { status: 400 });
    }

    // Si estaba en proceso, liberar los materiales reservados
    if (estadoOrden === 'EN_PROCESO') {
      for (const ingrediente of orden.receta.ingredientes) {
        const cantidadReservada = ingrediente.cantidad * orden.cantidad;
        
        await prisma.producto.update({
          where: { id: ingrediente.productoId },
          data: {
            stock: {
              increment: cantidadReservada,
            },
          },
        });
      }
    }

    // Actualizar estado de la orden
    const ordenActualizada = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: {
        estado: 'CANCELADA',
      },
      include: {
        receta: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
              },
            },
            ingredientes: {
              include: {
                producto: {
                  select: {
                    id: true,
                    nombre: true,
                    precioCosto: true,
                    stock: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Crear historial de estado
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: orden.estado,
        estadoNuevo: 'CANCELADA',
        observaciones: body.observaciones || 'Orden cancelada',
        usuarioId: userId,
      },
    });

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    console.error('Error al cancelar orden de producción:', error);
    return NextResponse.json({ error: 'Error al cancelar orden de producción.' }, { status: 500 });
  }
});

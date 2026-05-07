import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { PRODUCTION_STATES } from '@/lib/constants/production';
import { calcularCantidadRequeridaMaterial } from '@/lib/utils/produccion';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

/**
 * @description Cancela una orden de producción, liberando los materiales reservados.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden cancelada.
 */
export const POST = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || user?.userId || 'system';

    const ordenActualizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.findUnique({
        where: { ordenProduccionId: id },
        include: {
          Receta: {
            include: {
              RecetaIngrediente: {
                include: {
                  Producto: { select: { id: true, almacenId: true } },
                },
              },
            },
          },
        },
      });

      if (!orden) {
        return null;
      }

      const estadoOrden = String(orden.estado);
      if (estadoOrden === PRODUCTION_STATES.COMPLETADA || estadoOrden === PRODUCTION_STATES.CANCELADA) {
        throw new Error('La orden ya no puede ser cancelada.');
      }

      if (estadoOrden === PRODUCTION_STATES.EN_PROCESO) {
        for (const ingrediente of orden.Receta.RecetaIngrediente) {
          const cantidadReservada = calcularCantidadRequeridaMaterial(ingrediente, orden.cantidad);

          await tx.producto.update({
            where: { id: ingrediente.productoId },
            data: {
              stock: {
                increment: cantidadReservada,
              },
            },
          });

          if (ingrediente.Producto?.almacenId) {
            await upsertStockUbicacion(tx, {
              productoId: ingrediente.productoId,
              tipoUbicacion: 'almacen',
              ubicacionId: ingrediente.Producto.almacenId,
              modo: 'increment',
              delta: cantidadReservada,
            });
          }
        }
      }

      const ordenActualizadaInterna = await tx.ordenProduccion.update({
        where: { ordenProduccionId: id },
        data: {
          estado: PRODUCTION_STATES.CANCELADA,
        },
        include: {
          Receta: {
            include: {
              Producto: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              RecetaIngrediente: {
                include: {
                  Producto: {
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

      await tx.ordenProduccionHistorial.create({
        data: {
          ordenProduccionId: id,
          tenantId: orden.tenantId,
          estadoAnterior: orden.estado,
          estadoNuevo: PRODUCTION_STATES.CANCELADA,
          observaciones: body.observaciones || 'Orden cancelada',
          usuarioId: userId,
        },
      });

      return ordenActualizadaInterna;
    });

    if (!ordenActualizada) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(ordenActualizada);
  } catch (error) {
    if (error instanceof Error && error.message === 'La orden ya no puede ser cancelada.') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error al cancelar orden de producción:', error);
    return NextResponse.json({ error: 'Error al cancelar orden de producción.' }, { status: 500 });
  }
});

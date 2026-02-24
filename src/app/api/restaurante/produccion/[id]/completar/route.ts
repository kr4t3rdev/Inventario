import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

interface ProduccionCompletarRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Completa una orden de producción descontando inventario de ingredientes.
 * @param {NextRequest} _request - Request HTTP sin payload.
 * @param {ProduccionCompletarRouteContext} context - Contexto con ID de orden.
 * @returns {Promise<NextResponse>} Orden completada o faltantes detectados.
 */
export const POST = withAuthPost(
  async (_request: NextRequest, context: ProduccionCompletarRouteContext) => {
    try {
      const { id } = await context.params;

      const orden = await prisma.ordenProduccion.findUnique({
        where: { ordenProduccionId: id },
        include: {
          receta: {
            include: {
              ingredientes: {
                include: {
                  producto: {
                    select: {
                      id: true,
                      nombre: true,
                      stock: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!orden) {
        return NextResponse.json(
          { error: 'Orden de producción no encontrada.' },
          { status: 404 }
        );
      }

      if (orden.estado === 'COMPLETADA') {
        return NextResponse.json(
          { error: 'La orden ya fue completada.' },
          { status: 409 }
        );
      }

      if (orden.estado === 'CANCELADA') {
        return NextResponse.json(
          { error: 'No se puede completar una orden cancelada.' },
          { status: 409 }
        );
      }

      const faltantes = orden.receta.ingredientes
        .map((ingrediente) => {
          const factorDesperdicio = 1 + ingrediente.desperdicio / 100;
          const requerido = Math.ceil(
            ingrediente.cantidad * factorDesperdicio * orden.cantidad
          );

          return {
            productoId: ingrediente.producto.id,
            productoNombre: ingrediente.producto.nombre,
            stockActual: ingrediente.producto.stock,
            requerido,
            faltante: Math.max(0, requerido - ingrediente.producto.stock),
          };
        })
        .filter((item) => item.faltante > 0);

      if (faltantes.length > 0) {
        return NextResponse.json(
          {
            error: 'Stock insuficiente para completar producción.',
            faltantes,
          },
          { status: 409 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const ingrediente of orden.receta.ingredientes) {
          const factorDesperdicio = 1 + ingrediente.desperdicio / 100;
          const requerido = Math.ceil(
            ingrediente.cantidad * factorDesperdicio * orden.cantidad
          );

          await tx.producto.update({
            where: { id: ingrediente.productoId },
            data: {
              stock: {
                decrement: requerido,
              },
            },
          });
        }

        return tx.ordenProduccion.update({
          where: { ordenProduccionId: id },
          data: {
            estado: 'COMPLETADA',
          },
          include: {
            receta: {
              include: {
                ingredientes: {
                  include: {
                    producto: {
                      select: {
                        id: true,
                        nombre: true,
                        stock: true,
                        precioCosto: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      });

      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Orden de producción no encontrada.' },
          { status: 404 }
        );
      }

      console.error('Error al completar orden de producción:', error);
      return NextResponse.json(
        { error: 'Error al completar orden de producción.' },
        { status: 500 }
      );
    }
  }
);

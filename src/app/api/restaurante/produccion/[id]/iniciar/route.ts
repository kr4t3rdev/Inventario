import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

interface ProduccionIniciarRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Marca una orden de producción como en proceso.
 * @param {NextRequest} _request - Request HTTP sin payload.
 * @param {ProduccionIniciarRouteContext} context - Contexto con ID de orden.
 * @returns {Promise<NextResponse>} Orden actualizada.
 */
export const POST = withAuthPost(
  async (_request: NextRequest, context: ProduccionIniciarRouteContext) => {
    try {
      const { id } = await context.params;

      const orden = await prisma.ordenProduccion.findUnique({
        where: { ordenProduccionId: id },
        select: {
          ordenProduccionId: true,
          estado: true,
        },
      });

      if (!orden) {
        return NextResponse.json(
          { error: 'Orden de producción no encontrada.' },
          { status: 404 }
        );
      }

      if (orden.estado !== 'PENDIENTE') {
        return NextResponse.json(
          { error: 'Solo se pueden iniciar órdenes pendientes.' },
          { status: 409 }
        );
      }

      const updated = await prisma.ordenProduccion.update({
        where: { ordenProduccionId: id },
        data: { estado: 'EN_PROCESO' },
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

      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
      }

      console.error('Error al iniciar orden de producción:', error);
      return NextResponse.json(
        { error: 'Error al iniciar orden de producción.' },
        { status: 500 }
      );
    }
  }
);

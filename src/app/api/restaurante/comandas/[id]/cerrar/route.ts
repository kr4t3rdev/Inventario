import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

interface ComandaCerrarRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Cierra una comanda abierta y libera la mesa asociada.
 * @param {NextRequest} _request - Request HTTP sin payload.
 * @param {ComandaCerrarRouteContext} context - Contexto con ID de comanda.
 * @returns {Promise<NextResponse>} Comanda cerrada.
 */
export const POST = withAuthPost(
  async (_request: NextRequest, context: ComandaCerrarRouteContext) => {
    try {
      const { id } = await context.params;

      const comanda = await prisma.comanda.findUnique({
        where: { comandaId: id },
        select: {
          comandaId: true,
          estado: true,
          mesaId: true,
        },
      });

      if (!comanda) {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      if (comanda.estado !== 'ABIERTA') {
        return NextResponse.json(
          { error: 'La comanda ya se encuentra cerrada o cancelada.' },
          { status: 409 }
        );
      }

      const closedComanda = await prisma.$transaction(async (tx) => {
        const updated = await tx.comanda.update({
          where: { comandaId: id },
          data: {
            estado: 'CERRADA',
            fechaCierre: new Date(),
          },
          include: {
            mesa: true,
            items: {
              include: {
                plato: {
                  select: {
                    platoId: true,
                    nombre: true,
                    precio: true,
                    tipoPlato: true,
                  },
                },
              },
            },
          },
        });

        await tx.mesa.update({
          where: { mesaId: comanda.mesaId },
          data: { estado: 'DISPONIBLE' },
        });

        return updated;
      });

      return NextResponse.json(closedComanda);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      console.error('Error al cerrar comanda:', error);
      return NextResponse.json({ error: 'Error al cerrar comanda.' }, { status: 500 });
    }
  }
);

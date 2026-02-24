import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const estadoItemSchema = z.enum(['PENDIENTE', 'EN_PROCESO', 'LISTO', 'SERVIDO']);

const updateEstadoItemSchema = z.object({
  estado: estadoItemSchema,
});

interface KdsItemEstadoRouteContext {
  params: Promise<{ itemId: string }>;
}

/**
 * @description Actualiza estado de un ítem de comanda para flujo KDS.
 * @param {NextRequest} request - Request con estado destino.
 * @param {KdsItemEstadoRouteContext} context - Contexto con ID de item.
 * @returns {Promise<NextResponse>} Item actualizado.
 */
export const PATCH = withAuth(
  async (request: NextRequest, context: KdsItemEstadoRouteContext) => {
    try {
      const { itemId } = await context.params;
      const payload = updateEstadoItemSchema.parse(await request.json());

      const item = await prisma.comandaItem.findUnique({
        where: { comandaItemId: itemId },
        select: {
          comandaItemId: true,
          comandaId: true,
        },
      });

      if (!item) {
        return NextResponse.json({ error: 'Ítem no encontrado.' }, { status: 404 });
      }

      const updatedItem = await prisma.comandaItem.update({
        where: { comandaItemId: itemId },
        data: { estado: payload.estado },
        include: {
          plato: {
            select: {
              platoId: true,
              nombre: true,
              tipoPlato: true,
            },
          },
        },
      });

      const pendingCount = await prisma.comandaItem.count({
        where: {
          comandaId: item.comandaId,
          estado: {
            not: 'SERVIDO',
          },
        },
      });

      return NextResponse.json({
        item: updatedItem,
        comandaId: item.comandaId,
        pendingCount,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para actualizar estado.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Ítem no encontrado.' }, { status: 404 });
      }

      console.error('Error al actualizar estado KDS:', error);
      return NextResponse.json(
        { error: 'Error al actualizar estado KDS.' },
        { status: 500 }
      );
    }
  }
);

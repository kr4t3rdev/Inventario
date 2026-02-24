import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const anularItemSchema = z.object({
  cantidad: z.number().int().min(1),
  motivo: z.string().min(3).max(300).optional(),
});

interface AnularComandaItemRouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * @description Reduce o elimina parcialmente un ítem de comanda abierta.
 * @param {NextRequest} request - Request con cantidad a anular.
 * @param {AnularComandaItemRouteContext} context - Contexto con IDs de comanda e ítem.
 * @returns {Promise<NextResponse>} Comanda recalculada.
 */
export const POST = withAuthPost(
  async (request: NextRequest, context: AnularComandaItemRouteContext) => {
    try {
      const { id, itemId } = await context.params;
      const payload = anularItemSchema.parse(await request.json());

      const comanda = await prisma.comanda.findUnique({
        where: { comandaId: id },
        select: {
          comandaId: true,
          estado: true,
          observaciones: true,
        },
      });

      if (!comanda) {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      if (comanda.estado !== 'ABIERTA') {
        return NextResponse.json(
          { error: 'Solo se pueden anular ítems en comanda abierta.' },
          { status: 409 }
        );
      }

      const item = await prisma.comandaItem.findFirst({
        where: {
          comandaItemId: itemId,
          comandaId: id,
        },
        select: {
          comandaItemId: true,
          platoId: true,
          cantidad: true,
          precioUnitario: true,
          plato: {
            select: {
              nombre: true,
            },
          },
        },
      });

      if (!item) {
        return NextResponse.json({ error: 'Ítem de comanda no encontrado.' }, { status: 404 });
      }

      if (payload.cantidad > item.cantidad) {
        return NextResponse.json(
          { error: 'La cantidad a anular no puede superar la cantidad actual.' },
          { status: 400 }
        );
      }

      const updatedComanda = await prisma.$transaction(async (tx) => {
        const remaining = item.cantidad - payload.cantidad;

        if (remaining === 0) {
          await tx.comandaItem.delete({
            where: {
              comandaItemId: item.comandaItemId,
            },
          });
        } else {
          await tx.comandaItem.update({
            where: {
              comandaItemId: item.comandaItemId,
            },
            data: {
              cantidad: remaining,
            },
          });
        }

        const items = await tx.comandaItem.findMany({
          where: { comandaId: id },
          select: {
            cantidad: true,
            precioUnitario: true,
          },
        });

        const total = items.reduce(
          (acc, comandaItem) => acc + comandaItem.cantidad * comandaItem.precioUnitario,
          0
        );

        const anulationMeta = {
          timestamp: new Date().toISOString(),
          itemId: item.comandaItemId,
          platoNombre: item.plato.nombre,
          cantidadAnulada: payload.cantidad,
          motivo: payload.motivo ?? 'Ajuste operativo',
        };

        return tx.comanda.update({
          where: { comandaId: id },
          data: {
            total,
            observaciones: comanda.observaciones
              ? `${comanda.observaciones}\n[ANULACION_JSON]${JSON.stringify(anulationMeta)}`
              : `[ANULACION_JSON]${JSON.stringify(anulationMeta)}`,
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
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      });

      return NextResponse.json(updatedComanda);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para anulación de ítem.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Ítem o comanda no encontrado.' }, { status: 404 });
      }

      console.error('Error al anular ítem de comanda:', error);
      return NextResponse.json(
        { error: 'Error al anular ítem de comanda.' },
        { status: 500 }
      );
    }
  }
);

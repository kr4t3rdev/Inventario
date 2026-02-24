import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addComandaItemSchema = z.object({
  platoId: z.string().min(1),
  cantidad: z.number().int().min(1).max(100),
  notas: z.string().max(500).optional(),
});

interface ComandaItemRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Agrega un item a una comanda abierta y recalcula total.
 * @param {NextRequest} request - Request HTTP con datos del item.
 * @param {ComandaItemRouteContext} context - Contexto con ID de comanda.
 * @returns {Promise<NextResponse>} Comanda actualizada con items.
 */
export const POST = withAuthPost(
  async (request: NextRequest, context: ComandaItemRouteContext) => {
    try {
      const { id } = await context.params;
      const payload = addComandaItemSchema.parse(await request.json());

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
          { error: 'Solo se pueden agregar ítems a comandas abiertas.' },
          { status: 409 }
        );
      }

      const plato = await prisma.plato.findUnique({
        where: { platoId: payload.platoId },
        select: {
          platoId: true,
          precio: true,
          disponible: true,
        },
      });

      if (!plato) {
        return NextResponse.json({ error: 'Plato no encontrado.' }, { status: 404 });
      }

      if (!plato.disponible) {
        return NextResponse.json(
          { error: 'El plato no está disponible actualmente.' },
          { status: 409 }
        );
      }

      const updatedComanda = await prisma.$transaction(async (tx) => {
        await tx.comandaItem.create({
          data: {
            comandaId: id,
            platoId: payload.platoId,
            cantidad: payload.cantidad,
            precioUnitario: plato.precio,
            notas: payload.notas,
          },
        });

        const items = await tx.comandaItem.findMany({
          where: { comandaId: id },
          select: {
            cantidad: true,
            precioUnitario: true,
          },
        });

        const total = items.reduce(
          (acc, item) => acc + item.cantidad * item.precioUnitario,
          0
        );

        return tx.comanda.update({
          where: { comandaId: id },
          data: {
            total,
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
          { error: 'Datos inválidos para agregar ítem.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Comanda o plato no encontrado.' },
          { status: 404 }
        );
      }

      console.error('Error al agregar item a comanda:', error);
      return NextResponse.json(
        { error: 'Error al agregar item a comanda.' },
        { status: 500 }
      );
    }
  }
);

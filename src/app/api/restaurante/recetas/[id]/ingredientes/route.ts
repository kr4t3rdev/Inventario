import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const recetaIngredienteSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().positive(),
  desperdicio: z.number().min(0).max(100).default(0),
});

const setIngredientesSchema = z.object({
  ingredientes: z.array(recetaIngredienteSchema).min(1),
});

interface RecetaIngredientesRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Reemplaza ingredientes de una receta y recalcula costo unitario.
 * @param {NextRequest} request - Request HTTP con ingredientes.
 * @param {RecetaIngredientesRouteContext} context - Contexto con ID de receta.
 * @returns {Promise<NextResponse>} Receta actualizada con ingredientes.
 */
export const POST = withAuthPost(
  async (request: NextRequest, context: RecetaIngredientesRouteContext) => {
    try {
      const { id } = await context.params;
      const payload = setIngredientesSchema.parse(await request.json());

      const receta = await prisma.receta.findUnique({
        where: { recetaId: id },
        select: {
          recetaId: true,
          rendimiento: true,
        },
      });

      if (!receta) {
        return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
      }

      const productoIds = payload.ingredientes.map((item) => item.productoId);
      const productos = await prisma.producto.findMany({
        where: { id: { in: productoIds } },
        select: {
          id: true,
          nombre: true,
          precioCosto: true,
        },
      });

      if (productos.length !== productoIds.length) {
        return NextResponse.json(
          { error: 'Uno o más productos no existen.' },
          { status: 404 }
        );
      }

      const productoMap = new Map(productos.map((producto) => [producto.id, producto]));

      const costoTotal = payload.ingredientes.reduce((acc, ingrediente) => {
        const producto = productoMap.get(ingrediente.productoId);
        if (!producto) {
          return acc;
        }

        const factorDesperdicio = 1 + ingrediente.desperdicio / 100;
        return acc + ingrediente.cantidad * factorDesperdicio * producto.precioCosto;
      }, 0);

      const costoUnitario = Math.round(costoTotal / receta.rendimiento);

      const updatedReceta = await prisma.$transaction(async (tx) => {
        await tx.recetaIngrediente.deleteMany({ where: { recetaId: id } });

        await tx.recetaIngrediente.createMany({
          data: payload.ingredientes.map((ingrediente) => ({
            recetaId: id,
            productoId: ingrediente.productoId,
            cantidad: ingrediente.cantidad,
            desperdicio: ingrediente.desperdicio,
          })),
        });

        return tx.receta.update({
          where: { recetaId: id },
          data: {
            costoUnitario,
          },
          include: {
            plato: {
              select: {
                platoId: true,
                nombre: true,
                precio: true,
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
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });
      });

      return NextResponse.json(updatedReceta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para ingredientes.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
      }

      console.error('Error al actualizar ingredientes de receta:', error);
      return NextResponse.json(
        { error: 'Error al actualizar ingredientes de receta.' },
        { status: 500 }
      );
    }
  }
);

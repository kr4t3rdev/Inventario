import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateRecetaSchema = z
  .object({
    nombre: z.string().min(1).max(160).optional(),
    rendimiento: z.number().int().min(1).optional(),
    instrucciones: z.string().max(4000).optional(),
    tiempoPrep: z.number().int().min(1).max(1440).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

interface RecetaRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Actualiza una receta existente.
 * @param {NextRequest} request - Request HTTP con datos parciales.
 * @param {RecetaRouteContext} context - Contexto de ruta con ID de receta.
 * @returns {Promise<NextResponse>} Receta actualizada.
 */
export const PATCH = withAuth(
  async (request: NextRequest, context: RecetaRouteContext) => {
    try {
      const { id } = await context.params;
      const payload = updateRecetaSchema.parse(await request.json());

      const receta = await prisma.receta.update({
        where: { recetaId: id },
        data: payload,
        include: {
          Producto: {
            select: {
              id: true,
              nombre: true,
              precioCosto: true,
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
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      return NextResponse.json(receta);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para actualizar receta.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
      }

      console.error('Error al actualizar receta:', error);
      return NextResponse.json({ error: 'Error al actualizar receta.' }, { status: 500 });
    }
  }
);

/**
 * @description Elimina una receta por ID.
 * @param {NextRequest} _request - Request HTTP de eliminación.
 * @param {RecetaRouteContext} context - Contexto de ruta con ID de receta.
 * @returns {Promise<NextResponse>} Resultado de eliminación.
 */
export const DELETE = withAuth(
  async (_request: NextRequest, context: RecetaRouteContext) => {
    try {
      const { id } = await context.params;
      await prisma.receta.delete({ where: { recetaId: id } });

      return NextResponse.json({ success: true, recetaId: id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
      }

      console.error('Error al eliminar receta:', error);
      return NextResponse.json({ error: 'Error al eliminar receta.' }, { status: 500 });
    }
  }
);

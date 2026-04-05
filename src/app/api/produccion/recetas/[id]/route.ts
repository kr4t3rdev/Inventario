import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateRecetaSchema = z.object({
  nombre: z.string().min(1).max(160).optional(),
  rendimiento: z.number().int().min(1).optional(),
  productoId: z.string().nullable().optional(),
  instrucciones: z.string().max(4000).optional().nullable(),
  tiempoPrep: z.number().int().min(1).max(1440).optional().nullable(),
});

/**
 * @description Obtiene una receta de producción por ID.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Receta encontrada.
 */
export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    
    const receta = await prisma.receta.findUnique({
      where: { recetaId: id },
      include: {
        Producto: {
          select: {
            id: true,
            nombre: true,
            precioCosto: true,
            stock: true,
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

    if (!receta) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    return NextResponse.json(receta);
  } catch (error) {
    console.error('Error al obtener receta de producción:', error);
    return NextResponse.json({ error: 'Error al obtener receta de producción.' }, { status: 500 });
  }
});

/**
 * @description Actualiza una receta de producción.
 * @param {NextRequest} request - Request HTTP con datos de actualización.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Receta actualizada.
 */
export const PATCH = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const payload = updateRecetaSchema.parse(await request.json());

    const receta = await prisma.receta.update({
      where: { recetaId: id },
      data: payload,
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
    });

    return NextResponse.json(receta);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para actualizar receta.', issues: error.issues },
        { status: 400 }
      );
    }
    }

    console.error('Error al actualizar receta de producción:', error);
    return NextResponse.json({ error: 'Error al actualizar receta de producción.' }, { status: 500 });
  }
});

/**
 * @description Elimina una receta de producción.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Respuesta de eliminación.
 */
export const DELETE = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    await prisma.receta.delete({
      where: { recetaId: id },
    });

    return NextResponse.json({ success: true, message: 'Receta eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar receta de producción:', error);
    return NextResponse.json({ error: 'Error al eliminar receta de producción.' }, { status: 500 });
  }
});

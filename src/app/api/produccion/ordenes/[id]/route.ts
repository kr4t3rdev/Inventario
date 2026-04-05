import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Obtiene una orden de producción por ID.
 * @param {NextRequest} request - Request HTTP.
 * @param {object} params - Parámetros de la ruta.
 * @returns {Promise<NextResponse>} Orden encontrada.
 */
export const GET = withAuthGet(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    
    const orden = await prisma.ordenProduccion.findUnique({
      where: { ordenProduccionId: id },
      include: {
        Receta: {
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
            },
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de producción no encontrada.' }, { status: 404 });
    }

    const ordenNormalizada = {
      ...orden,
      receta: orden.Receta
        ? {
            ...orden.Receta,
            producto: orden.Receta.Producto,
            ingredientes: orden.Receta.RecetaIngrediente.map((ing) => ({
              ...ing,
              producto: ing.Producto,
            })),
          }
        : null,
    };

    return NextResponse.json(ordenNormalizada);
  } catch (error) {
    console.error('Error al obtener orden de producción:', error);
    return NextResponse.json({ error: 'Error al obtener orden de producción.' }, { status: 500 });
  }
});

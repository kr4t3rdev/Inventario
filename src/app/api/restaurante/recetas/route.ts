import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createRecetaSchema = z.object({
  nombre: z.string().min(1).max(160),
  rendimiento: z.number().int().min(1).default(1),
  instrucciones: z.string().max(4000).optional(),
  tiempoPrep: z.number().int().min(1).max(1440).optional(),
});

/**
 * @description Obtiene recetas de restaurante con sus ingredientes.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Recetas encontradas.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim();

    const recetas = await prisma.receta.findMany({
      where: {
        ...(search
          ? {
              nombre: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(recetas);
  } catch (error) {
    console.error('Error al obtener recetas:', error);
    return NextResponse.json({ error: 'Error al obtener recetas.' }, { status: 500 });
  }
});

/**
 * @description Crea una receta base para producción.
 * @param {NextRequest} request - Request HTTP con datos de receta.
 * @returns {Promise<NextResponse>} Receta creada.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createRecetaSchema.parse(await request.json());

    const receta = await prisma.receta.create({
      data: {
        nombre: payload.nombre,
        rendimiento: payload.rendimiento,
        instrucciones: payload.instrucciones,
        tiempoPrep: payload.tiempoPrep,
      },
      include: {
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
        },
      },
    });

    return NextResponse.json(receta, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para crear receta.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al crear receta:', error);
    return NextResponse.json({ error: 'Error al crear receta.' }, { status: 500 });
  }
});

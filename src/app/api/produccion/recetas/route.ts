import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createRecetaSchema = z.object({
  nombre: z.string().min(1).max(160),
  rendimiento: z.number().int().min(1).default(1),
  productoId: z.string().optional(),
  instrucciones: z.string().max(4000).optional(),
  tiempoPrep: z.number().int().min(1).max(1440).optional(),
});

/**
 * @description Obtiene recetas de producción con filtro opcional por producto.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Recetas encontradas.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.trim();
    const productoId = searchParams.get('productoId')?.trim();

    const whereClause: any = {};

    if (search) {
      whereClause.nombre = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (productoId) {
      whereClause.productoId = productoId;
    }

    const recetas = await prisma.receta.findMany({
      where: whereClause,
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            precioCosto: true,
            stock: true,
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
    console.error('Error al obtener recetas de producción:', error);
    return NextResponse.json({ error: 'Error al obtener recetas de producción.' }, { status: 500 });
  }
});

/**
 * @description Crea una receta para producción de productos.
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
        productoId: payload.productoId || null,
        instrucciones: payload.instrucciones,
        tiempoPrep: payload.tiempoPrep,
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
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

    console.error('Error al crear receta de producción:', error);
    return NextResponse.json({ error: 'Error al crear receta de producción.' }, { status: 500 });
  }
});

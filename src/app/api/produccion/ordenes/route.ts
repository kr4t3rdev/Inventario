import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createOrdenSchema = z.object({
  recetaId: z.string().min(1),
  cantidad: z.number().int().positive(),
  observaciones: z.string().max(1000).optional(),
  fechaProduccion: z.string().optional(),
});

/**
 * @description Obtiene órdenes de producción con filtro opcional por estado.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Órdenes encontradas.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estado = searchParams.get('estado')?.trim();

    const whereClause: any = {};

    if (estado) {
      whereClause.estado = estado;
    }

    const ordenes = await prisma.ordenProduccion.findMany({
      where: whereClause,
      include: {
        receta: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(ordenes);
  } catch (error) {
    console.error('Error al obtener órdenes de producción:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes de producción.' }, { status: 500 });
  }
});

/**
 * @description Crea una nueva orden de producción.
 * @param {NextRequest} request - Request HTTP con datos de la orden.
 * @returns {Promise<NextResponse>} Orden creada.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createOrdenSchema.parse(await request.json());

    // Verificar que la receta existe
    const receta = await prisma.receta.findUnique({
      where: { recetaId: payload.recetaId },
      include: {
        ingredientes: true,
      },
    });

    if (!receta) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    const orden = await prisma.ordenProduccion.create({
      data: {
        recetaId: payload.recetaId,
        cantidad: payload.cantidad,
        observaciones: payload.observaciones,
        fechaProduccion: payload.fechaProduccion ? new Date(payload.fechaProduccion) : new Date(),
        estado: 'PENDIENTE',
      },
      include: {
        receta: {
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
        },
      },
    });

    return NextResponse.json(orden, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para crear orden.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al crear orden de producción:', error);
    return NextResponse.json({ error: 'Error al crear orden de producción.' }, { status: 500 });
  }
});

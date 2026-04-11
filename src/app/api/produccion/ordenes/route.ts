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
        Receta: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const ordenesNormalizadas = ordenes.map((orden) => ({
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
    }));

    return NextResponse.json(ordenesNormalizadas);
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
        RecetaIngrediente: true,
      },
    });

    if (!receta) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    if (!receta.productoId) {
      return NextResponse.json(
        { error: 'La receta no tiene producto final configurado. Seleccioná o creá uno antes de generar la orden.' },
        { status: 400 }
      );
    }

    const orden = await prisma.ordenProduccion.create({
      data: {
        ordenProduccionId: crypto.randomUUID(),
        recetaId: payload.recetaId,
        cantidad: payload.cantidad,
        observaciones: payload.observaciones,
        fechaProduccion: payload.fechaProduccion ? new Date(payload.fechaProduccion) : new Date(),
        estado: 'PENDIENTE',
        updatedAt: new Date(),
      },
      include: {
        Receta: {
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
        },
      },
    });

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

    return NextResponse.json(ordenNormalizada, { status: 201 });
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

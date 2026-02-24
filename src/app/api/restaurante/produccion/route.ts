import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const estadoProduccionSchema = z.enum([
  'PENDIENTE',
  'EN_PROCESO',
  'COMPLETADA',
  'CANCELADA',
]);

const createOrdenProduccionSchema = z.object({
  recetaId: z.string().min(1),
  cantidad: z.number().int().min(1),
  observaciones: z.string().max(500).optional(),
  fechaProduccion: z.string().datetime().optional(),
});

/**
 * @description Obtiene órdenes de producción con filtros opcionales.
 * @param {NextRequest} request - Request HTTP con query params.
 * @returns {Promise<NextResponse>} Listado de órdenes.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estadoRaw = searchParams.get('estado');

    const estado = estadoRaw ? estadoProduccionSchema.safeParse(estadoRaw) : null;
    if (estado && !estado.success) {
      return NextResponse.json(
        { error: 'Estado de producción inválido.' },
        { status: 400 }
      );
    }

    const ordenes = await prisma.ordenProduccion.findMany({
      where: {
        ...(estado?.success ? { estado: estado.data } : {}),
      },
      include: {
        receta: {
          include: {
            ingredientes: {
              include: {
                producto: {
                  select: {
                    id: true,
                    nombre: true,
                    stock: true,
                    precioCosto: true,
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
    return NextResponse.json(
      { error: 'Error al obtener órdenes de producción.' },
      { status: 500 }
    );
  }
});

/**
 * @description Crea una orden de producción para una receta.
 * @param {NextRequest} request - Request HTTP con payload de orden.
 * @returns {Promise<NextResponse>} Orden creada.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createOrdenProduccionSchema.parse(await request.json());

    const receta = await prisma.receta.findUnique({
      where: { recetaId: payload.recetaId },
      select: { recetaId: true },
    });

    if (!receta) {
      return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });
    }

    const orden = await prisma.ordenProduccion.create({
      data: {
        recetaId: payload.recetaId,
        cantidad: payload.cantidad,
        observaciones: payload.observaciones,
        fechaProduccion: payload.fechaProduccion
          ? new Date(payload.fechaProduccion)
          : new Date(),
      },
      include: {
        receta: {
          include: {
            ingredientes: {
              include: {
                producto: {
                  select: {
                    id: true,
                    nombre: true,
                    stock: true,
                    precioCosto: true,
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
    return NextResponse.json(
      { error: 'Error al crear orden de producción.' },
      { status: 500 }
    );
  }
});

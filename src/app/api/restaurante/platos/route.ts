import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const tipoPlatoSchema = z.enum(['COMIDA', 'BEBIDA', 'POSTRE', 'APERITIVO']);

const createPlatoSchema = z.object({
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(500).optional(),
  precio: z.number().int().min(0),
  tipoPlato: tipoPlatoSchema,
  disponible: z.boolean().optional(),
  categoriaPlatoId: z.string().optional(),
  esElaborado: z.boolean().optional(),
});

/**
 * @description Obtiene platos de restaurante para carta y POS.
 * @param {NextRequest} request - Request HTTP con filtros opcionales.
 * @returns {Promise<NextResponse>} Listado de platos.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const disponible = searchParams.get('disponible');

    const platos = await prisma.plato.findMany({
      where: {
        ...(disponible === 'true' ? { disponible: true } : {}),
      },
      include: {
        categoriaPlato: {
          select: {
            categoriaPlatoId: true,
            nombre: true,
          },
        },
      },
      orderBy: [{ disponible: 'desc' }, { nombre: 'asc' }],
    });

    return NextResponse.json(platos);
  } catch (error) {
    console.error('Error al obtener platos:', error);
    return NextResponse.json({ error: 'Error al obtener platos.' }, { status: 500 });
  }
});

/**
 * @description Crea un plato para carta de restaurante.
 * @param {NextRequest} request - Request HTTP con datos del plato.
 * @returns {Promise<NextResponse>} Plato creado.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createPlatoSchema.parse(await request.json());

    if (payload.categoriaPlatoId) {
      const categoriaExists = await prisma.categoriaPlato.findUnique({
        where: { categoriaPlatoId: payload.categoriaPlatoId },
        select: { categoriaPlatoId: true },
      });

      if (!categoriaExists) {
        return NextResponse.json(
          { error: 'La categoría de plato no existe.' },
          { status: 404 }
        );
      }
    }

    const plato = await prisma.plato.create({
      data: {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        precio: payload.precio,
        tipoPlato: payload.tipoPlato,
        disponible: payload.disponible ?? true,
        categoriaPlatoId: payload.categoriaPlatoId,
        esElaborado: payload.esElaborado ?? false,
      },
      include: {
        categoriaPlato: {
          select: {
            categoriaPlatoId: true,
            nombre: true,
          },
        },
      },
    });

    return NextResponse.json(plato, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para crear plato.', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un plato con esa referencia única.' },
        { status: 409 }
      );
    }

    console.error('Error al crear plato:', error);
    return NextResponse.json({ error: 'Error al crear plato.' }, { status: 500 });
  }
});

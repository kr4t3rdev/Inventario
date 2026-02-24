import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const estadoMesaSchema = z.enum(['DISPONIBLE', 'OCUPADA', 'RESERVADA']);

const createMesaSchema = z.object({
  numero: z.number().int().min(1),
  capacidad: z.number().int().min(1).max(20).default(4),
  estado: estadoMesaSchema.optional(),
});

/**
 * @description Obtiene el listado de mesas del restaurante con filtros opcionales.
 * @param {NextRequest} request - Request HTTP con parámetros de filtro.
 * @returns {Promise<NextResponse>} Respuesta JSON con las mesas.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estadoRaw = searchParams.get('estado');
    const numeroRaw = searchParams.get('numero');

    const estado = estadoRaw ? estadoMesaSchema.safeParse(estadoRaw) : null;
    if (estado && !estado.success) {
      return NextResponse.json({ error: 'Estado de mesa inválido.' }, { status: 400 });
    }

    const numero = numeroRaw ? Number(numeroRaw) : null;
    if (numeroRaw && (!Number.isInteger(numero) || Number(numero) < 1)) {
      return NextResponse.json({ error: 'Número de mesa inválido.' }, { status: 400 });
    }

    const mesas = await prisma.mesa.findMany({
      where: {
        ...(estado?.success ? { estado: estado.data } : {}),
        ...(numero ? { numero } : {}),
      },
      orderBy: { numero: 'asc' },
    });

    return NextResponse.json(mesas);
  } catch (error) {
    console.error('Error al obtener mesas del restaurante:', error);
    return NextResponse.json(
      { error: 'Error al obtener mesas del restaurante.' },
      { status: 500 }
    );
  }
});

/**
 * @description Crea una nueva mesa de restaurante.
 * @param {NextRequest} request - Request HTTP con payload de creación.
 * @returns {Promise<NextResponse>} Respuesta JSON con la mesa creada.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createMesaSchema.parse(await request.json());

    const mesa = await prisma.mesa.create({
      data: {
        numero: payload.numero,
        capacidad: payload.capacidad,
        ...(payload.estado ? { estado: payload.estado } : {}),
      },
    });

    return NextResponse.json(mesa, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Datos inválidos para crear la mesa.',
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Ya existe una mesa con ese número.' },
        { status: 409 }
      );
    }

    console.error('Error al crear mesa del restaurante:', error);
    return NextResponse.json(
      { error: 'Error al crear mesa del restaurante.' },
      { status: 500 }
    );
  }
});

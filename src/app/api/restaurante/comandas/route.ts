import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const estadoComandaSchema = z.enum(['ABIERTA', 'CERRADA', 'CANCELADA']);

const createComandaSchema = z.object({
  mesaId: z.string().min(1),
  empleadoId: z.string().optional(),
  observaciones: z.string().max(500).optional(),
});

/**
 * @description Obtiene comandas del restaurante con filtros opcionales.
 * @param {NextRequest} request - Request HTTP con query params.
 * @returns {Promise<NextResponse>} Listado de comandas.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estadoRaw = searchParams.get('estado');
    const mesaId = searchParams.get('mesaId');

    const estado = estadoRaw ? estadoComandaSchema.safeParse(estadoRaw) : null;
    if (estado && !estado.success) {
      return NextResponse.json({ error: 'Estado de comanda inválido.' }, { status: 400 });
    }

    const comandas = await prisma.comanda.findMany({
      where: {
        ...(estado?.success ? { estado: estado.data } : {}),
        ...(mesaId ? { mesaId } : {}),
      },
      include: {
        mesa: true,
        empleado: {
          select: {
            empleadoId: true,
            nombre: true,
            apellido: true,
          },
        },
        items: {
          include: {
            plato: {
              select: {
                platoId: true,
                nombre: true,
                precio: true,
                tipoPlato: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { fechaApertura: 'desc' },
    });

    return NextResponse.json(comandas);
  } catch (error) {
    console.error('Error al obtener comandas:', error);
    return NextResponse.json({ error: 'Error al obtener comandas.' }, { status: 500 });
  }
});

/**
 * @description Crea una comanda para una mesa.
 * @param {NextRequest} request - Request HTTP con datos de apertura.
 * @returns {Promise<NextResponse>} Comanda creada.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const payload = createComandaSchema.parse(await request.json());

    const mesa = await prisma.mesa.findUnique({ where: { mesaId: payload.mesaId } });
    if (!mesa) {
      return NextResponse.json({ error: 'La mesa no existe.' }, { status: 404 });
    }

    const comandaExistente = await prisma.comanda.findFirst({
      where: { mesaId: payload.mesaId, estado: 'ABIERTA' },
      select: { comandaId: true },
    });

    if (comandaExistente) {
      return NextResponse.json(
        { error: 'La mesa ya tiene una comanda abierta.' },
        { status: 409 }
      );
    }

    const comanda = await prisma.$transaction(async (tx) => {
      const created = await tx.comanda.create({
        data: {
          mesaId: payload.mesaId,
          empleadoId: payload.empleadoId,
          observaciones: payload.observaciones,
        },
        include: {
          mesa: true,
          empleado: {
            select: {
              empleadoId: true,
              nombre: true,
              apellido: true,
            },
          },
          items: {
            include: {
              plato: {
                select: {
                  platoId: true,
                  nombre: true,
                  precio: true,
                  tipoPlato: true,
                },
              },
            },
          },
        },
      });

      await tx.mesa.update({
        where: { mesaId: payload.mesaId },
        data: { estado: 'OCUPADA' },
      });

      return created;
    });

    return NextResponse.json(comanda, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para crear comanda.', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Mesa no encontrada.' }, { status: 404 });
    }

    console.error('Error al crear comanda:', error);
    return NextResponse.json({ error: 'Error al crear comanda.' }, { status: 500 });
  }
});

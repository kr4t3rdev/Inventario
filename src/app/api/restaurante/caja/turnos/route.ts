import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const abrirTurnoSchema = z.object({
  observaciones: z.string().max(500).optional(),
});

/**
 * @description Lista turnos POS del cajero actual y turno activo.
 * @param {NextRequest} _request - Request HTTP de consulta.
 * @param {unknown} _context - Contexto no usado.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Turno activo e historial.
 */
export const GET = withAuthGet(
  async (_request: NextRequest, _context: unknown, user: { userId: string }) => {
    try {
      const [turnoActivo, turnos] = await Promise.all([
        prisma.cierreContable.findFirst({
          where: {
            tipo: 'RESTAURANTE_TURNO',
            creadoPor: user.userId,
            estado: 'abierto',
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.cierreContable.findMany({
          where: {
            tipo: 'RESTAURANTE_TURNO',
            creadoPor: user.userId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        }),
      ]);

      return NextResponse.json({
        turnoActivo,
        turnos,
      });
    } catch (error) {
      console.error('Error al consultar turnos POS:', error);
      return NextResponse.json({ error: 'Error al consultar turnos POS.' }, { status: 500 });
    }
  }
);

/**
 * @description Abre un turno POS para el cajero autenticado.
 * @param {NextRequest} request - Request HTTP con observaciones opcionales.
 * @param {unknown} _context - Contexto no usado.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Turno abierto.
 */
export const POST = withAuthPost(
  async (request: NextRequest, _context: unknown, user: { userId: string }) => {
    try {
      const payload = abrirTurnoSchema.parse(await request.json());

      const existing = await prisma.cierreContable.findFirst({
        where: {
          tipo: 'RESTAURANTE_TURNO',
          creadoPor: user.userId,
          estado: 'abierto',
        },
        select: {
          cierreId: true,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un turno abierto para este cajero.' },
          { status: 409 }
        );
      }

      const now = new Date();
      const turno = await prisma.cierreContable.create({
        data: {
          tipo: 'RESTAURANTE_TURNO',
          fechaInicio: now,
          fechaFin: now,
          estado: 'abierto',
          creadoPor: user.userId,
          observaciones: payload.observaciones ?? null,
        },
      });

      return NextResponse.json(turno, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para abrir turno.', issues: error.issues },
          { status: 400 }
        );
      }

      console.error('Error al abrir turno POS:', error);
      return NextResponse.json({ error: 'Error al abrir turno POS.' }, { status: 500 });
    }
  }
);

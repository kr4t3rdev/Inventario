import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const estadoMesaSchema = z.enum(['DISPONIBLE', 'OCUPADA', 'RESERVADA']);

const updateMesaSchema = z
  .object({
    numero: z.number().int().min(1).optional(),
    capacidad: z.number().int().min(1).max(20).optional(),
    estado: estadoMesaSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

interface MesaRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Actualiza una mesa del restaurante por ID.
 * @param {NextRequest} request - Request HTTP con datos parciales.
 * @param {MesaRouteContext} context - Contexto de ruta con el ID de mesa.
 * @returns {Promise<NextResponse>} Respuesta JSON con la mesa actualizada.
 */
export const PATCH = withAuth(
  async (request: NextRequest, context: MesaRouteContext) => {
    try {
      const { id } = await context.params;
      const payload = updateMesaSchema.parse(await request.json());

      const mesa = await prisma.mesa.update({
        where: { mesaId: id },
        data: payload,
      });

      return NextResponse.json(mesa);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Datos inválidos para actualizar la mesa.',
            issues: error.issues,
          },
          { status: 400 }
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return NextResponse.json(
          { error: 'La mesa no existe o fue eliminada.' },
          { status: 404 }
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

      console.error('Error al actualizar mesa del restaurante:', error);
      return NextResponse.json(
        { error: 'Error al actualizar mesa del restaurante.' },
        { status: 500 }
      );
    }
  }
);

/**
 * @description Elimina una mesa del restaurante por ID.
 * @param {NextRequest} _request - Request HTTP de eliminación.
 * @param {MesaRouteContext} context - Contexto de ruta con el ID de mesa.
 * @returns {Promise<NextResponse>} Respuesta JSON con resultado de eliminación.
 */
export const DELETE = withAuth(
  async (_request: NextRequest, context: MesaRouteContext) => {
    try {
      const { id } = await context.params;
      await prisma.mesa.delete({ where: { mesaId: id } });

      return NextResponse.json({ success: true, mesaId: id });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return NextResponse.json(
          { error: 'La mesa no existe o ya fue eliminada.' },
          { status: 404 }
        );
      }

      console.error('Error al eliminar mesa del restaurante:', error);
      return NextResponse.json(
        { error: 'Error al eliminar mesa del restaurante.' },
        { status: 500 }
      );
    }
  }
);

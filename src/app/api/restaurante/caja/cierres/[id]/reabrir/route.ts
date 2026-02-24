import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const reabrirCierreSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

interface ReabrirCierreRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Reabre un cierre de caja POS con motivo auditado.
 * @param {NextRequest} request - Request con motivo de reapertura.
 * @param {ReabrirCierreRouteContext} context - Contexto con ID de cierre.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Cierre actualizado.
 */
export const POST = withAuthPost(
  async (
    request: NextRequest,
    context: ReabrirCierreRouteContext,
    user: { userId: string }
  ) => {
    try {
      const { id } = await context.params;
      const payload = reabrirCierreSchema.parse(await request.json());

      const cierre = await prisma.cierreContable.findUnique({
        where: { cierreId: id },
      });

      if (!cierre || cierre.tipo !== 'RESTAURANTE_POS') {
        return NextResponse.json({ error: 'Cierre POS no encontrado.' }, { status: 404 });
      }

      if (cierre.estado === 'abierto') {
        return NextResponse.json({ error: 'El cierre ya está abierto.' }, { status: 409 });
      }

      const reaperturaMeta = {
        timestamp: new Date().toISOString(),
        userId: user.userId,
        motivo: payload.motivo,
      };

      const updated = await prisma.cierreContable.update({
        where: { cierreId: id },
        data: {
          estado: 'abierto',
          observaciones: cierre.observaciones
            ? `${cierre.observaciones}\n[REAPERTURA_JSON]${JSON.stringify(reaperturaMeta)}`
            : `[REAPERTURA_JSON]${JSON.stringify(reaperturaMeta)}`,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para reapertura.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Cierre POS no encontrado.' }, { status: 404 });
      }

      console.error('Error al reabrir cierre POS:', error);
      return NextResponse.json({ error: 'Error al reabrir cierre POS.' }, { status: 500 });
    }
  }
);

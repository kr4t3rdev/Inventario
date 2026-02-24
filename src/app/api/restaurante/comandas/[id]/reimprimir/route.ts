import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

interface ReimprimirComandaRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Extrae checkout desde observaciones.
 * @param {string | null} observaciones - Observaciones de comanda.
 * @returns {{ folio?: string } | null} Checkout parseado.
 */
function parseCheckoutMeta(observaciones: string | null): { folio?: string } | null {
  if (!observaciones) {
    return null;
  }

  const marker = '[CHECKOUT_JSON]';
  const markerIndex = observaciones.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const raw = observaciones.slice(markerIndex + marker.length).trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as { folio?: string };
  } catch {
    return null;
  }
}

/**
 * @description Registra reimpresión de ticket y devuelve folio.
 * @param {NextRequest} _request - Request HTTP sin payload.
 * @param {ReimprimirComandaRouteContext} context - Contexto con ID de comanda.
 * @returns {Promise<NextResponse>} Registro actualizado de reimpresión.
 */
export const POST = withAuthPost(
  async (_request: NextRequest, context: ReimprimirComandaRouteContext) => {
    try {
      const { id } = await context.params;

      const comanda = await prisma.comanda.findUnique({
        where: { comandaId: id },
        select: {
          comandaId: true,
          estado: true,
          observaciones: true,
        },
      });

      if (!comanda) {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      if (comanda.estado !== 'CERRADA') {
        return NextResponse.json(
          { error: 'Solo se pueden reimprimir tickets de comandas cerradas.' },
          { status: 409 }
        );
      }

      const existingMatches = (comanda.observaciones ?? '').match(/\[REIMPRESION_JSON\]/g);
      const count = existingMatches?.length ?? 0;
      const nextCount = count + 1;

      const reprintMeta = {
        timestamp: new Date().toISOString(),
        numero: nextCount,
      };

      const updated = await prisma.comanda.update({
        where: { comandaId: id },
        data: {
          observaciones: comanda.observaciones
            ? `${comanda.observaciones}\n[REIMPRESION_JSON]${JSON.stringify(reprintMeta)}`
            : `[REIMPRESION_JSON]${JSON.stringify(reprintMeta)}`,
        },
      });

      const checkout = parseCheckoutMeta(updated.observaciones);

      return NextResponse.json({
        comandaId: updated.comandaId,
        folio: checkout?.folio ?? null,
        reimpresiones: nextCount,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      console.error('Error al registrar reimpresión:', error);
      return NextResponse.json(
        { error: 'Error al registrar reimpresión.' },
        { status: 500 }
      );
    }
  }
);

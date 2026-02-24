import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

interface ComandaRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Extrae metadatos de checkout almacenados en observaciones.
 * @param {string | null} observaciones - Campo observaciones de la comanda.
 * @returns {unknown | null} Metadatos parseados o null.
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
 * @description Obtiene una comanda con detalle para visualización/imprenta.
 * @param {NextRequest} _request - Request HTTP de lectura.
 * @param {ComandaRouteContext} context - Contexto con ID de comanda.
 * @returns {Promise<NextResponse>} Comanda detallada.
 */
export const GET = withAuthGet(
  async (_request: NextRequest, context: ComandaRouteContext) => {
    try {
      const { id } = await context.params;

      const comanda = await prisma.comanda.findUnique({
        where: { comandaId: id },
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
      });

      if (!comanda) {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      const reimpresiones =
        (comanda.observaciones?.match(/\[REIMPRESION_JSON\]/g)?.length ?? 0);
      const checkout = parseCheckoutMeta(comanda.observaciones);

      return NextResponse.json({
        ...comanda,
        checkout,
        folio: checkout?.folio ?? null,
        reimpresiones,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      console.error('Error al obtener comanda por ID:', error);
      return NextResponse.json({ error: 'Error al obtener comanda.' }, { status: 500 });
    }
  }
);

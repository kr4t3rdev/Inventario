import { NextRequest, NextResponse } from 'next/server';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const cerrarTurnoSchema = z.object({
  observaciones: z.string().max(1000).optional(),
});

interface CheckoutMeta {
  pagos?: Array<{ metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'; monto: number }>;
}

/**
 * @description Extrae checkout desde observaciones.
 * @param {string | null} observaciones - Observaciones de comanda.
 * @returns {CheckoutMeta | null} Checkout parseado.
 */
function parseCheckoutMeta(observaciones: string | null): CheckoutMeta | null {
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
    return JSON.parse(raw) as CheckoutMeta;
  } catch {
    return null;
  }
}

/**
 * @description Cierra turno POS abierto y calcula resumen del periodo.
 * @param {NextRequest} request - Request con observaciones opcionales.
 * @param {unknown} _context - Contexto no usado.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Turno cerrado y resumen.
 */
export const POST = withAuthPost(
  async (request: NextRequest, _context: unknown, user: { userId: string }) => {
    try {
      const payload = cerrarTurnoSchema.parse(await request.json());

      const turno = await prisma.cierreContable.findFirst({
        where: {
          tipo: 'RESTAURANTE_TURNO',
          creadoPor: user.userId,
          estado: 'abierto',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!turno) {
        return NextResponse.json({ error: 'No hay turno abierto para cerrar.' }, { status: 404 });
      }

      const now = new Date();
      const comandas = await prisma.comanda.findMany({
        where: {
          estado: 'CERRADA',
          fechaCierre: {
            gte: turno.fechaInicio,
            lte: now,
          },
        },
        select: {
          total: true,
          observaciones: true,
        },
      });

      const resumen = {
        totalComandas: comandas.length,
        totalFacturado: comandas.reduce((acc, comanda) => acc + comanda.total, 0),
        porMetodo: {
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
          noClasificado: 0,
        },
      };

      for (const comanda of comandas) {
        const checkout = parseCheckoutMeta(comanda.observaciones);
        if (!checkout?.pagos?.length) {
          resumen.porMetodo.noClasificado += comanda.total;
          continue;
        }

        for (const pago of checkout.pagos) {
          if (pago.metodo === 'EFECTIVO') {
            resumen.porMetodo.efectivo += pago.monto;
          }
          if (pago.metodo === 'TARJETA') {
            resumen.porMetodo.tarjeta += pago.monto;
          }
          if (pago.metodo === 'TRANSFERENCIA') {
            resumen.porMetodo.transferencia += pago.monto;
          }
        }
      }

      const updatedTurno = await prisma.cierreContable.update({
        where: { cierreId: turno.cierreId },
        data: {
          estado: 'cerrado',
          fechaFin: now,
          totalVentas: resumen.totalFacturado,
          ganancias: resumen.totalFacturado,
          ingresosCaja: resumen.totalFacturado,
          observaciones: payload.observaciones
            ? `${payload.observaciones}\nResumen turno: ${JSON.stringify(resumen.porMetodo)}`
            : `Resumen turno: ${JSON.stringify(resumen.porMetodo)}`,
        },
      });

      return NextResponse.json({
        turno: updatedTurno,
        resumen,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para cerrar turno.', issues: error.issues },
          { status: 400 }
        );
      }

      console.error('Error al cerrar turno POS:', error);
      return NextResponse.json({ error: 'Error al cerrar turno POS.' }, { status: 500 });
    }
  }
);

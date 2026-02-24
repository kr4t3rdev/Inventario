import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const pagoMetodoSchema = z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);

const checkoutSchema = z.object({
  splitCount: z.number().int().min(1).max(20).default(1),
  descuento: z.number().int().min(0).default(0),
  propina: z.number().int().min(0).default(0),
  pagos: z
    .array(
      z.object({
        metodo: pagoMetodoSchema,
        monto: z.number().int().min(0),
      })
    )
    .min(1),
});

interface ComandaCheckoutRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * @description Genera folio legible para ticket de comanda.
 * @param {string} comandaId - Identificador único de comanda.
 * @returns {string} Folio normalizado.
 */
function generateFolio(comandaId: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const idPart = comandaId.slice(-6).toUpperCase();
  return `FOL-${datePart}-${idPart}`;
}

/**
 * @description Realiza checkout de comanda con pagos mixtos y división de cuenta.
 * @param {NextRequest} request - Request HTTP con split y pagos.
 * @param {ComandaCheckoutRouteContext} context - Contexto con ID de comanda.
 * @returns {Promise<NextResponse>} Comanda cerrada con resumen de pago.
 */
export const POST = withAuthPost(
  async (request: NextRequest, context: ComandaCheckoutRouteContext) => {
    try {
      const { id } = await context.params;
      const payload = checkoutSchema.parse(await request.json());

      const comanda = await prisma.comanda.findUnique({
        where: { comandaId: id },
        select: {
          comandaId: true,
          estado: true,
          mesaId: true,
          total: true,
          observaciones: true,
        },
      });

      if (!comanda) {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      if (comanda.estado !== 'ABIERTA') {
        return NextResponse.json(
          { error: 'La comanda ya fue cerrada o cancelada.' },
          { status: 409 }
        );
      }

      const totalAPagar = comanda.total - payload.descuento + payload.propina;
      if (totalAPagar < 0) {
        return NextResponse.json(
          { error: 'El descuento no puede dejar total negativo.' },
          { status: 400 }
        );
      }

      const montoPagado = payload.pagos.reduce((acc, pago) => acc + pago.monto, 0);
      if (montoPagado !== totalAPagar) {
        return NextResponse.json(
          {
            error: 'La suma de pagos no coincide con el total a pagar.',
            totalAPagar,
            montoPagado,
          },
          { status: 409 }
        );
      }

      const totalPorPersona = Math.ceil(totalAPagar / payload.splitCount);
      const checkoutMeta = {
        timestamp: new Date().toISOString(),
        folio: generateFolio(comanda.comandaId),
        splitCount: payload.splitCount,
        descuento: payload.descuento,
        propina: payload.propina,
        totalOriginal: comanda.total,
        totalAPagar,
        totalPorPersona,
        pagos: payload.pagos,
      };

      const observacionesPrevias = comanda.observaciones?.trim();
      const observacionesCheckout = `[CHECKOUT_JSON]${JSON.stringify(checkoutMeta)}`;
      const observaciones = observacionesPrevias
        ? `${observacionesPrevias}\n${observacionesCheckout}`
        : observacionesCheckout;

      const closedComanda = await prisma.$transaction(async (tx) => {
        const updated = await tx.comanda.update({
          where: { comandaId: id },
          data: {
            estado: 'CERRADA',
            fechaCierre: new Date(),
            observaciones,
          },
          include: {
            mesa: true,
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
          where: { mesaId: comanda.mesaId },
          data: { estado: 'DISPONIBLE' },
        });

        return updated;
      });

      return NextResponse.json({
        comanda: closedComanda,
        checkout: checkoutMeta,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Datos inválidos para checkout.', issues: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Comanda no encontrada.' }, { status: 404 });
      }

      console.error('Error al realizar checkout de comanda:', error);
      return NextResponse.json(
        { error: 'Error al realizar checkout de comanda.' },
        { status: 500 }
      );
    }
  }
);

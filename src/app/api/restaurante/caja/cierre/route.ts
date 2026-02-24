import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const cierreCajaSchema = z.object({
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime(),
  observaciones: z.string().max(1000).optional(),
});

interface CheckoutMeta {
  pagos?: Array<{ metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'; monto: number }>;
}

/**
 * @description Extrae metadatos de checkout desde observaciones de comanda.
 * @param {string | null} observaciones - Texto de observaciones de comanda.
 * @returns {CheckoutMeta | null} Objeto de checkout si existe.
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
 * @description Resume caja de restaurante en un rango de fechas.
 * @param {Date} fechaInicio - Fecha inicio del rango.
 * @param {Date} fechaFin - Fecha fin del rango.
 * @returns {Promise<object>} Resumen de caja.
 */
async function buildCajaResumen(fechaInicio: Date, fechaFin: Date): Promise<{
  totalComandas: number;
  totalFacturado: number;
  porMetodo: { efectivo: number; tarjeta: number; transferencia: number; noClasificado: number };
}> {
  const comandas = await prisma.comanda.findMany({
    where: {
      estado: 'CERRADA',
      fechaCierre: {
        gte: fechaInicio,
        lte: fechaFin,
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
    const meta = parseCheckoutMeta(comanda.observaciones);
    if (!meta?.pagos?.length) {
      resumen.porMetodo.noClasificado += comanda.total;
      continue;
    }

    for (const pago of meta.pagos) {
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

  return resumen;
}

/**
 * @description Consulta resumen de caja restaurante por rango.
 * @param {NextRequest} request - Request con query params.
 * @returns {Promise<NextResponse>} Resumen de caja.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    const fechaInicioRaw = searchParams.get('fechaInicio');
    const fechaFinRaw = searchParams.get('fechaFin');

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const fechaInicio = fechaInicioRaw ? new Date(fechaInicioRaw) : start;
    const fechaFin = fechaFinRaw ? new Date(fechaFinRaw) : end;

    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime())) {
      return NextResponse.json({ error: 'Rango de fecha inválido.' }, { status: 400 });
    }

    const resumen = await buildCajaResumen(fechaInicio, fechaFin);

    return NextResponse.json({
      fechaInicio,
      fechaFin,
      ...resumen,
    });
  } catch (error) {
    console.error('Error al obtener resumen de caja restaurante:', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de caja restaurante.' },
      { status: 500 }
    );
  }
});

/**
 * @description Cierra caja del POS restaurante creando registro contable.
 * @param {NextRequest} request - Request con rango de cierre.
 * @param {any} _context - Contexto de ruta no usado.
 * @param {any} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Cierre generado.
 */
export const POST = withAuthPost(
  async (
    request: NextRequest,
    _context: unknown,
    user: { userId: string }
  ) => {
  try {
    const payload = cierreCajaSchema.parse(await request.json());
    const fechaInicio = new Date(payload.fechaInicio);
    const fechaFin = new Date(payload.fechaFin);

    const resumen = await buildCajaResumen(fechaInicio, fechaFin);

    const cierre = await prisma.cierreContable.create({
      data: {
        tipo: 'RESTAURANTE_POS',
        fechaInicio,
        fechaFin,
        totalVentas: resumen.totalFacturado,
        ganancias: resumen.totalFacturado,
        ingresosCaja: resumen.totalFacturado,
        estado: 'cerrado',
        creadoPor: user.userId,
        observaciones: payload.observaciones
          ? `${payload.observaciones}\nResumen: ${JSON.stringify(resumen.porMetodo)}`
          : `Resumen: ${JSON.stringify(resumen.porMetodo)}`,
      },
    });

    return NextResponse.json({
      cierre,
      resumen,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos para cierre de caja.', issues: error.issues },
        { status: 400 }
      );
    }

    console.error('Error al cerrar caja restaurante:', error);
    return NextResponse.json(
      { error: 'Error al cerrar caja restaurante.' },
      { status: 500 }
    );
  }
  }
);

import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import {
  isCierreDiarioPersistenceUnavailableError,
  isDailyPeriodNotFoundError,
  persistDailyClose,
} from '@/lib/services/cierre-diario-persistence-service';

/**
 * @description Cierra el día contable y persiste su snapshot diario.
 * @param {NextRequest} request - Request con fecha opcional.
 * @returns {Promise<NextResponse>} Resultado del cierre diario.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const user = authResult.user;
    const body = await request.json().catch(() => ({}));
    let fecha: Date;

    if (body?.periodoId) {
      const client = prisma as unknown as Record<string, unknown>;
      const periodoModel = client.periodoContable as { findUnique: (args: Record<string, unknown>) => Promise<{ fechaInicio: Date } | null> } | undefined;
      if (!periodoModel) {
        return NextResponse.json(
          { error: 'Modelo PeriodoContable no disponible', code: 'MODEL_UNAVAILABLE' },
          { status: 503 }
        );
      }
      const periodo = await periodoModel.findUnique({ where: { periodoId: body.periodoId } });
      if (!periodo) {
        return NextResponse.json(
          { error: 'Período no encontrado', code: 'PERIODO_NO_ENCONTRADO' },
          { status: 404 }
        );
      }
      fecha = new Date(periodo.fechaInicio);
    } else {
      fecha = body?.fecha ? new Date(body.fecha) : new Date();
    }

    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: 'Fecha inválida', code: 'FECHA_INVALIDA' },
        { status: 400 }
      );
    }

    const result = await persistDailyClose({
      fecha,
      usuarioId: user.userId,
    });

    return NextResponse.json(
      {
        message: result.wasCreated
          ? 'Cierre diario creado exitosamente'
          : 'El cierre diario ya existía para esa fecha',
        periodo: result.periodo,
        snapshot: result.snapshot,
        resumen: result.resumen,
        wasCreated: result.wasCreated,
      },
      { status: result.wasCreated ? 201 : 200 }
    );
  } catch (error) {
    if (isCierreDiarioPersistenceUnavailableError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (isDailyPeriodNotFoundError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error al cerrar período diario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

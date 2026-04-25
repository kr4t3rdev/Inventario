import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import {
  isPeriodoNotFoundError,
  isReaperturaBlockerError,
  isTransicionPersistenceUnavailableError,
  reabrirPeriodo,
} from '@/lib/services/periodo-transicion-service';

/**
 * @description Reabre un período contable cerrado o aprobado, requiriendo motivo obligatorio y auditoría.
 * @param {NextRequest} request - Request con motivo obligatorio en el body.
 * @param {{ id: string }} params - ID del período a reabrir.
 * @returns {Promise<NextResponse>} Resultado de la reapertura o error.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const user = authResult.user;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (!body?.motivo || typeof body.motivo !== 'string' || body.motivo.trim().length === 0) {
      return NextResponse.json(
        { error: 'La reapertura requiere un motivo obligatorio.', code: 'MOTIVO_REQUERIDO' },
        { status: 400 }
      );
    }

    const result = await reabrirPeriodo({
      periodoId: id,
      usuarioId: user.userId,
      motivo: body.motivo,
    });

    return NextResponse.json(
      {
        message: `Período ${result.periodo.codigo} reabierto exitosamente`,
        periodo: result.periodo,
        estadoAnterior: result.estadoAnterior,
        estadoNuevo: result.estadoNuevo,
        auditado: result.auditado,
      },
      { status: 200 }
    );
  } catch (error) {
    if (isTransicionPersistenceUnavailableError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (isPeriodoNotFoundError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (isReaperturaBlockerError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code, blockers: error.blockers },
        { status: error.status }
      );
    }

    console.error('Error al reabrir período:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
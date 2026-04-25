import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import {
  aprobarPeriodo,
  isAprobacionBlockerError,
  isPeriodoNotFoundError,
  isTransicionPersistenceUnavailableError,
} from '@/lib/services/periodo-transicion-service';

/**
 * @description Aprueba un período contable, validando estado, dependencias y existencia de snapshot.
 * @param {NextRequest} request - Request con motivo opcional en el body.
 * @param {{ id: string }} params - ID del período a aprobar.
 * @returns {Promise<NextResponse>} Resultado de la aprobación o error.
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

    const result = await aprobarPeriodo({
      periodoId: id,
      usuarioId: user.userId,
      motivo: body?.motivo,
    });

    return NextResponse.json(
      {
        message: `Período ${result.periodo.codigo} aprobado exitosamente`,
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

    if (isAprobacionBlockerError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code, blockers: error.blockers },
        { status: error.status }
      );
    }

    console.error('Error al aprobar período:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
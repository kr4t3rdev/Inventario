import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import {
  ESTADO_PERIODO,
  TIPO_PERIODO,
  type EstadoPeriodo,
  type TipoPeriodo,
} from '@/lib/services/periodo-contable-service';
import {
  isListadoPeriodosPersistenceUnavailableError,
  listPeriodos,
} from '@/lib/services/listar-periodos-service';

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('FECHA_INVALIDA');
  }

  return parsed;
}

function parseTipoParam(value: string | null): TipoPeriodo | undefined {
  if (!value) {
    return undefined;
  }

  if (value in TIPO_PERIODO) {
    return value as TipoPeriodo;
  }

  throw new Error('TIPO_PERIODO_INVALIDO');
}

function parseEstadoParam(value: string | null): EstadoPeriodo | undefined {
  if (!value) {
    return undefined;
  }

  if (value in ESTADO_PERIODO) {
    return value as EstadoPeriodo;
  }

  throw new Error('ESTADO_PERIODO_INVALIDO');
}

/**
 * @description Lista períodos contables con filtros opcionales para administrar dependencias y cierres.
 * @param {NextRequest} request - Request HTTP con query params de filtrado.
 * @returns {Promise<NextResponse>} Respuesta JSON con items y metadatos.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const { searchParams } = request.nextUrl;
    const tipo = parseTipoParam(searchParams.get('tipo'));
    const estado = parseEstadoParam(searchParams.get('estado'));
    const fechaDesde = parseDateParam(searchParams.get('fechaDesde'));
    const fechaHasta = parseDateParam(searchParams.get('fechaHasta'));

    const result = await listPeriodos({
      tipo,
      estado,
      fechaDesde: fechaDesde ?? undefined,
      fechaHasta: fechaHasta ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === 'FECHA_INVALIDA') {
      return NextResponse.json(
        { error: 'Fecha inválida', code: 'FECHA_INVALIDA' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'TIPO_PERIODO_INVALIDO') {
      return NextResponse.json(
        { error: 'Tipo de período inválido', code: 'TIPO_PERIODO_INVALIDO' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'ESTADO_PERIODO_INVALIDO') {
      return NextResponse.json(
        { error: 'Estado de período inválido', code: 'ESTADO_PERIODO_INVALIDO' },
        { status: 400 }
      );
    }

    if (isListadoPeriodosPersistenceUnavailableError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error al listar períodos contables:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

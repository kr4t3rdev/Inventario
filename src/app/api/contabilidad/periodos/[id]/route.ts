import { NextRequest, NextResponse } from 'next/server';

import { authenticateUser } from '@/lib/auth-middleware';
import {
  getPeriodoDetail,
  isPeriodoByIdNotFoundError,
  isPeriodoDetailUnavailableError,
} from '@/lib/services/periodo-detail-service';

/**
 * @description Obtiene el detalle completo de un período contable incluyendo apertura, snapshots, subperíodos y acciones disponibles.
 * @param {NextRequest} request - Request HTTP.
 * @param {{ id: string }} params - ID del período.
 * @returns {Promise<NextResponse>} Detalle del período o error.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateUser(request);
    if ('status' in authResult) {
      return authResult as Response;
    }

    const { id } = await params;
    const detail = await getPeriodoDetail(id);

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (isPeriodoDetailUnavailableError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (isPeriodoByIdNotFoundError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error al obtener detalle del período:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}